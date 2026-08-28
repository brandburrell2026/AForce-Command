/**
 * Golden-invariant locks — client (Wave-4 Part 15).
 *
 * A census of the 16 AForce OS golden invariants found five that were
 * unlocked or only half-locked. This file closes the CLIENT side of them.
 * Each block states the invariant it pins and why it is pinned this way.
 *
 *  INVARIANT 1 — "HydroState only changes from approved completed hydration
 *    behavior." Previously enforced by a DENYLIST on two files. A denylist
 *    can only catch the offenders someone already thought of, so this adds
 *    the ALLOWLIST half: the set of production modules that can produce or
 *    commit a score number is enumerated and pinned. A new caller fails.
 *
 *  INVARIANT 3 — "Moments cannot change HydroState." Only exposure locks
 *    existed (Moments reads the score). This adds the MUTATION half.
 *
 *  INVARIANT 4 — "Activity cannot change HydroState." Activity is an input
 *    to DEPLETION, never a source of credit. Locked BEHAVIOURALLY against
 *    the real engine (calling it is fine; editing it is forbidden) because
 *    the failure mode here is arithmetic, not an import.
 *
 *  INVARIANT 5 — "A purchase can never change HydroState." Nothing guarded
 *    this anywhere. The commerce surface is currently clean; this pins that.
 *
 *  INVARIANT 14 — "Fabricated social data cannot ship in production."
 *    CONSTRAINED: the Circle V3 ranked cohort in `mocks/competitionData.ts`
 *    is sample data BY DESIGN under a standing founder ruling (PR #712 —
 *    a previous substitution of that cohort was explicitly REVERSED). So
 *    this lock enforces CONFINEMENT + DISCLOSURE, never absence.
 *
 * Why static source scans: four of these five invariants are about code that
 * must NOT exist. A runtime test can only observe the paths it happens to
 * execute, so it proves nothing about a path added next quarter. Reading the
 * source text off disk and pinning the exact set of participating modules
 * fails the moment someone adds a sixth one — which is the whole point.
 *
 * RN-free: the scan blocks import nothing from the app. The one behavioural
 * block imports the real scoring engine (i18n mocked, per the convention in
 * `commandEvidence.test.ts` — i18nService is the only react-native import in
 * the calculateScore graph).
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // utils/__tests__
const PKG = resolve(HERE, '..', '..'); // artifacts/aforce-os

/**
 * Production source roots. `demo/` (the dev-only Screen Gallery, already
 * guarded by demo/__tests__/galleryFixtures.guard.test.ts), `assets/`,
 * `docs/`, `governance/`, `scripts/` and `dist/` are deliberately absent —
 * none of them ship inside the app's runtime module graph.
 */
const PRODUCTION_DIRS = [
  'analytics',
  'app',
  'components',
  'config',
  'constants',
  'data',
  'featureFlags',
  'hooks',
  'lib',
  'screens',
  'server',
  'services',
  'store',
  'theme',
  'types',
  'utils',
];

const SKIP_DIR_NAMES = new Set(['__tests__', '__mocks__', 'node_modules', 'dist']);
const SOURCE_EXT = /\.(ts|tsx)$/;

/** Any bare / relative / `@/`-aliased import or require specifier. */
const IMPORT_SPECIFIER_RE = /(?:from|require\()\s*['"]([^'"]+)['"]/g;

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // directory doesn't exist — nothing to scan
  }
  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectSourceFiles(full, out);
    else if (SOURCE_EXT.test(entry)) out.push(full);
  }
  return out;
}

const PRODUCTION_FILES = PRODUCTION_DIRS.flatMap((d) => collectSourceFiles(join(PKG, d)));

function rel(file: string): string {
  return relative(PKG, file).split('\\').join('/');
}

/**
 * Absolute path an import specifier points at, or null for a bare package
 * specifier. Resolved rather than string-matched so `mocks/` can never be
 * confused with e.g. a `__mocks__` folder or a package named "…mocks".
 */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) return resolve(PKG, specifier.slice(2));
  if (specifier.startsWith('.')) return resolve(dirname(fromFile), specifier);
  return null;
}

function specifiersOf(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  return [...src.matchAll(IMPORT_SPECIFIER_RE)].map((m) => m[1]);
}

/** Files under `dir` (package-relative), sorted, as `rel()` paths. */
function filesUnder(dirRel: string): string[] {
  return collectSourceFiles(join(PKG, dirRel)).map(rel).sort();
}

// A sanity floor on every scan: a broken path join would otherwise make each
// "no offenders" assertion below pass vacuously.
describe('golden-invariant scan integrity', () => {
  it('walks the production tree', () => {
    expect(PRODUCTION_FILES.length).toBeGreaterThan(300);
  });
});

// ─── INVARIANT 5 — a purchase can never change HydroState ─────────────────
//
// Commerce is a money path. It may READ the score (a paywall can show your
// state) but must never reach the code that produces or commits one: no
// scoring engine import, no score-mutating store action. Buying a product
// is not hydration behaviour.

describe('INVARIANT 5 — purchase → HydroState isolation (client)', () => {
  const COMMERCE_MODULES = [
    ...filesUnder('components/cart'),
    ...filesUnder('components/subscription'),
    'services/subscriptionService.ts',
  ];

  /** Score-PRODUCING modules commerce may not reach. */
  const SCORE_ENGINE_PATHS = [
    resolve(PKG, 'utils/scoringEngine'),
    resolve(PKG, 'utils/scoring'),
  ];

  /**
   * Score-MUTATING store actions. Note `useAppStore` itself is NOT forbidden:
   * both subscription screens legitimately READ `state` from it to render the
   * current plan. Reading is exposure; only these three commit a new score.
   */
  const SCORE_MUTATING_ACTIONS = ['logIntake', 'confirmCommand', 'completeCycle'];

  it('has commerce modules to scan', () => {
    expect(COMMERCE_MODULES.length).toBeGreaterThanOrEqual(4);
  });

  it('no commerce module imports the scoring engine', () => {
    const offenders: string[] = [];
    for (const relPath of COMMERCE_MODULES) {
      const file = join(PKG, relPath);
      for (const spec of specifiersOf(file)) {
        const target = resolveSpecifier(file, spec);
        if (!target) continue;
        if (SCORE_ENGINE_PATHS.some((p) => target === p || target.startsWith(p + '/'))) {
          offenders.push(`${relPath} -> ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no commerce module invokes a score-mutating store action', () => {
    const offenders: string[] = [];
    for (const relPath of COMMERCE_MODULES) {
      const src = readFileSync(join(PKG, relPath), 'utf8');
      for (const action of SCORE_MUTATING_ACTIONS) {
        if (new RegExp(`\\b${action}\\b`).test(src)) offenders.push(`${relPath} :: ${action}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ─── INVARIANT 3 — Moments cannot change HydroState ───────────────────────
//
// Moments are calendar-shaped PREPARATION. They read your state to decide
// what to say; nothing a Moment does is completed hydration behaviour, so
// nothing under components/moments/ may produce or commit a score. Mirrors
// the static-isolation lock in services/__tests__/hydroScanHistory.test.ts.

describe('INVARIANT 3 — Moments → HydroState mutation isolation', () => {
  const MOMENT_MODULES = filesUnder('components/moments');

  it('has moment modules to scan', () => {
    expect(MOMENT_MODULES.length).toBeGreaterThanOrEqual(10);
  });

  it('no Moments module imports the scoring engine', () => {
    const scorePaths = [resolve(PKG, 'utils/scoringEngine'), resolve(PKG, 'utils/scoring')];
    const offenders: string[] = [];
    for (const relPath of MOMENT_MODULES) {
      const file = join(PKG, relPath);
      for (const spec of specifiersOf(file)) {
        const target = resolveSpecifier(file, spec);
        if (!target) continue;
        if (scorePaths.some((p) => target === p || target.startsWith(p + '/'))) {
          offenders.push(`${relPath} -> ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no Moments module dispatches or invokes a score-mutating action', () => {
    const offenders: string[] = [];
    for (const relPath of MOMENT_MODULES) {
      const src = readFileSync(join(PKG, relPath), 'utf8');
      for (const marker of ['logIntake', 'confirmCommand', 'completeCycle', 'calculateScore']) {
        if (new RegExp(`\\b${marker}\\b`).test(src)) offenders.push(`${relPath} :: ${marker}`);
      }
      if (/\bdispatch\s*\(/.test(src)) offenders.push(`${relPath} :: dispatch()`);
    }
    expect(offenders).toEqual([]);
  });
});

// ─── INVARIANT 1 — only approved completed hydration behaviour ────────────
//
// The positive half of the invariant. Two enumerated sets, both pinned:
//   (a) who can COMPUTE a score  — importers of `calculateScore`
//   (b) who can COMMIT a score   — dispatchers of a score-bearing action
// Adding a module to either set is a deliberate act that must be reviewed,
// so the test names the exact set rather than describing a shape.

describe('INVARIANT 1 — the score-writing surface is a closed set', () => {
  /**
   * Modules importing `calculateScore` from the engine.
   *   - services/realApi.ts      — the offline/local scoring path behind the
   *                                intake + confirm endpoints.
   *   - store/app/actions.ts     — logIntake / confirmCommand / biometrics.
   *   - store/useAppStore.tsx    — cold-start seed only (aliased `_initialOnly`).
   * `utils/scoringEngine.ts` is the DEFINITION, not an importer.
   */
  const SCORE_COMPUTE_ALLOWLIST = [
    'services/realApi.ts',
    'store/app/actions.ts',
    'store/useAppStore.tsx',
  ];

  /** Reducer actions whose payload replaces userState and/or engineOutput. */
  const SCORE_BEARING_ACTIONS = [
    'CYCLE_SUCCESS',
    'CONFIRM_COMMAND',
    'SET_USER_STATE',
    'REFRESH_ENGINE',
    'SET_APPLE_HEALTH',
    'SET_PROVIDER_BIOMETRICS',
  ];

  const SCORE_COMMIT_ALLOWLIST = ['store/app/actions.ts', 'store/useAppStore.tsx'];

  it('exactly these modules import calculateScore', () => {
    // Matches a named-import clause containing `calculateScore`, with or
    // without an `as` alias — so `calculateScore as _initialOnly` counts.
    const NAMED_IMPORT_RE = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g;
    const actual: string[] = [];
    for (const file of PRODUCTION_FILES) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(NAMED_IMPORT_RE)) {
        if (/\bcalculateScore\b/.test(m[1])) {
          actual.push(rel(file));
          break;
        }
      }
    }
    expect(actual.sort()).toEqual([...SCORE_COMPUTE_ALLOWLIST].sort());
  });

  it('exactly these modules dispatch a score-bearing action', () => {
    const actual = new Set<string>();
    for (const file of PRODUCTION_FILES) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/dispatch\s*\(/g)) {
        // The action literal always sits inside the dispatched object
        // expression; a fixed window keeps this a text scan (no parser)
        // while still spanning the multi-line payloads in actions.ts.
        const window = src.slice(m.index, m.index + 300);
        if (SCORE_BEARING_ACTIONS.some((t) => window.includes(`'${t}'`) || window.includes(`"${t}"`))) {
          actual.add(rel(file));
        }
      }
    }
    expect([...actual].sort()).toEqual([...SCORE_COMMIT_ALLOWLIST].sort());
  });
});

// ─── INVARIANT 14 — fabricated social data cannot ship (confined) ─────────
//
// STANDING FOUNDER RULING (PR #712): the ranked cohort in
// mocks/competitionData.ts is sample data BY DESIGN until a /v1/competition
// backend exists. An earlier substitution of that cohort was REVERSED. So
// the enforceable invariant is not "no sample data" — it is:
//   (a) CONFINEMENT: the set of production modules that can reach `mocks/`
//       is closed, so sample data cannot spread to a new surface silently;
//   (b) DISCLOSURE: the surface that renders the cohort labels it as sample
//       data, so a rank is never presented as a real measurement.

describe('INVARIANT 14 — sample social data is confined and disclosed', () => {
  /**
   * Every production importer of `mocks/`, with the surface each one feeds.
   * A NEW entry means a new surface is showing sample data, which is a
   * founder decision, not a refactor.
   *
   * Note this is the REAL set, which is wider than the Circle cohort alone:
   * the two Guardian/Heat screens also read `mocks/heatData`. They are
   * listed because confinement is only meaningful if the list is complete.
   */
  const MOCK_IMPORT_ALLOWLIST = [
    'components/Leaderboard.tsx', // CURRENT_USER_KEY — which row is "you"
    'screens/GuardianHeatScreen.tsx', // mocks/heatData roster + alert feed
    'screens/HeatRiskScreen.tsx', // mocks/heatData sample inputs
    'services/competitionEngine.ts', // the ranked cohort itself
    // (services/videoEngine.ts retired with the legacy-Home orphan tree —
    // mocks/videoLibrary died with it.)
  ];

  it('exactly these production modules import from mocks/', () => {
    const MOCKS_DIR = join(PKG, 'mocks');
    const actual = new Set<string>();
    for (const file of PRODUCTION_FILES) {
      for (const spec of specifiersOf(file)) {
        const target = resolveSpecifier(file, spec);
        if (target && (target === MOCKS_DIR || target.startsWith(MOCKS_DIR + '/'))) {
          actual.add(rel(file));
        }
      }
    }
    expect([...actual].sort()).toEqual([...MOCK_IMPORT_ALLOWLIST].sort());
  });

  it('the Circle V3 cohort surface carries a non-empty sample-data caption', () => {
    const en = JSON.parse(readFileSync(join(PKG, 'locales/en.json'), 'utf8')) as {
      community?: { v3?: Record<string, string> };
    };
    const caption = en.community?.v3?.['sample_note'];
    expect(typeof caption, 'community.v3.sample_note must exist in locales/en.json').toBe('string');
    expect((caption ?? '').trim().length).toBeGreaterThan(0);

    // …and the screen must actually render it. A caption key nobody reads
    // is not disclosure.
    const screen = readFileSync(join(PKG, 'components/community/CircleScreenV3.tsx'), 'utf8');
    expect(screen).toContain('community.v3.sample_note');
  });
});

// ─── INVARIANT 4 — activity cannot change HydroState ──────────────────────
//
// Behavioural, not structural: activity IS wired into the engine (it raises
// the depletion rate and the context/output-stress penalties), so an import
// scan would say nothing. What must never be true is that moving more EARNS
// score. With intake and every other input held byte-identical, raising
// activity — via the manual axis or via a provider's step count — must never
// raise the number.

vi.mock('../../services/i18nService', () => ({
  default: { t: (k: string) => k, language: 'en', changeLanguage: () => {} },
}));

describe('INVARIANT 4 — raising activity never raises the score', () => {
  const MIN = 60_000;
  const NOW = 1_700_000_000_000;

  function baseState(over: Record<string, unknown> = {}) {
    return {
      intakeEvents: [],
      unitsConsumedToday: 5,
      ozConsumedToday: 48,
      aforceUnitsToday: 1,
      ozTarget: 96,
      dailyTarget: 8,
      lastIntakeTime: new Date(NOW - 45 * MIN),
      lastIntakeType: 'water',
      symptomState: 'none',
      symptoms: [],
      urineSignal: 3,
      energyState: 'steady',
      heatLoad: 4,
      sweatRate: 3,
      activityLevel: 0,
      complianceStreak: 2,
      isSnoozed: false,
      snoozeUntil: null,
      bodyWeightLbs: 180,
      isAwake: true,
      wakeTime: new Date(NOW - 6 * 60 * MIN),
      overnightLossOz: 0,
      hasSeenMorningCommand: true,
      weatherTempC: null,
      weatherHumidity: null,
      weatherFetchedAt: null,
      ...over,
    };
  }

  /**
   * Backgrounds the activity sweep is run against. One base state would only
   * prove the invariant on one point of the surface — a rewarding branch could
   * hide behind a symptom, a streak, or a depleted starting score.
   */
  const BACKGROUNDS: Array<[string, Record<string, unknown>]> = [
    ['baseline', {}],
    ['depleted / long gap', { ozConsumedToday: 8, unitsConsumedToday: 1, lastIntakeTime: new Date(NOW - 5 * 60 * MIN) }],
    ['well hydrated / fresh', { ozConsumedToday: 96, unitsConsumedToday: 9, lastIntakeTime: new Date(NOW - 5 * MIN) }],
    ['symptomatic', { symptomState: 'moderate', symptoms: ['headache'], urineSignal: 6 }],
    ['long compliance streak', { complianceStreak: 21 }],
    ['hot + heavy sweat', { heatLoad: 9, sweatRate: 8, weatherTempC: 34, weatherHumidity: 70 }],
  ];

  it.each(BACKGROUNDS)('the manual activity axis is non-rewarding (0 → 10) — %s', async (_label, background) => {
    const { calculateScore } = await import('../scoringEngine');
    const scores = Array.from({ length: 11 }, (_unused, activityLevel) =>
      calculateScore(baseState({ ...background, activityLevel }) as never, NOW).score,
    );
    for (let i = 1; i < scores.length; i += 1) {
      expect(
        scores[i],
        `activityLevel ${i} scored ${scores[i]} vs ${scores[i - 1]} at ${i - 1} — activity must never earn score`,
      ).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it('the activity sweep actually moves the number (the lock is not vacuous)', async () => {
    const { calculateScore } = await import('../scoringEngine');
    const at = (activityLevel: number) => calculateScore(baseState({ activityLevel }) as never, NOW).score;
    expect(at(10)).toBeLessThan(at(0));
  });

  it('provider step count is monotonically non-rewarding (same provider, steps only)', async () => {
    const { calculateScore } = await import('../scoringEngine');
    // One provider, one field varied. Comparing "no biometrics" against
    // "biometrics present" would change two things at once; holding the
    // snapshot fixed and moving only stepsToday isolates activity.
    const stepLadder = [0, 2000, 5000, 7500, 10000, 15000, 25000];
    const scores = stepLadder.map(
      (stepsToday) =>
        calculateScore(
          baseState({
            activityLevel: 0,
            biometrics: {
              apple_health: { providerId: 'apple_health', stepsToday, fetchedAt: NOW },
            },
          }) as never,
          NOW,
        ).score,
    );
    for (let i = 1; i < scores.length; i += 1) {
      expect(
        scores[i],
        `${stepLadder[i]} steps scored ${scores[i]} vs ${scores[i - 1]} at ${stepLadder[i - 1]} steps`,
      ).toBeLessThanOrEqual(scores[i - 1]);
    }
    expect(scores[scores.length - 1]).toBeLessThan(scores[0]);
  });

  it('a step count below the manual axis cannot pull the score UP toward it', async () => {
    const { calculateScore } = await import('../scoringEngine');
    // The provider signal is a FLOOR on the activity axis, never a ceiling:
    // a sedentary step count must not undo a high manual setting.
    const manualOnly = calculateScore(baseState({ activityLevel: 9 }) as never, NOW).score;
    const withLowSteps = calculateScore(
      baseState({
        activityLevel: 9,
        biometrics: { apple_health: { providerId: 'apple_health', stepsToday: 500, fetchedAt: NOW } },
      }) as never,
      NOW,
    ).score;
    expect(withLowSteps).toBeLessThanOrEqual(manualOnly);
  });
});
