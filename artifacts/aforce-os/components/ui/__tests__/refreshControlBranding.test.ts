/**
 * Branded pull-to-refresh (RC-1 Wave-2B, item 3).
 *
 * The 4 `RefreshControl` sites in the app (Achievements + Leaderboard,
 * legacy screen and V2 twin each) previously mixed the legacy `Colors.*`
 * token module (the two legacy screens) and a partial af.* adoption
 * (the two V2 twins had `tintColor` on af.* already but no Android
 * `colors`/`progressBackgroundColor`). This is a small, mechanical,
 * source-text guard (no haptics, no store — see mission scope) asserting
 * all 4 sites now set `tintColor` + `colors` + `progressBackgroundColor`
 * from the SAME af.* tokens, consistently.
 *
 * Source-text guard rather than a render mount: these are connected screens
 * (store/router/query hooks) — same convention documented in
 * `components/home/__tests__/homeScreenV2Wiring.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');

const SITES = [
  { label: 'legacy AchievementsScreen', path: join(ROOT, 'screens', 'AchievementsScreen.tsx') },
  { label: 'legacy LeaderboardScreen', path: join(ROOT, 'screens', 'LeaderboardScreen.tsx') },
  { label: 'AchievementsScreenV2', path: join(ROOT, 'components', 'achievements', 'AchievementsScreenV2.tsx') },
  { label: 'LeaderboardScreenV2', path: join(ROOT, 'components', 'leaderboard', 'LeaderboardScreenV2.tsx') },
];

describe('RefreshControl branding — all 4 sites use af.* tokens for tintColor/colors/progressBackgroundColor', () => {
  for (const site of SITES) {
    it(`${site.label} imports af and its RefreshControl sets all three af.* props`, () => {
      const source = readFileSync(site.path, 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
      expect(code).toMatch(/import\s*\{\s*af\s*\}\s*from\s*['"]@\/theme['"];/);

      const rcStart = code.indexOf('<RefreshControl');
      expect(rcStart, `${site.label} should render a <RefreshControl>`).toBeGreaterThan(-1);
      const rcEnd = code.indexOf('/>', rcStart);
      const rcProps = code.slice(rcStart, rcEnd);

      expect(rcProps).toMatch(/tintColor=\{af\.textPrimary\}/);
      expect(rcProps).toMatch(/colors=\{\[af\.textPrimary\]\}/);
      expect(rcProps).toMatch(/progressBackgroundColor=\{af\.surface\}/);
    });
  }
});
