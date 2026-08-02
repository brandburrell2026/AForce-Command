import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(__dirname, '..', '..', '..'); // artifacts/aforce-os
const read = (...p: string[]) => readFileSync(join(APP, ...p), 'utf8');

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

describe('NO-c internal-preview production isolation', () => {
  it('the committed repo contains NO generated internal route (app/internal-preview.tsx)', () => {
    expect(existsSync(join(APP, 'app', 'internal-preview.tsx'))).toBe(false);
  });

  it('the generated internal route is git-ignored (never committed)', () => {
    expect(read('.gitignore')).toMatch(/app\/internal-preview\.tsx/);
  });

  it('NO shipping file imports the internal-preview tree (only the generated route would)', () => {
    const offenders: string[] = [];
    for (const d of ['app', 'screens', 'components', 'hooks', 'services']) {
      for (const f of shippingFiles(d)) {
        if (/internal-preview\//.test(read(f))) offenders.push(f);
      }
    }
    // app/internal-preview.tsx is generated-only + not committed, so zero here.
    expect(offenders, offenders.join(', ')).toEqual([]);
  });

  it('the build config selects identity from the BUILD-TIME selector, runs route sync, and derives markers', () => {
    const cfg = read('app.config.ts');
    expect(cfg).toMatch(/resolveBuildIdentity\(process\.env\)/);
    expect(cfg).toMatch(/syncInternalPreviewRoute\(/);
    expect(cfg).toMatch(/bundleIdentifier: id\.bundleId/);
  });

  it('Metro blocks the internal-preview tree for non-internal builds', () => {
    const metro = read('metro.config.js');
    expect(metro).toMatch(/blockList/);
    expect(metro).toMatch(/internal-preview/);
    expect(metro).toMatch(/EAS_BUILD_PROFILE|APP_PROFILE/);
  });

  it('the /night-out route guard is unchanged (still gates + redirects; renders the command screen)', () => {
    const route = read('app', 'night-out.tsx');
    expect(route).toMatch(/isNightOutEnabled\(flags, nightOutInternalPreviewContext\(\)\)/);
    expect(route).toMatch(/Redirect href="\/\(tabs\)\/protocol"/);
    expect(route).toMatch(/NightOutCommandScreen/);
  });

  it('flags.ts keeps the default-off + restricted invariants (no new enablement path)', () => {
    const flags = read('featureFlags', 'flags.ts');
    expect(flags).toMatch(/night_out_enabled: false/);
    expect(flags).toMatch(/INTERNAL_PREVIEW_RESTRICTED_FLAGS = \['night_out_enabled'\]/);
    // the ONLY place a shipping file sets night_out_enabled true is the sanctioned enabler in access.ts
    for (const d of ['app', 'screens', 'components', 'hooks', 'services']) {
      for (const f of shippingFiles(d)) {
        const src = read(f);
        if (/night_out_enabled\s*[:=]\s*true/.test(src)) {
          expect(f).toBe('services/nightOut/access.ts');
        }
      }
    }
  });
});
