/**
 * `app/(tabs)/` route manifest guard (RC-1 fix-forward, PR #544 code
 * review, blocker 1).
 *
 * expo-router treats EVERY file directly under `app/` as a route by
 * default. `app/(tabs)/HomeScreenLegacy.tsx` was added (RC-1 Wave-3 P1,
 * audit P2-7) as a `React.lazy`-loaded implementation detail of
 * `index.tsx`, NOT a route — but because it lived under `app/(tabs)/` with
 * no `Tabs.Screen` declaration (and no `href: null`) in `_layout.tsx`, it
 * registered as a genuine, undeclared 6th bottom tab titled
 * "HomeScreenLegacy", sorting first (expo-router's default alphabetical/
 * file-order placement for undeclared screens). Fixed by relocating the
 * file to `components/home/HomeScreenLegacy.tsx` — a plain module, not a
 * route — and updating `index.tsx`'s lazy import accordingly (see
 * `homeRouteLazyLegacyWiring.test.ts`).
 *
 * This test guards against the SAME class of bug recurring: it pins the
 * exact set of files expo-router will treat as routes under `app/(tabs)/`
 * to the current, intentional list (verified against the live directory
 * via `ls` when this guard was written — every file here is either
 * declared as a `Tabs.Screen` in `_layout.tsx`, or intentionally hidden
 * from the tab bar via `href: null` for deep-link-only access; see that
 * file's header for the current 5-visible / hidden-but-routable split).
 * Any FUTURE non-route file dropped into `app/(tabs)/` — a component,
 * a helper, another "-Legacy" relocation candidate — fails this test
 * loudly instead of silently becoming a phantom tab.
 *
 * Mutation-verify: this test is meant to fail the moment a stray file
 * (e.g. a re-added `HomeScreenLegacy.tsx`, or any other non-route module)
 * is placed under `app/(tabs)/`.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const TABS_DIR = join(__dirname, '..', '..', '..', 'app', '(tabs)');

/**
 * The known, intentional route file set under `app/(tabs)/` — every file
 * expo-router is allowed to treat as a route. `_layout.tsx` configures the
 * tab group itself; the other 9 are the actual screens (5 visible in the
 * bottom bar + 4 hidden-but-routable via `href: null` / dev-mode-only, per
 * `_layout.tsx`'s header and `Tabs.Screen` declarations).
 */
const EXPECTED_ROUTE_FILES = [
  '_layout.tsx',
  'competition.tsx',
  'index.tsx',
  'journal.tsx',
  'profile.tsx',
  'protocol.tsx',
  'scan.tsx',
  'sleep.tsx',
  'social-legacy.tsx',
  'social.tsx',
].sort();

describe('app/(tabs)/ route manifest — no undeclared files (RC-1 fix-forward, blocker 1)', () => {
  it('contains EXACTLY the known route file set — nothing extra, nothing missing', () => {
    const actual = readdirSync(TABS_DIR)
      .filter((name) => statSync(join(TABS_DIR, name)).isFile())
      .sort();
    expect(actual).toEqual(EXPECTED_ROUTE_FILES);
  });

  it('does not contain a stray HomeScreenLegacy.tsx (the specific regression this guard was added for)', () => {
    const actual = readdirSync(TABS_DIR);
    expect(actual).not.toContain('HomeScreenLegacy.tsx');
  });
});
