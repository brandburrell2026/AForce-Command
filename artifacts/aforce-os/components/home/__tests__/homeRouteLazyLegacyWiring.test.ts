/**
 * Home route (`app/(tabs)/index.tsx`) — deferred legacy import tree
 * wiring (RC-1 Wave-3 P1 perf fix, audit P2-7).
 *
 * `app/(tabs)/index.tsx` and `app/(tabs)/HomeScreenLegacy.tsx` both pull in
 * `useAppStore` / `expo-router` / `@clerk/expo` (the legacy screen also
 * pulls in the full CommandConsole/EntryActions/HomeDashboard/etc. tree) —
 * the same category of store+router-connected container this repo's
 * existing tests deliberately never mount directly (see
 * `components/home/__tests__/homeScreenV2Wiring.test.ts`'s header, which
 * documents the convention and points at
 * `components/health/__tests__/connectedHealthContainer.render.test.tsx`
 * and `components/cruise/__tests__/cruiseModeView.render.test.tsx` mounting
 * only presentational components, never the connected screens). This file
 * applies that same established pattern: a source-text guard, rather than
 * fabricating a store + router + Clerk harness this suite has no existing
 * pattern for.
 *
 * What this verifies:
 *   1. the legacy render path is `React.lazy`-loaded via a dynamic
 *      `import('./HomeScreenLegacy')`, wrapped in `React.Suspense`, and
 *      reachable from the `spec_home` flag branch (still a ternary) —
 *      i.e. the actual P2-7 wiring is present, not just that the file
 *      compiles;
 *   2. `index.tsx` no longer statically imports the heavy legacy
 *      component tree (CommandConsole, EntryActions, HomeDashboard,
 *      MetabolicReadinessZone, PerformanceAgeZone, VoiceCheckInZone,
 *      ActivationJourneyZone, AIVideoPlayer, StatusPulseOrb,
 *      FlavorPickerModal) — proving Metro no longer eagerly evaluates
 *      them from this entry point;
 *   3. the V2 path's import (`HomeScreenV2`) is untouched — still a
 *      normal, eager, static import, exactly as before;
 *   4. `HomeScreenLegacy.tsx` still contains every one of those
 *      components (nothing silently dropped in the move — "do NOT
 *      delete anything" per the fix's mandate) and exports a default
 *      component, the shape `React.lazy` requires.
 *
 * NOT covered here (by design, per the convention above): actually
 * rendering the lazy branch end-to-end. A real Metro module-count/bundle
 * diff — the true proof that cold start no longer evaluates this tree —
 * is a founder-run, on-device measurement (see the PR body), the same
 * category of follow-up already used for this same audit's locale
 * lazy-loading fix.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_SOURCE = readFileSync(
  join(__dirname, '..', '..', '..', 'app', '(tabs)', 'index.tsx'),
  'utf8',
);
const LEGACY_SOURCE = readFileSync(
  join(__dirname, '..', '..', '..', 'app', '(tabs)', 'HomeScreenLegacy.tsx'),
  'utf8',
);
const INDEX_CODE = INDEX_SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

const HEAVY_LEGACY_COMPONENTS = [
  'CommandConsole',
  'EntryActions',
  'HomeDashboard',
  'MetabolicReadinessZone',
  'PerformanceAgeZone',
  'VoiceCheckInZone',
  'ActivationJourneyZone',
  'AIVideoPlayer',
  'StatusPulseOrb',
  'FlavorPickerModal',
];

describe('Home route — legacy tree is React.lazy-loaded, not statically imported (RC-1 P2-7)', () => {
  it('React.lazy-loads HomeScreenLegacy via a dynamic import, wrapped in Suspense', () => {
    expect(INDEX_CODE).toContain("React.lazy(() => import('./HomeScreenLegacy'))");
    expect(INDEX_CODE).toMatch(/<React\.Suspense[\s>]/);
  });

  it('still branches on spec_home (a ternary), rendering the lazy legacy component on the else side', () => {
    expect(INDEX_CODE).toMatch(/specHome\s*\?/);
    expect(INDEX_CODE).toContain('<LazyHomeScreenLegacy');
  });

  it('keeps the V2 path a normal, untouched, eager static import', () => {
    expect(INDEX_CODE).toContain("import { HomeScreenV2 } from '@/components/home/HomeScreenV2';");
    expect(INDEX_CODE).toMatch(/<HomeScreenV2\s*\/>/);
  });

  it.each(HEAVY_LEGACY_COMPONENTS)(
    'no longer statically imports %s in index.tsx (moved to the lazy module)',
    (name) => {
      expect(INDEX_CODE).not.toContain(`import { ${name} }`);
    },
  );

  it.each(HEAVY_LEGACY_COMPONENTS)(
    'HomeScreenLegacy.tsx still imports %s — nothing dropped in the move',
    (name) => {
      expect(LEGACY_SOURCE).toContain(`import { ${name}`);
    },
  );

  // `CommandConsole` is imported but was ALREADY unused JSX-wise before this
  // move (only referenced in a comment, above the `styles.coachWrapper`
  // definition) — a pre-existing dead import, carried over verbatim per the
  // fix's "do not delete anything" mandate. Every other heavy component IS
  // rendered, so this is checked separately rather than loosening the
  // render assertion for all ten.
  it.each(HEAVY_LEGACY_COMPONENTS.filter((n) => n !== 'CommandConsole'))(
    'HomeScreenLegacy.tsx still renders %s in JSX — nothing dropped in the move',
    (name) => {
      expect(LEGACY_SOURCE).toMatch(new RegExp(`<${name}[\\s/>]`));
    },
  );

  it('HomeScreenLegacy.tsx exports a default component — the shape React.lazy requires', () => {
    expect(LEGACY_SOURCE).toMatch(/export default function HomeScreenLegacy\s*\(/);
  });
});
