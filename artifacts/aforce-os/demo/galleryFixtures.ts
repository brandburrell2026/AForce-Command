/**
 * demo/galleryFixtures.ts — deterministic store snapshots for the P0 Screen
 * Gallery (`demo/AForceScreenGallery.tsx`), per the audit's P0 phase
 * (`docs/ui/AFORCE_OS_VISUAL_AUDIT.md` §8): "a deterministic screen gallery
 * rendering the shipped …ScreenV2 surfaces in fixed states for side-by-side
 * diffing against the refs."
 *
 * HARD RULES for this file:
 *   1. Dev/demo-only. The guard below throws at import time outside
 *      `__DEV__` / `EXPO_PUBLIC_DEMO_MODE`, so it can never ship live in a
 *      production bundle. Covered by `demo/__tests__/galleryFixtures.guard.test.ts`.
 *   2. Every fixture is built by composing REAL, exported building blocks —
 *      `defaultUserState`, `DEFAULT_FLAGS`, `defaultSubscription()`,
 *      `DEFAULT_NOTIFICATION_SETTINGS`, `DEFAULT_UNIT_PREFERENCES`,
 *      `DEFAULT_PROFILE_IDENTITY`, `Colors.states.*`, `RecoveryCommandState` —
 *      never a parallel scoring/eligibility/entitlement formula. Nothing
 *      here calls into `utils/scoringEngine.ts` or `theme/statusColor.ts`;
 *      `ScoreEngineOutput` fixtures are hand-built literal objects (the same
 *      pattern `store/__tests__/_fixtures.ts` already uses for reducer
 *      tests), landing in the documented bands (PEAK 90-100 / BALANCED
 *      75-89 / RECOVERING 60-74 / DEPLETED 0-59 — see
 *      `utils/scoringEngine.ts`'s header comment, read-only).
 *   3. Isolation: nothing under `screens/ hooks/ services/ store/` may
 *      import this module (enforced by the guard test's static scan).
 */

import type {
  AppState as StoreAppState,
} from '../store/appStoreTypes';
import type {
  ScoreEngineOutput,
  UserState,
  IntakeEvent,
  FeatureFlags,
  FluidType,
  JournalRollup,
} from '../types';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../types';
import type { UserSubscription, SubscriptionStatus } from '../types/subscription';
import type { RecoveryCommand, RecoveryCommandState } from '../utils/recovery/recoveryCommand';
import type { WeeklyV3Inputs } from '../components/insights/weeklyV3Presentation';
import type { CircleV3Inputs } from '../components/community/circleV3Presentation';
import { buildSnapshot } from '../services/competitionEngine';
import type { Moment } from '../types/moments';
import { buildDemoMoments } from '../data/demoMoments';
import type { AnalyticsEvent } from '../utils/analytics/metrics';
import type { PerformanceAgeResult } from '../utils/performanceAge';

import { defaultUserState, mockHistory } from '../data/mockData';
import { DEFAULT_FLAGS } from '../featureFlags/flags';
import { defaultSubscription } from '../services/subscriptionService';
import { DEFAULT_UNIT_PREFERENCES } from '../utils/units';
import { DEFAULT_PROFILE_IDENTITY } from '../utils/profileIdentity';
import { Colors } from '../theme/colors';
import { DEMO_MODE } from '../services/demoMode';

// ─── Production guard ────────────────────────────────────────────────────
// Belt-and-suspenders with the route-level check in `app/(hidden)/gallery.tsx`
// (which lazy-loads the gallery — and transitively this module — only AFTER
// the same __DEV__/DEMO_MODE check passes, so this line never executes on a
// normal production launch). If anything else ever imports this module
// outside dev/demo — a stray import, a future refactor mistake — it fails
// loudly at import time instead of silently shipping demo fixtures.
declare const __DEV__: boolean | undefined;
const isDevRuntime = typeof __DEV__ !== 'undefined' && __DEV__ === true;
if (!isDevRuntime && !DEMO_MODE) {
  throw new Error(
    '[AForce] demo/galleryFixtures.ts is dev/demo-only and must never be ' +
      'imported in a production build. Gate every import behind __DEV__ or ' +
      'EXPO_PUBLIC_DEMO_MODE — see app/(hidden)/gallery.tsx.',
  );
}

// ─── Viewport presets (spec: iPhone SE / Standard / Large) ───────────────
export interface GalleryViewport {
  id: 'se' | 'standard' | 'large';
  label: string;
  width: number;
  height: number;
}

export const GALLERY_VIEWPORTS: readonly GalleryViewport[] = [
  { id: 'se', label: 'iPhone SE', width: 375, height: 667 },
  { id: 'standard', label: 'Standard', width: 390, height: 844 },
  { id: 'large', label: 'Large', width: 430, height: 932 },
];

// ─── Fixture shape ─────────────────────────────────────────────────────────

export type GallerySurface =
  | 'home'
  | 'hydration'
  | 'signal'
  | 'weekly'
  | 'circle'
  | 'moments'
  | 'momentDetail'
  | 'recoveryCoach'
  | 'guardian'
  | 'calibration'
  | 'activation'
  | 'permissions';

export interface GalleryFixture {
  /** Stable, kebab-case id — used as the React key + deep-link-ish selector. */
  id: string;
  /** Short list label, e.g. "Home — Depleted". */
  label: string;
  /** One-line note on exactly which fields drive this state. */
  driver: string;
  surface: GallerySurface;
  /**
   * Full store snapshot for surfaces driven by `useAppStore()` /
   * `useEngineSlice()` etc. (home, hydration, guardian, activation).
   * Omitted for prop-driven surfaces (recoveryCoach, calibration) and the
   * primitives-composed approximation (permissions).
   */
  appState?: StoreAppState;
  /**
   * Prop-driven rollups for the 'signal' surface (PerformanceSignalV3's
   * fixtureRollups prop) — server-shaped JournalRollup sample days. The
   * component skips the network entirely when these are provided.
   */
  rollups?: JournalRollup[];
  /**
   * Prop-driven inputs for the 'weekly' surface (WeeklyReportV3's fixture
   * prop) — a full deterministic WeeklyV3Inputs. The component skips every
   * live source (analytics, rollups, ledger, PA hook) when provided.
   */
  weeklyInputs?: WeeklyV3Inputs;
  /**
   * Prop-driven inputs for the 'circle' surface (CircleScreenV3's fixture
   * prop) — skips every live source. The ranked cohort is the deterministic
   * competitionEngine snapshot over the sample roster (founder comp
   * 2026-08-12), with a fixed live-injected "You" row.
   */
  circleInputs?: CircleV3Inputs;
  /**
   * Prop-driven inputs for the 'moments'/'momentDetail' surfaces —
   * deterministic sample moments built around a FIXED nowIso so the
   * comp's active-prep states reproduce exactly.
   */
  momentsFixture?: { moments: Moment[]; nowIso: string; detailId?: string };
  /** For `recoveryCoach`: the exact prop fixture RecoveryCoachScreen takes. */
  recoveryCommand?: RecoveryCommand;
  /** For `recoveryCoach`: mirrors the screen's real `offline` prop. */
  offline?: boolean;
  /**
   * Set only when this fixture is the *closest available* approximation of
   * the requested state rather than a first-class existing representation —
   * surfaced verbatim in the gallery UI and the companion doc so nobody
   * mistakes it for a faithful reference.
   */
  limitation?: string;
}

// ─── Shared builders (compose real defaults; never fabricate new logic) ───

function baseFlags(overrides: Partial<FeatureFlags> = {}): FeatureFlags {
  return { ...DEFAULT_FLAGS, ...overrides };
}

function baseUserState(overrides: Partial<UserState> = {}): UserState {
  return { ...defaultUserState, ...overrides };
}

function makeIntakeEvent(overrides: Partial<IntakeEvent> & { id: string; fluidType: FluidType; oz: number; loggedAt: Date }): IntakeEvent {
  return {
    baseImpact: overrides.oz,
    capAdjusted: overrides.oz,
    immediate: overrides.oz,
    delayed: 0,
    delayedDurationMin: 0,
    heatGuardActiveAtLog: false,
    scoreBeforeAtLog: 70,
    ...overrides,
  };
}

/** Full `AppState` scaffold shared by every store-driven fixture. */
function baseAppState(overrides: Partial<StoreAppState> = {}): StoreAppState {
  const userState = overrides.userState ?? baseUserState();
  const engineOutput = overrides.engineOutput ?? balancedEngine();
  return {
    userState,
    engineOutput,
    history: mockHistory,
    lastCycleResult: null,
    isCompletingCycle: false,
    showCycleSuccess: false,
    timerSeconds: engineOutput.riskTimer.minutes * 60,
    pendingConfirmation: false,
    featureFlags: baseFlags(),
    subscription: defaultSubscription(),
    lastIntakeBurstAt: 0,
    hasSeenOnboarding: true,
    notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
    unitPreferences: DEFAULT_UNIT_PREFERENCES,
    profileIdentity: DEFAULT_PROFILE_IDENTITY,
    ...overrides,
  };
}

// ─── Hand-built ScoreEngineOutput fixtures — one per band actually used ───
// Shape mirrors `store/__tests__/_fixtures.ts::makeEngine()`. Literal, not
// derived from `calculateScore` — this file must never import
// `utils/scoringEngine.ts` (off-limits-adjacent; see header).

function depletedEngine(): ScoreEngineOutput {
  const score = 38; // DEPLETED band: 0-59
  return {
    score,
    performanceState: {
      level: 'DEPLETED',
      score,
      color: Colors.states.DEPLETED.primary,
      glowColor: Colors.states.DEPLETED.glow,
      urgency: 'critical',
      pulseSpeed: 'rapid',
      animationStyle: 'tension',
    },
    pulseConfig: {
      pulseState: 'DEPLETED',
      pulseIntensity: 0.9,
      pulseSpeed: 0.9,
      glowStrength: 0.8,
      waveBehavior: 'collapsing',
      colorMode: 'red',
      deltaMode: 'falling',
      animations: { burstOnIntake: true, flareOnPeak: false, collapseOnDepletion: true },
    },
    reasons: [
      { id: 'low-intake', text: 'Well below today’s target', weight: 'negative' },
      { id: 'heat-load', text: 'Heat load is elevated', weight: 'negative' },
    ],
    riskTimer: { minutes: 8, seconds: 0, urgency: 'critical' },
    command: {
      id: 'gallery-cmd-depleted',
      action: 'Drink 20oz water now',
      explanation: 'Score is in the depleted band — water first, recheck in 15.',
      urgencyLevel: 'critical',
      estimatedImpact: '+14 score',
      confidence: 'high',
    },
    breakdown: [
      { id: 'intake', label: 'Intake', delta: -18, maxMagnitude: 20, hint: 'Low volume today' },
      { id: 'heat', label: 'Heat load', delta: -9, maxMagnitude: 20, hint: 'Elevated heat load' },
    ],
    prediction: { decayPerMinute: 0.9, minutesToDepleted: null, label: 'Already depleted' },
    social: null,
  };
}

function balancedEngine(): ScoreEngineOutput {
  const score = 76; // BALANCED band: 75-89 — matches data/mockData.ts's tuned default
  return {
    score,
    performanceState: {
      level: 'BALANCED',
      score,
      color: Colors.states.BALANCED.primary,
      glowColor: Colors.states.BALANCED.glow,
      urgency: 'moderate',
      pulseSpeed: 'medium',
      animationStyle: 'pulse',
    },
    pulseConfig: {
      pulseState: 'BALANCED',
      pulseIntensity: 0.6,
      pulseSpeed: 0.5,
      glowStrength: 0.5,
      waveBehavior: 'steady_outward',
      colorMode: 'teal',
      deltaMode: 'steady',
      animations: { burstOnIntake: true, flareOnPeak: false, collapseOnDepletion: false },
    },
    reasons: [{ id: 'on-track', text: 'Tracking well against target', weight: 'positive' }],
    riskTimer: { minutes: 20, seconds: 0, urgency: 'medium' },
    command: {
      id: 'gallery-cmd-balanced',
      action: 'Drink 12oz water',
      explanation: 'Stay ahead of the curve — recheck in 20.',
      urgencyLevel: 'medium',
      estimatedImpact: '+8 score',
      confidence: 'high',
    },
    breakdown: [
      { id: 'intake', label: 'Intake', delta: 6, maxMagnitude: 20, hint: 'Good pace today' },
    ],
    prediction: { decayPerMinute: 0.4, minutesToDepleted: 95, label: 'Stable' },
    social: null,
  };
}

/** Very low score used only to feed `guardianRiskScore()` past the CRITICAL
 * threshold (>=75) inside `app/guardian.tsx` — see that screen's own
 * `guardianRiskScore({ hydrationPercent: state.engineOutput.score, ... })`
 * call (read-only consume of `utils/scoring/recommendations.ts`, re-exported
 * by `utils/scoringEngine.ts`; nothing here reimplements that formula). */
function guardianRiskEngine(): ScoreEngineOutput {
  const score = 8;
  return {
    score,
    performanceState: {
      level: 'DEPLETED',
      score,
      color: Colors.states.DEPLETED.primary,
      glowColor: Colors.states.DEPLETED.glow,
      urgency: 'critical',
      pulseSpeed: 'rapid',
      animationStyle: 'tension',
    },
    pulseConfig: {
      pulseState: 'DEPLETED',
      pulseIntensity: 0.95,
      pulseSpeed: 0.95,
      glowStrength: 0.85,
      waveBehavior: 'collapsing',
      colorMode: 'red',
      deltaMode: 'falling',
      animations: { burstOnIntake: false, flareOnPeak: false, collapseOnDepletion: true },
    },
    reasons: [{ id: 'critical', text: 'Critical dehydration risk', weight: 'negative' }],
    riskTimer: { minutes: 3, seconds: 0, urgency: 'critical' },
    command: {
      id: 'gallery-cmd-guardian-risk',
      action: 'Pull from activity — rehydrate immediately',
      explanation: 'Guardian risk is critical.',
      urgencyLevel: 'critical',
      estimatedImpact: '+22 score',
      confidence: 'high',
    },
    breakdown: [],
    prediction: { decayPerMinute: 1.1, minutesToDepleted: null, label: 'Critical' },
    social: null,
  };
}

function healthyGuardianEngine(): ScoreEngineOutput {
  const score = 82;
  return {
    ...balancedEngine(),
    score,
    performanceState: { ...balancedEngine().performanceState, score },
  };
}

// ─── RecoveryCommand fixtures (RecoveryCoachScreen prop-driven surface) ───

export const GALLERY_NOW = new Date('2026-08-01T15:00:00.000Z');

function recoveryCommand(
  state: RecoveryCommandState,
  overrides: Partial<RecoveryCommand> = {},
): RecoveryCommand {
  const createdAt = new Date(GALLERY_NOW.getTime() - 5 * 60 * 1000).toISOString();
  const recheckAt = new Date(GALLERY_NOW.getTime() + 10 * 60 * 1000).toISOString();
  const expiresAt = new Date(GALLERY_NOW.getTime() + 30 * 60 * 1000).toISOString();
  return {
    id: `gallery-recovery-${state}`,
    state,
    title: 'Start with water',
    instruction: 'Drink 20 oz. Recheck in 15 minutes.',
    primaryActionLabel: "I've had the water",
    quantity: { value: 20, unit: 'oz' },
    recheckAt,
    rationale: 'Recovery window is open. Ease in — 20 oz now keeps you ahead.',
    sourceVersion: 'gallery-fixture@1',
    createdAt,
    expiresAt,
    ...overrides,
  };
}

// ─── The 13 deterministic states ──────────────────────────────────────────

export const GALLERY_FIXTURES: readonly GalleryFixture[] = [
  {
    id: 'home-depleted',
    label: 'Home — Depleted',
    driver: 'engineOutput.score=38 (DEPLETED band, 0-59) + userState low-intake/high-heat overrides; flags.spec_home=true',
    surface: 'home',
    appState: baseAppState({
      userState: baseUserState({
        unitsConsumedToday: 1,
        aforceUnitsToday: 0,
        ozConsumedToday: 12,
        lastIntakeTime: new Date(GALLERY_NOW.getTime() - 3 * 60 * 60 * 1000),
        lastIntakeType: 'water',
        symptomState: 'moderate',
        symptoms: ['headache', 'fatigue'],
        urineSignal: 6,
        energyState: 'low',
        heatLoad: 8,
        sweatRate: 7,
        complianceStreak: 0,
      }),
      engineOutput: depletedEngine(),
      featureFlags: baseFlags({ spec_home: true }),
    }),
  },
  {
    id: 'home-balanced',
    label: 'Home — Balanced',
    driver: 'engineOutput.score=76 (BALANCED band, 75-89), the same tuned defaultUserState mockData ships; flags.spec_home=true',
    surface: 'home',
    appState: baseAppState({
      userState: baseUserState(),
      engineOutput: balancedEngine(),
      featureFlags: baseFlags({ spec_home: true }),
    }),
  },
  {
    id: 'hydration-empty',
    label: 'Hydration — Empty',
    driver: 'userState.intakeEvents=[] + ozConsumedToday=0 + complianceStreak=0; flags.spec_hydration=true',
    surface: 'hydration',
    appState: baseAppState({
      userState: baseUserState({
        intakeEvents: [],
        unitsConsumedToday: 0,
        aforceUnitsToday: 0,
        ozConsumedToday: 0,
        complianceStreak: 0,
      }),
      engineOutput: { ...balancedEngine(), score: 50 },
      featureFlags: baseFlags({ spec_hydration: true }),
    }),
  },
  {
    id: 'hydration-populated',
    label: 'Hydration — Populated',
    driver: 'userState.intakeEvents=[5 logged events across today] + ozConsumedToday=64; flags.spec_hydration=true',
    surface: 'hydration',
    appState: baseAppState({
      userState: baseUserState({
        intakeEvents: [
          makeIntakeEvent({ id: 'ie-1', fluidType: 'aforce_stick', oz: 16, loggedAt: new Date(GALLERY_NOW.getTime() - 30 * 60 * 1000) }),
          makeIntakeEvent({ id: 'ie-2', fluidType: 'water', oz: 12, loggedAt: new Date(GALLERY_NOW.getTime() - 2 * 60 * 60 * 1000) }),
          makeIntakeEvent({ id: 'ie-3', fluidType: 'aforce_rtd', oz: 16, loggedAt: new Date(GALLERY_NOW.getTime() - 4 * 60 * 60 * 1000) }),
          makeIntakeEvent({ id: 'ie-4', fluidType: 'water', oz: 8, loggedAt: new Date(GALLERY_NOW.getTime() - 6 * 60 * 60 * 1000) }),
          makeIntakeEvent({ id: 'ie-5', fluidType: 'aforce_stick', oz: 16, loggedAt: new Date(GALLERY_NOW.getTime() - 8 * 60 * 60 * 1000) }),
        ],
        unitsConsumedToday: 5,
        aforceUnitsToday: 3,
        ozConsumedToday: 68,
        complianceStreak: 5,
      }),
      engineOutput: balancedEngine(),
      featureFlags: baseFlags({ spec_hydration: true }),
    }),
  },
  {
    id: 'command-active',
    label: 'Command — Active',
    driver: "RecoveryCommand.state='active' passed directly as RecoveryCoachScreen's `command` prop (no store — the screen is pure props)",
    surface: 'recoveryCoach',
    recoveryCommand: recoveryCommand('active'),
  },
  {
    id: 'command-completed',
    label: 'Command — Completed',
    driver: "RecoveryCommand.state='complete' passed as RecoveryCoachScreen's `command` prop",
    surface: 'recoveryCoach',
    recoveryCommand: recoveryCommand('complete', {
      title: 'Command complete',
      instruction: 'You followed the water-first call. Nice work.',
      primaryActionLabel: 'Done',
    }),
  },
  {
    id: 'guardian-eligible',
    label: 'Guardian — Eligible (Alert)',
    driver: 'flags.guardian_intelligence_enabled=true + engineOutput.score=8 (drives guardianRiskScore() past the 75 CRITICAL threshold via app/guardian.tsx’s own hydrationPercent input — read-only consume of utils/scoring/recommendations.ts, not reimplemented here)',
    surface: 'guardian',
    appState: baseAppState({
      userState: baseUserState({ sweatRate: 8 }),
      engineOutput: guardianRiskEngine(),
      featureFlags: baseFlags({ guardian_intelligence_enabled: true, guardian_body_map_enabled: true }),
    }),
  },
  {
    id: 'guardian-not-eligible',
    label: 'Guardian — Not Eligible (Quiet)',
    driver: 'flags.guardian_intelligence_enabled=false — renders the real FeatureGate "DEMO LOCKED" quiet state; engineOutput.score=82 (healthy) so the gate is the only reason it’s hidden',
    surface: 'guardian',
    appState: baseAppState({
      userState: baseUserState(),
      engineOutput: healthyGuardianEngine(),
      featureFlags: baseFlags({ guardian_intelligence_enabled: false }),
    }),
  },
  {
    id: 'calibration-limited-data',
    label: 'Calibration — Limited Data',
    driver: 'VoiceCheckInOverlay mounted directly at its first step (no prior answers) — the screen is pure props/local state, no store',
    surface: 'calibration',
  },
  {
    id: 'offline',
    label: 'Offline',
    driver: "RecoveryCoachScreen's real `offline` prop set true, with a still-valid cached command (mirrors its documented 'Updated X min ago' cached-command path)",
    surface: 'recoveryCoach',
    recoveryCommand: recoveryCommand('acknowledged', {
      title: 'Water logged',
      instruction: "We'll recheck once you're back online.",
    }),
    offline: true,
  },
  {
    id: 'permission-denied',
    label: 'Permission Denied',
    driver: 'Composed from existing AF* primitives (AFEmptyState / AFErrorState) — no shipped screen renders a distinct OS-level "permission denied" state today',
    surface: 'permissions',
    limitation:
      'No existing …ScreenV2 renders a granular "permission denied" state. ' +
      'services/healthConnection.ts defines a `denied` ConnectionStatus, but ' +
      '(per its own header) "Build only. No UI … wires this module today" — ' +
      'the shipped Health Platforms card (ProfileScreenV2) only distinguishes ' +
      'flag-on/connected vs flag-off/not-connected, never a granular OS-denial. ' +
      'This fixture composes existing AF* primitives (AFEmptyState/AFErrorState) ' +
      'rather than fabricate a new screen or touch entitlement/permission logic. ' +
      'Camera-based permission surfaces (HydroScan) are excluded per the ' +
      'standing camera-dark-pending-legal hard limit.',
  },
  {
    id: 'activation-failure',
    label: 'Activation — Failure',
    driver: "subscription.status='past_due' (a real SubscriptionStatus value) rendered by ManageSubscriptionScreenV2's existing status pill (amber)",
    surface: 'activation',
    appState: baseAppState({
      subscription: { ...defaultSubscription(), status: 'past_due' as SubscriptionStatus },
    }),
  },
  {
    id: 'activation-success',
    label: 'Activation — Success',
    driver: "subscription.status='active' (defaultSubscription()'s own value) rendered by ManageSubscriptionScreenV2's existing status pill (green)",
    surface: 'activation',
    appState: baseAppState({
      subscription: { ...defaultSubscription(), status: 'active' as SubscriptionStatus },
    }),
  },
  {
    id: 'signal-week',
    label: 'Signal — Strong week',
    driver: 'fixtureRollups: 7 server-shaped JournalRollups (prop-driven; skips the network)',
    surface: 'signal',
    rollups: ([
      ['2026-07-26', 89, 126, 6, 55, 37],
      ['2026-07-27', 80, 112, 5, 22, 58],
      ['2026-07-28', 64, 82, 3, 4, 30],
      ['2026-07-29', 90, 130, 7, 62, 33],
      ['2026-07-30', 71, 96, 4, 12, 62],
      ['2026-07-31', 82, 118, 5, 28, 55],
      ['2026-08-01', 88, 124, 6, 52, 41],
    ] as const).map(([date, avgScore, oz, checks, pk, bal]) => ({
      date,
      snapshotsCount: checks,
      avgScore,
      minScore: Math.max(0, avgScore - 14),
      maxScore: Math.min(100, avgScore + 7),
      endOzConsumed: oz,
      endAforceUnits: 2,
      endUnitsConsumed: Math.round(oz / 12),
      endSodiumDelivered: 480,
      endSodiumLost: 390,
      endDeficitPct: Math.max(0, 100 - avgScore),
      pctTimePeak: pk,
      pctTimeBalanced: bal,
      pctTimeRecovering: Math.max(0, 100 - pk - bal - 5),
      pctTimeDepleted: 5,
    })) as JournalRollup[],
  },
  {
    id: 'weekly-review',
    label: 'Weekly — Week in Review',
    driver:
      'fixture: full WeeklyV3Inputs (prop-driven; skips analytics/rollups/ledger/PA hook) — nowISO 2026-08-11 → completed week Aug 2–8; 8-day PA series 47→44',
    surface: 'weekly',
    weeklyInputs: buildWeeklyReviewInputs(),
  },
  {
    id: 'circle-hub',
    label: 'Community — Ranked cohort',
    driver:
      "fixture: full CircleV3Inputs (prop-driven) — competitionEngine snapshot over the sample roster with a PEAK 'You' injected (score 92, streak-consistency 96), 5/7 hydration week, Rank tab",
    surface: 'circle',
    circleInputs: {
      // buildSnapshot is pure over the static sample roster → deterministic.
      snapshot: buildSnapshot({
        liveUserScore: 92,
        liveCompliance: 0.9,
        liveConsistency: 96,
        liveStateLabel: 'PEAK',
      }),
      cityOverride: null,
      hydrationDaysThisWeek: 5,
      tab: 'rank',
    },
  },
  {
    id: 'moments-day',
    label: 'Moments — Today',
    driver:
      "fixture: buildDemoMoments around fixed nowISO 2026-08-12T17:38Z — Investor Meeting in 22 min (active prep), completed Training, Dinner, Flight",
    surface: 'moments',
    momentsFixture: {
      moments: buildDemoMoments('2026-08-12T17:38:00.000Z'),
      nowIso: '2026-08-12T17:38:00.000Z',
    },
  },
  {
    id: 'moment-ritual',
    label: 'Moment — Ritual detail',
    driver:
      "fixture: the Investor Meeting moment at nowISO 2026-08-12T17:05Z — HYDRATE stage active (green dominant), PAUSE completed, LOCK IN/PERFORM upcoming",
    surface: 'momentDetail',
    momentsFixture: {
      moments: buildDemoMoments('2026-08-12T16:43:00.000Z'),
      nowIso: '2026-08-12T17:05:00.000Z',
      detailId: 'demo-investor-meeting',
    },
  },
];

/**
 * Deterministic WeeklyV3Inputs for the 'weekly-review' fixture. Sample data
 * only — but shaped exactly like the real sources: analytics events with real
 * types, server-shaped rollups, ledger-shaped PA day snapshots.
 */
function buildWeeklyReviewInputs(): WeeklyV3Inputs {
  const dayIdx = (iso: string) => Math.floor(Date.parse(iso) / 86_400_000);
  const events: AnalyticsEvent[] = [];
  // Prior week: 4 active days (so habit velocity shows a real improvement).
  for (const d of ['07-26', '07-27', '07-28', '07-29']) {
    events.push({ type: 'session_open', at: `2026-${d}T14:00:00.000Z` });
  }
  // Report week + the days since: daily opens (streak + 7 active days).
  for (let day = 2; day <= 11; day++) {
    events.push({ type: 'session_open', at: `2026-08-${String(day).padStart(2, '0')}T14:00:00.000Z` });
  }
  for (const d of ['02', '03', '05', '06', '08']) {
    events.push({ type: 'win', at: `2026-08-${d}T20:00:00.000Z` });
  }
  const paAges = [47, 47, 46, 46, 45, 45, 44, 44]; // Aug 3 … Aug 10
  return {
    nowISO: '2026-08-11T09:00:00.000Z',
    analyticsEvents: events,
    rollups: ([
      ['2026-08-02', 88, 124, 4],
      ['2026-08-03', 82, 118, 5],
      ['2026-08-04', 64, 82, 0], // tracked day with no logged intake
      ['2026-08-05', 90, 130, 6],
      ['2026-08-06', 71, 96, 3],
      ['2026-08-07', 84, 120, 5],
      ['2026-08-08', 89, 126, 6],
    ] as const).map(([date, avgScore, oz, units]) => ({
      date,
      snapshotsCount: 5,
      avgScore,
      minScore: Math.max(0, avgScore - 14),
      maxScore: Math.min(100, avgScore + 7),
      endOzConsumed: oz,
      endAforceUnits: 2,
      endUnitsConsumed: units,
      endSodiumDelivered: 480,
      endSodiumLost: 390,
      endDeficitPct: Math.max(0, 100 - avgScore),
      pctTimePeak: 30,
      pctTimeBalanced: 45,
      pctTimeRecovering: 20,
      pctTimeDepleted: 5,
    })) as JournalRollup[],
    paSnapshots: paAges.map((age, i) => ({
      dayIndex: dayIdx('2026-08-03T00:00:00.000Z') + i,
      performanceAge: age,
    })),
    paResult: {
      status: 'established',
      hasEnoughData: true,
      provisional: false,
      performanceAge: 44,
      actualAge: 47,
      yearsDelta: -3,
      composite: 82,
      band: 'BALANCED',
      availableSignals: 3,
    } satisfies PerformanceAgeResult,
  };
}

export function getFixture(id: string): GalleryFixture | undefined {
  return GALLERY_FIXTURES.find((f) => f.id === id);
}

// Re-exported so the gallery UI can build a fresh no-op AppContextValue /
// ActionsSlice without duplicating these imports.
export type { StoreAppState };
export type { UserSubscription };
