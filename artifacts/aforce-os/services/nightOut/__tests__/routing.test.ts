import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isNightOutEnabled, nightOutInternalPreviewContext } from '../access';
import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '@/featureFlags/flags';
import type { FeatureFlags } from '@/types';

const APP = join(__dirname, '..', '..', '..'); // artifacts/aforce-os
const read = (...p: string[]) => readFileSync(join(APP, ...p), 'utf8');

describe('NO-b — visibility gating (unauthorized cannot see / enter Night Out)', () => {
  it('production/default context keeps Night Out hidden', () => {
    // prod: default flags (night_out_enabled=false) + no internal-preview context
    expect(isNightOutEnabled(DEFAULT_FLAGS, nightOutInternalPreviewContext(false))).toBe(false);
    // even if a client somehow flips the flag, without the approved context it stays hidden
    const flipped = { ...DEFAULT_FLAGS, night_out_enabled: true } as FeatureFlags;
    expect(isNightOutEnabled(flipped, nightOutInternalPreviewContext(false))).toBe(false);
  });

  it('approved internal/demo context can reach Night Out (flag on + context)', () => {
    const demoFlags = { ...DEMO_ALL_ON_FLAGS, night_out_enabled: true } as FeatureFlags;
    expect(isNightOutEnabled(demoFlags, nightOutInternalPreviewContext(true))).toBe(true);
  });
});

describe('NO-b — route wiring (gated entry, safe redirects, no loops)', () => {
  // Build-61 correction (device QA, P1): the unauthorized landing for Night
  // Out's routes moved Protocol → Circle. Protocol's job is TODAY / NEXT / WHY
  // / PROGRESS; a social entry point that cannot open must not deposit the
  // member there. The assertion is retargeted, not relaxed — the gate check,
  // the no-loop checks, and a NEW "never lands on Protocol" check all hold.
  it('the /night-out route is authorization-gated and redirects to Circle (never Protocol) when unauthorized', () => {
    const route = read('app', 'night-out.tsx');
    expect(route).toMatch(/isNightOutEnabled/);
    expect(route).toMatch(/Redirect href="\/\(tabs\)\/competition"/);
    expect(route).not.toMatch(/Redirect href="\/\(tabs\)\/protocol"/);
    // no self-loop / no redirect back to a Night Out alias
    expect(route).not.toMatch(/Redirect href="\/night-out"/);
    expect(route).not.toMatch(/Redirect href="\/social/);
  });

  it('the Protocol entry renders null unless authorized', () => {
    const entry = read('components', 'nightOut', 'NightOutProtocolEntry.tsx');
    expect(entry).toMatch(/isNightOutEnabled/);
    expect(entry).toMatch(/return null/);
    expect(entry).toMatch(/router\.push\('\/night-out'/);
  });

  it('social-v2 is a non-destructive redirect to the gated canonical route (not discoverable)', () => {
    const sv2 = read('app', 'social-v2.tsx');
    expect(sv2).toMatch(/Redirect/);
    expect(sv2).toMatch(/'\/night-out'/);
    expect(sv2).not.toMatch(/SocialModeV2Screen/); // no longer mounts the screen directly
  });

  it('the legacy /social alias is authorization-gated (cannot bypass in production) and lands on Circle', () => {
    const social = read('app', '(tabs)', 'social.tsx');
    expect(social).toMatch(/isNightOutEnabled/);
    // Build-61: same Protocol → Circle move as `/night-out` above.
    expect(social).toMatch(/Redirect href="\/\(tabs\)\/competition"/);
    expect(social).not.toMatch(/Redirect href="\/\(tabs\)\/protocol"/);
    // no self-loop back to a Night Out alias
    expect(social).not.toMatch(/Redirect href="\/social/);
    expect(social).not.toMatch(/Redirect href="\/night-out"/);
  });

  it('social-legacy is dev-gated and redirects to Protocol when not in Developer Mode', () => {
    const legacy = read('app', '(tabs)', 'social-legacy.tsx');
    expect(legacy).toMatch(/useDevMode/);
    expect(legacy).toMatch(/if \(!devMode\)/);
    expect(legacy).toMatch(/Redirect href="\/\(tabs\)\/protocol"/);
  });

  it('the social-v2 discoverability link was removed from Profile', () => {
    // S2-10b(2): the tab blocks live in panes/*.tsx — scan shell + panes so a
    // pane cannot quietly reintroduce the link.
    const profile =
      read('components', 'profile', 'ProfileScreenV2.tsx') +
      read('components', 'profile', 'panes', 'PerformancePane.tsx') +
      read('components', 'profile', 'panes', 'DevicesPane.tsx') +
      read('components', 'profile', 'panes', 'AccountPane.tsx') +
      read('components', 'profile', 'panes', 'DeveloperPane.tsx');
    expect(profile).not.toMatch(/router\.push\('\/social-v2'\)/);
  });
});

describe('NO-b — Home entry points are authorization-gated (no unauthorized entry)', () => {
  it('the Home pip renders null and is gated behind isNightOutEnabled', () => {
    const pip = read('components', 'home', 'SocialModePip.tsx');
    expect(pip).toMatch(/isNightOutEnabled/);
    expect(pip).toMatch(/return null/);
    // residue removed
    expect(pip).not.toMatch(/Social Mode active/);
    expect(pip).not.toMatch(/Activate Social Mode/);
  });

  it('the Home banner + entry tile are gated behind nightOutAuthorized', () => {
    const zone = read('components', 'home', 'SignalsZone.tsx');
    expect(zone).toMatch(/isNightOutEnabled/);
    expect(zone).toMatch(/nightOutAuthorized && social/);
    expect(zone).toMatch(/\{nightOutAuthorized && \(/);
  });
});

describe('NO-b — exactly five visible bottom tabs; no Night Out tab added', () => {
  const layout = read('app', '(tabs)', '_layout.tsx');

  it('the five approved visible tabs are present', () => {
    for (const name of ['index', 'journal', 'protocol', 'competition', 'profile']) {
      expect(layout).toMatch(new RegExp(`name="${name}"`));
    }
  });

  it('social / scan / sleep remain hidden (href: null), and no night-out tab exists', () => {
    // the hidden routes are registered but off the bar
    expect(layout).toMatch(/name="social"/);
    expect(layout).toMatch(/href: null/);
    // NO-b did not add a Night Out bottom tab
    expect(layout).not.toMatch(/name="night-out"/);
  });
});
