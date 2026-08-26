import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(__dirname, '..', '..', '..'); // artifacts/aforce-os
const read = (...p: string[]) => readFileSync(join(APP, ...p), 'utf8');

/** All source files under a dir (excluding __tests__), recursively. */
function shippingFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(join(APP, dir))) {
    const rel = join(dir, name);
    const abs = join(APP, rel);
    if (statSync(abs).isDirectory()) {
      if (name === '__tests__' || name === '__snapshots__') continue;
      shippingFiles(rel, acc);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      acc.push(rel);
    }
  }
  return acc;
}

describe('NO-c production-bundle isolation (harness cannot ship / enable the feature)', () => {
  it('no SHIPPING file imports the render harness or the fixtures', () => {
    const dirs = ['app', 'screens', 'components', 'hooks', 'services'];
    const offenders: string[] = [];
    for (const d of dirs) {
      for (const f of shippingFiles(d)) {
        const src = read(f);
        if (/nightOutCommandView\.render|commandFixtures/.test(src)) offenders.push(f);
      }
    }
    expect(offenders, `harness/fixtures imported by shipping code: ${offenders.join(', ')}`).toEqual([]);
  });

  it('the render harness renders the presentation component ONLY — it never imports the route guard or enables the flag', () => {
    const harness = read('components', 'nightOut', '__tests__', 'nightOutCommandView.render.test.tsx');
    expect(harness).toMatch(/NightOutCommandView/);
    // no IMPORT of the route guard / container / flag-enable (comment mentions are fine)
    const imports = harness.match(/^\s*import .*$/gm) ?? [];
    for (const line of imports) {
      expect(line).not.toMatch(/night-out|NightOutCommandScreen|NightOutRoute/);
      expect(line).not.toMatch(/enableNightOutForInternalPreview|setFeatureFlags|useFeatureFlags/);
    }
    expect(harness).not.toMatch(/night_out_enabled\s*[:=]\s*true/);
  });

  it('the presentation component is pure — no store/route/flag/timer imports', () => {
    const view = read('components', 'nightOut', 'NightOutCommandView.tsx');
    expect(view).not.toMatch(/useAppStore|useFeatureFlags|isNightOutEnabled|useNightOutCommandTimer|expo-router|logIntake/);
  });

  it('the flag remains OFF by default and no NEW client enablement path was added', () => {
    const flags = read('featureFlags', 'flags.ts');
    // still restricted + default-off (NO-a / NO-a.1 invariants intact)
    expect(flags).toMatch(/night_out_enabled: false/);
    expect(flags).toMatch(/INTERNAL_PREVIEW_RESTRICTED_FLAGS = \['night_out_enabled'\]/);
    // The ONLY sanctioned place that sets night_out_enabled=true is the internal-
    // preview enabler in services/nightOut/access.ts (itself gated by isNightOutEnabled
    // requiring the DEMO context). No other client path (query-param / asyncstorage /
    // dev-menu / route-param) may enable it.
    const dirs = ['app', 'screens', 'components', 'hooks', 'services'];
    for (const d of dirs) {
      for (const f of shippingFiles(d)) {
        const src = read(f);
        if (/night_out_enabled\s*[:=]\s*true/.test(src)) {
          expect(f, `unexpected enablement in ${f}`).toBe('services/nightOut/access.ts');
          expect(src).toMatch(/enableNightOutForInternalPreview/); // only inside the sanctioned enabler
        }
      }
    }
  });

  it('the route guard is unchanged — /night-out still gates on isNightOutEnabled + redirects', () => {
    const route = read('app', 'night-out.tsx');
    expect(route).toMatch(/isNightOutEnabled\(flags, nightOutInternalPreviewContext\(\)\)/);
    // Build-61 correction 5: the GATE is what this suite protects and it is
    // untouched; only the unauthorized LANDING moved Protocol → Circle (a
    // social entry point must not deposit the member on Protocol). Asserted
    // both ways so the redirect can neither disappear nor drift back.
    expect(route).toMatch(/Redirect href="\/\(tabs\)\/competition"/);
    expect(route).not.toMatch(/Redirect href="\/\(tabs\)\/protocol"/);
  });
});
