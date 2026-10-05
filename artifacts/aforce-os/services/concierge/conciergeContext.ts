/**
 * AForce Concierge — grounding context builder (pure).
 *
 * Takes the store slices Home already renders from and produces the
 * `ConciergeClientContext` the server forwards to the model. Every value is
 * labelled with its PROVENANCE (measured / logged / estimated / demo) and
 * FRESHNESS (from `FRESHNESS_WINDOWS` in config/hydroStateModel.ts — the same
 * windows the Home freshness label uses). Nothing is fabricated: an absent
 * signal is simply not emitted, and a reading with no timestamp is not
 * labelled "fresh" by default.
 *
 * Demo discipline: when the app is in a demo/seeded profile, `demoMode` is
 * true AND every provenance collapses to 'demo', so the server can tell the
 * model these are not the member's numbers.
 *
 * Score-Protection: read-only. The engine command passes through the
 * Decision Guard (`guardEngineOutput`) exactly as the Home surfaces deliver it —
 * the concierge never originates a second command (DR-013).
 */
import { FRESHNESS_WINDOWS, CONCIERGE_RECENT_DAYS } from '@/config/hydroStateModel';
import { guardEngineOutput } from '@/utils/intelligence/decisionGuard';
import { resolveHomeEvidence } from '@/components/home/homeBaselineState';
import type { FeatureFlags, HistoryEntry, ScoreEngineOutput, UserState } from '@/types';
import type { ProviderSnapshot } from '@/types/biometrics';
import {
  CONCIERGE_SCREENS,
  type ConciergeCapability,
  type ConciergeClientContext,
  type ConciergeDaySummary,
  type ConciergeFreshness,
  type ConciergeProviderStatus,
  type ConciergeScreenId,
  type ConciergeSignal,
} from './conciergeTypes';

export interface BuildContextInput {
  engine: ScoreEngineOutput;
  userState: UserState;
  history: readonly HistoryEntry[];
  flags: FeatureFlags;
  /** `DEMO_MODE` (env) or any demo-profile flag — collapses provenance to 'demo'. */
  demoMode: boolean;
  locale: string;
  /** Logged-day count from the journal read; null while unknown (evidence pending). */
  loggedDayCount: number | null;
  now?: Date;
  timeZone?: string;
  stated?: ConciergeClientContext['stated'];
}

export function freshnessLabel(
  observedAtMs: number | null | undefined,
  kind: keyof typeof FRESHNESS_WINDOWS,
  nowMs: number,
): ConciergeFreshness {
  if (observedAtMs == null || !Number.isFinite(observedAtMs)) return 'missing';
  const age = nowMs - observedAtMs;
  if (age < 0) return 'missing';
  const w = FRESHNESS_WINDOWS[kind];
  if (age <= w.freshUntilMs) return 'fresh';
  if (age <= w.staleAfterMs) return 'aging';
  if (w.expireAfterMs !== undefined && age > w.expireAfterMs) return 'expired';
  return 'stale';
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Group real (non-synthetic) history into per-day summaries, newest first. */
export function summariseRecentDays(
  history: readonly HistoryEntry[],
  now: Date,
  days: number = CONCIERGE_RECENT_DAYS,
): ConciergeDaySummary[] {
  const byDay = new Map<string, { scores: number[]; logs: number }>();
  const floor = now.getTime() - days * 24 * 60 * 60 * 1000;
  for (const h of history) {
    if (h.isSynthetic) continue;
    const t = h.timestamp instanceof Date ? h.timestamp : new Date(h.timestamp);
    if (!Number.isFinite(t.getTime()) || t.getTime() < floor) continue;
    const key = localDateKey(t);
    const bucket = byDay.get(key) ?? { scores: [], logs: 0 };
    if (Number.isFinite(h.score)) bucket.scores.push(h.score);
    if (h.unitsTaken > 0) bucket.logs += 1;
    byDay.set(key, bucket);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, days)
    .map(([date, b]) => ({
      date,
      avgScore: b.scores.length ? Math.round(b.scores.reduce((s, x) => s + x, 0) / b.scores.length) : null,
      logs: b.logs,
      // Intake oz per day is not carried on HistoryEntry — honest null, never derived.
      oz: null,
    }));
}

function snapshotSignals(
  providerId: string,
  snap: Pick<
    ProviderSnapshot,
    | 'sleepHoursLastNight'
    | 'hrvRmssdMs'
    | 'hrvSdnnMs'
    | 'hrvSdnn'
    | 'restingHeartRate'
    | 'recoveryPct'
    | 'readinessScore'
    | 'strain'
    | 'stepsToday'
    | 'fetchedAt'
    | 'latestObservedAtMs'
    | 'fieldObservedAtMs'
  >,
  nowMs: number,
  demo: boolean,
): ConciergeSignal[] {
  const out: ConciergeSignal[] = [];
  const observed = (field: 'restingHeartRate' | 'hrvSdnn' | 'sleepHoursLastNight' | 'stepsToday'): number | undefined =>
    snap.fieldObservedAtMs?.[field] ?? snap.latestObservedAtMs ?? snap.fetchedAt;
  const push = (
    id: string,
    label: string,
    value: number | null | undefined,
    unit: string,
    observedAt: number | undefined,
    kind: keyof typeof FRESHNESS_WINDOWS,
  ) => {
    if (value == null || !Number.isFinite(value)) return;
    out.push({
      id: `${providerId}.${id}`,
      label,
      value: Math.round(value * 10) / 10,
      unit,
      provider: providerId,
      provenance: demo ? 'demo' : 'measured',
      freshness: freshnessLabel(observedAt, kind, nowMs),
      ...(observedAt ? { observedAtIso: new Date(observedAt).toISOString() } : {}),
    });
  };
  push('sleep', 'Sleep last night', snap.sleepHoursLastNight, 'h', observed('sleepHoursLastNight'), 'sleep');
  const hrv = snap.hrvRmssdMs ?? snap.hrvSdnnMs ?? snap.hrvSdnn;
  push('hrv', 'HRV', hrv, 'ms', observed('hrvSdnn'), 'wearable_sync');
  push('rhr', 'Resting heart rate', snap.restingHeartRate, 'bpm', observed('restingHeartRate'), 'wearable_sync');
  push('recovery', 'Recovery (provider)', snap.recoveryPct, '%', snap.fetchedAt, 'wearable_sync');
  push('readiness', 'Readiness (provider)', snap.readinessScore, '', snap.fetchedAt, 'wearable_sync');
  push('strain', 'Strain (provider)', snap.strain, '', snap.fetchedAt, 'wearable_sync');
  push('steps', 'Steps today', snap.stepsToday, 'steps', observed('stepsToday'), 'wearable_sync');
  return out;
}

export function availableScreens(flags: FeatureFlags): ConciergeScreenId[] {
  return CONCIERGE_SCREENS.filter((s) => {
    if (s === 'moments') return flags.moments_enabled;
    if (s === 'concierge_memory') return flags.ai_concierge_enabled;
    return true;
  });
}

export function availableCapabilities(): ConciergeCapability[] {
  // Each maps to a working path today: intake POST (idempotent), expo-router
  // navigation, the /urine-check screen, and expo-notifications local
  // scheduling (permission checked at execution time, failure reported).
  return ['log_hydration', 'open_screen', 'start_checkin', 'set_reminder'];
}

export function buildConciergeContext(input: BuildContextInput): ConciergeClientContext {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const demo = input.demoMode;
  const { engineOutput, result } = guardEngineOutput(input.engine);

  // Same two inputs Home's evidence gate reads: today's intake events from the
  // store row, and the real (non-synthetic) journal entry count.
  const evidenceState = resolveHomeEvidence({
    intakeEventCount: input.userState.intakeEvents?.length ?? 0,
    loggedDayCount: input.loggedDayCount,
  });
  const evidence: 'pending' | 'building' | 'ready' =
    evidenceState === 'established' ? 'ready' : evidenceState;

  const hydroState =
    evidence === 'ready'
      ? {
          score: Math.round(engineOutput.score),
          level: engineOutput.performanceState.level,
          urgency: engineOutput.performanceState.urgency,
          ...(engineOutput.command.confidence ? { confidence: engineOutput.command.confidence } : {}),
          evidence,
          reasons: engineOutput.reasons.slice(0, 6).map((r) => r.text.slice(0, 140)),
        }
      : null;

  const command = engineOutput.command
    ? {
        action: engineOutput.command.action.slice(0, 240),
        explanation: (engineOutput.command.explanation ?? '').slice(0, 400),
        urgencyLevel: engineOutput.command.urgencyLevel,
        ...(engineOutput.command.confidence ? { confidence: engineOutput.command.confidence } : {}),
        guard: result.verdict,
      }
    : null;

  const u = input.userState;
  const lastIntake = u.lastIntakeTime instanceof Date ? u.lastIntakeTime.getTime() : new Date(u.lastIntakeTime).getTime();
  const lastIntakeMinutesAgo =
    u.unitsConsumedToday > 0 && Number.isFinite(lastIntake) && lastIntake <= nowMs
      ? Math.round((nowMs - lastIntake) / 60_000)
      : null;

  const signals: ConciergeSignal[] = [];
  const providers: ConciergeProviderStatus[] = [];
  for (const [id, snap] of Object.entries(u.biometrics ?? {})) {
    if (!snap) continue;
    providers.push({
      id,
      connected: true,
      lastSyncIso: Number.isFinite(snap.fetchedAt) ? new Date(snap.fetchedAt).toISOString() : null,
      freshness: freshnessLabel(snap.fetchedAt, 'wearable_sync', nowMs),
    });
    signals.push(...snapshotSignals(id, snap, nowMs, demo));
  }
  if (u.appleHealth && !u.biometrics?.apple_health) {
    const ah = u.appleHealth;
    providers.push({
      id: 'apple_health',
      connected: true,
      lastSyncIso: Number.isFinite(ah.fetchedAt) ? new Date(ah.fetchedAt).toISOString() : null,
      freshness: freshnessLabel(ah.fetchedAt, 'wearable_sync', nowMs),
    });
    signals.push(
      ...snapshotSignals(
        'apple_health',
        {
          sleepHoursLastNight: ah.sleepHoursLastNight,
          hrvSdnn: ah.hrvSdnn,
          restingHeartRate: ah.restingHeartRate,
          stepsToday: ah.stepsToday,
          fetchedAt: ah.fetchedAt,
        },
        nowMs,
        demo,
      ),
    );
  }

  return {
    schemaVersion: 1,
    localTime: {
      iso: toLocalIso(now),
      timeZone: input.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      hour: now.getHours(),
    },
    locale: input.locale,
    demoMode: demo,
    hydroState,
    command,
    intake: {
      ozToday: Math.round(u.ozConsumedToday),
      ozTarget: Math.round(u.ozTarget),
      unitsToday: u.unitsConsumedToday,
      unitsTarget: u.dailyTarget,
      lastIntakeMinutesAgo,
      provenance: demo ? 'demo' : 'logged',
    },
    signals: signals.slice(0, 24),
    providers: providers.slice(0, 10),
    recentDays: demo ? [] : summariseRecentDays(input.history, now),
    capabilities: availableCapabilities(),
    screens: availableScreens(input.flags),
    ...(input.stated ? { stated: input.stated } : {}),
  };
}

/** ISO 8601 with the device's own offset (the server reads the local date from it). */
export function toLocalIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
