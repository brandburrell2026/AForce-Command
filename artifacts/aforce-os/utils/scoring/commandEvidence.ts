/**
 * Evidence Engine™ — explains WHY an AForce command was issued, using only
 * REAL signal data already present in state, in LOCKSTEP with the actual
 * recommendation pipeline.
 *
 * ── What it does ──────────────────────────────────────────────────────────
 * Given the command the engine actually produced (`generateCommand` in
 * `copy.ts`) plus the live `UserState` + `ScoreEngineOutput`, it returns a
 * structured `CommandEvidence`: an ordered list of `EvidenceItem`s, each
 * linking the recommendation to a specific underlying signal with its REAL
 * value, freshness, direction, and provenance.
 *
 * ── Accuracy (in lockstep, never lies) ────────────────────────────────────
 * The command branch logic in `copy.ts` (`buildBaseCommand` /
 * `generateSocialCommand`) has an implicit ordered precedence:
 *   social-recovery → social-critical → social-do-not-drive → social-hydrate →
 *   social-rtd → social-pace → morning → DEPLETED/RECOVERING/BALANCED/PEAK.
 * We mirror that EXACT precedence here as an ordered `CommandRule[]` and select
 * the first matching rule. We then assert the selected rule's id equals the id
 * of the command that actually fired. If they DISAGREE (clock-boundary skew,
 * future drift, a new branch added to copy.ts but not here), we FAIL CLOSED —
 * returning a low-confidence diagnostic with NO items rather than inventing a
 * reason. A parity test (`commandEvidence.test.ts`) proves the selector agrees
 * with the real `generateCommand` across an adversarial state matrix, so the
 * non-invasive duplication can never silently drift unnoticed.
 *
 * Why non-invasive (selector replicated, `generateCommand` untouched): this
 * mirrors the codebase's own Score-Protection convention for risky adjacent
 * features (the score-from-ledger seam is shadow-only + parity-proven +
 * fail-closed). We never refactor the shipping command generator.
 *
 * ── Score-Protection ──────────────────────────────────────────────────────
 * Display-only. This module NEVER reads into, awards, mutates, or fabricates
 * the performance score. It only DESCRIBES signals already in state. The
 * overall confidence reuses `deriveCommandConfidence` (the same data-grounding
 * signal the command card already shows) — it is meta, not score.
 *
 * ── No fabrication ────────────────────────────────────────────────────────
 * Mirrors `commandConfidence.ts` discipline: behaviour is counted from real
 * `intakeEvents`, never the seeded `unitsConsumedToday`; body weight is never
 * used as proof (it has a default); weather/biometrics must be FINITE and the
 * timestamp is classified honestly as fresh/stale (a stale signal is shown as
 * stale, a missing one is omitted — never silently presented as current).
 *
 * Pure + dependency-free (RN-free) so it stays unit-testable. `now` is injected
 * for deterministic freshness windows.
 */

import { classifyWeatherObservation, weatherEffectiveMaxAgeMs } from '../environment/weatherFreshness';
import type {
  UserState,
  ScoreEngineOutput,
  Command,
  CommandConfidenceLevel,
  PerformanceLevel,
} from '../../types';
import { minutesSince } from './breakdown';
import {
  deriveCommandConfidence,
  commandConfidenceInputsFromState,
  freshBiometricAnchorMs,
  BIOMETRIC_FRESHNESS_MS,
} from './commandConfidence';

// ─── Public data model ────────────────────────────────────────────────────

export type EvidenceFreshnessStatus = 'fresh' | 'stale' | 'none';

export interface EvidenceFreshness {
  status: EvidenceFreshnessStatus;
  /** Source fetch time (epoch ms) when known, for an honest "as of" display. */
  fetchedAtMs?: number | null;
  /** Window this freshness was classified against, when applicable. */
  maxAgeMs?: number;
}

/**
 * How a signal relates to the recommendation. `context` is a neutral
 * "considered, backs the read" provenance signal (e.g. wearable data present)
 * that carries no directional claim of its own.
 */
export type EvidenceDirection =
  | 'raises_demand'
  | 'lowers_readiness'
  | 'protective'
  | 'maintains_state'
  | 'positive_reinforcement'
  | 'context';

export type EvidenceProvenance =
  | 'score_engine'
  | 'social_rollup'
  | 'user_behavior'
  | 'weather'
  | 'biometrics'
  | 'profile'
  | 'clock';

export interface EvidenceItem {
  /** Stable machine key — for tests + telemetry. */
  key: string;
  /** i18n key; the UI calls i18n.t(labelKey, labelParams). Keeps engine pure. */
  labelKey: string;
  /** Real interpolation values (the actual signal numbers) for the label. */
  labelParams?: Record<string, string | number>;
  /** The raw real value behind this item. */
  value: string | number | boolean;
  unit?: string;
  freshness: EvidenceFreshness;
  direction: EvidenceDirection;
  provenance: EvidenceProvenance;
}

export type EvidenceIntegrity = 'matched' | 'mismatch' | 'unknown-command';

export interface CommandEvidence {
  commandId: string;
  /** i18n key for the one-line summary above the items. */
  summaryKey: string;
  summaryParams?: Record<string, string | number>;
  /** Overall data-grounding (reused from Command Confidence™). Display-only. */
  confidence: CommandConfidenceLevel;
  items: EvidenceItem[];
  /**
   * Whether the evidence selector agreed with the command that actually fired.
   * Only 'matched' carries real items; 'mismatch'/'unknown-command' fail closed
   * (empty items, low confidence) so evidence can never claim a reason that
   * did not actually drive the recommendation.
   */
  integrity: EvidenceIntegrity;
}

// ─── Constants ────────────────────────────────────────────────────────────

const FRESH: EvidenceFreshness = { status: 'fresh' };
/** Temperature (°C) at/above which heat genuinely raises hydration demand.
 *  Kept in lock-step with personalizationSignals' HEAT_ELEVATED_C. */
const HEAT_DEMAND_C = 27;
/** Max supporting context items kept (UI is a short list). */
const MAX_CONTEXT_ITEMS = 3;

// ─── Small pure helpers ───────────────────────────────────────────────────

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * PR5.1 — the durable record now carries the SAME verdict the live path gives.
 *
 * This used to be a local re-implementation ("mirrors commandConfidence's
 * `isFresh`"). Mirroring is how the drift happened: it applied CLOCK_SKEW_MS
 * only to future stamps, while `observe()` also grants it on expiry, so a
 * 61-minute-old reading was recorded `stale` here while Core and Command
 * Confidence were still calling it current. The classifier is no longer
 * mirrored — it is consumed.
 */
function classifyWeatherFreshness(
  fetchedAt: unknown,
  now: number,
): EvidenceFreshnessStatus {
  if (!Number.isFinite(now)) return 'none';
  const currency = classifyWeatherObservation(
    isFiniteNumber(fetchedAt) ? fetchedAt : null,
    now,
  );
  return currency === 'current' ? 'fresh' : currency;
}

// ─── Rule context (mirrors generateCommand inputs) ────────────────────────

interface SocialDrinkLike {
  loggedAt: Date | string | number;
  hydrated?: boolean;
}

interface CommandRuleContext {
  level: PerformanceLevel;
  score: number;
  state: UserState;
  social: ScoreEngineOutput['social'] | null;
  now: number;
  drinkCount: number;
  lastDrink: SocialDrinkLike | null;
  /** Minutes since the most recent logged drink; Infinity when none. */
  minutesSinceDrink: number;
}

function drinkTimeMs(d: SocialDrinkLike): number {
  const t = d.loggedAt instanceof Date ? d.loggedAt.getTime() : new Date(d.loggedAt).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function buildContext(state: UserState, engineOutput: ScoreEngineOutput, now: number): CommandRuleContext {
  const social = (engineOutput.social ?? null) as ScoreEngineOutput['social'] | null;
  const drinks = (state.socialMode?.drinks ?? []) as unknown as SocialDrinkLike[];
  const lastDrink = drinks.length > 0 ? drinks[drinks.length - 1] : null;
  let minutesSinceDrink = Infinity;
  if (lastDrink) {
    const t = drinkTimeMs(lastDrink);
    minutesSinceDrink = Number.isFinite(t) ? (now - t) / 60000 : Infinity;
  }
  return {
    level: engineOutput.performanceState.level,
    score: engineOutput.score,
    state,
    social,
    now,
    drinkCount: social?.drinkCount ?? drinks.length,
    lastDrink,
    minutesSinceDrink,
  };
}

// ─── Evidence item builders ───────────────────────────────────────────────

function readinessItem(ctx: CommandRuleContext, levelKey: string, direction: EvidenceDirection): EvidenceItem {
  return {
    key: `readiness_${levelKey}`,
    labelKey: 'evidence.item.readiness',
    labelParams: { score: Math.round(ctx.score), level: levelKey },
    value: Math.round(ctx.score),
    freshness: FRESH,
    direction,
    provenance: 'score_engine',
  };
}

/**
 * Supporting context for the morning + level commands — only signals that are
 * GENUINELY present and meaningful. Capped to keep the UI a short list. Social
 * commands deliberately get NO generic context items (mirrors copy.ts, where
 * `composeExplanation` skips overlays for the social copy lane).
 */
function contextEvidenceItems(ctx: CommandRuleContext): EvidenceItem[] {
  const { state, now } = ctx;
  const items: EvidenceItem[] = [];
  const hasBehavior = (state.intakeEvents?.length ?? 0) > 0;

  // Intake recency + pace — only when there is REAL logged behaviour, so we
  // never read the seeded ozConsumedToday as if the user had logged it.
  if (hasBehavior) {
    const mins = Math.round(minutesSince(state.lastIntakeTime, now));
    if (mins > 60) {
      items.push({
        key: 'intake_gap',
        labelKey: 'evidence.item.intake_gap',
        labelParams: { minutes: mins },
        value: mins,
        unit: 'min',
        freshness: FRESH,
        direction: 'raises_demand',
        provenance: 'user_behavior',
      });
    } else if (mins < 25) {
      items.push({
        key: 'intake_recent',
        labelKey: 'evidence.item.intake_recent',
        labelParams: { minutes: mins },
        value: mins,
        unit: 'min',
        freshness: FRESH,
        direction: 'positive_reinforcement',
        provenance: 'user_behavior',
      });
    }

    const ozTarget = isFiniteNumber(state.ozTarget) ? state.ozTarget : 0;
    const ozConsumed = isFiniteNumber(state.ozConsumedToday) ? state.ozConsumedToday : 0;
    if (ozTarget > 0) {
      const ratio = ozConsumed / ozTarget;
      if (ratio < 0.5) {
        items.push({
          key: 'pace_behind',
          labelKey: 'evidence.item.pace_behind',
          labelParams: { consumed: Math.round(ozConsumed), target: Math.round(ozTarget) },
          value: Math.round(ozConsumed),
          unit: 'oz',
          freshness: FRESH,
          direction: 'raises_demand',
          provenance: 'user_behavior',
        });
      } else if (ratio >= 0.75) {
        items.push({
          key: 'pace_ahead',
          labelKey: 'evidence.item.pace_ahead',
          labelParams: { consumed: Math.round(ozConsumed), target: Math.round(ozTarget) },
          value: Math.round(ozConsumed),
          unit: 'oz',
          freshness: FRESH,
          direction: 'positive_reinforcement',
          provenance: 'user_behavior',
        });
      }
    }
  }

  // Weather — surfaced only when it actually raises demand (warm/hot) AND
  // carries a real fetch timestamp. Freshness reported honestly (fresh/stale).
  const temp = state.weatherTempC;
  if (isFiniteNumber(temp) && temp >= HEAT_DEMAND_C) {
    const status = classifyWeatherFreshness(state.weatherFetchedAt, now);
    if (status === 'fresh' || status === 'stale') {
      items.push({
        key: 'weather_heat',
        labelKey: 'evidence.item.weather_heat',
        labelParams: { temp: Math.round(temp) },
        value: Math.round(temp),
        unit: '°C',
        // The bound the verdict ACTUALLY used, so the permanent record and
        // the status beside it can never describe different windows.
        freshness: { status, fetchedAtMs: state.weatherFetchedAt as number, maxAgeMs: weatherEffectiveMaxAgeMs() },
        direction: 'raises_demand',
        provenance: 'weather',
      });
    }
  }

  // Biometrics — fresh wearable / Apple Health recovery data is present. Neutral
  // ('context') provenance signal: it backs the read without a directional claim.
  const bioAnchor = freshBiometricAnchorMs(state, now);
  if (bioAnchor != null) {
    items.push({
      key: 'biometrics',
      labelKey: 'evidence.item.biometrics',
      value: true,
      freshness: { status: 'fresh', fetchedAtMs: bioAnchor, maxAgeMs: BIOMETRIC_FRESHNESS_MS },
      direction: 'context',
      provenance: 'biometrics',
    });
  }

  return items.slice(0, MAX_CONTEXT_ITEMS);
}

// ─── Command rules (ordered precedence — mirrors copy.ts) ──────────────────

interface CommandRule {
  id: string;
  matches: (ctx: CommandRuleContext) => boolean;
  evidence: (ctx: CommandRuleContext) => EvidenceItem[];
}

const RULES: CommandRule[] = [
  {
    id: 'cmd-social-recovery',
    matches: (c) => !!c.social && c.social.inRecoveryWindow && !c.social.active,
    evidence: (c) => [
      {
        key: 'social_recovery',
        labelKey: 'evidence.item.social_recovery',
        labelParams: { count: c.drinkCount },
        value: c.drinkCount,
        freshness: FRESH,
        direction: 'protective',
        provenance: 'social_rollup',
      },
    ],
  },
  {
    id: 'cmd-social-stop-critical',
    matches: (c) => !!c.social && c.social.active && c.social.impairment?.level === 'CRITICAL',
    evidence: () => [
      {
        key: 'social_impairment',
        labelKey: 'evidence.item.social_impairment',
        labelParams: { level: 'critical' },
        value: 'critical',
        freshness: FRESH,
        direction: 'protective',
        provenance: 'social_rollup',
      },
    ],
  },
  {
    id: 'cmd-social-do-not-drive',
    matches: (c) => !!c.social && c.social.active && c.social.impairment?.level === 'HIGH',
    evidence: () => [
      {
        key: 'social_impairment',
        labelKey: 'evidence.item.social_impairment',
        labelParams: { level: 'high' },
        value: 'high',
        freshness: FRESH,
        direction: 'protective',
        provenance: 'social_rollup',
      },
    ],
  },
  {
    id: 'cmd-social-hydrate',
    matches: (c) =>
      !!c.social && c.social.active && c.minutesSinceDrink <= 5 && c.lastDrink?.hydrated !== true,
    evidence: (c) => [
      {
        key: 'social_recent_drink',
        labelKey: 'evidence.item.social_recent_drink',
        labelParams: { minutes: Math.max(0, Math.round(c.minutesSinceDrink)) },
        value: Math.max(0, Math.round(c.minutesSinceDrink)),
        unit: 'min',
        freshness: FRESH,
        direction: 'protective',
        provenance: 'social_rollup',
      },
    ],
  },
  {
    id: 'cmd-social-rtd',
    matches: (c) =>
      !!c.social &&
      c.social.active &&
      (c.social.hangoverRisk?.level === 'CRITICAL' || c.social.hangoverRisk?.level === 'HIGH'),
    evidence: (c) => [
      {
        key: 'social_hangover_risk',
        labelKey: 'evidence.item.social_hangover_risk',
        labelParams: {
          score: c.social?.hangoverRisk?.score ?? 0,
          level: String(c.social?.hangoverRisk?.level ?? '').toLowerCase(),
        },
        value: c.social?.hangoverRisk?.score ?? 0,
        freshness: FRESH,
        direction: 'protective',
        provenance: 'social_rollup',
      },
    ],
  },
  {
    id: 'cmd-social-pace',
    matches: (c) => !!c.social && c.social.active,
    evidence: (c) => [
      {
        key: 'social_active',
        labelKey: 'evidence.item.social_active',
        labelParams: { count: c.drinkCount },
        value: c.drinkCount,
        freshness: FRESH,
        direction: 'protective',
        provenance: 'social_rollup',
      },
    ],
  },
  {
    id: 'cmd-morning',
    matches: (c) =>
      isFiniteNumber(c.state.overnightLossOz) &&
      c.state.overnightLossOz > 8 &&
      !c.state.hasSeenMorningCommand,
    evidence: (c) => [
      {
        key: 'overnight_deficit',
        labelKey: 'evidence.item.overnight_deficit',
        labelParams: { oz: Math.round(c.state.overnightLossOz) },
        value: Math.round(c.state.overnightLossOz),
        unit: 'oz',
        freshness: FRESH,
        direction: 'raises_demand',
        provenance: 'score_engine',
      },
      ...contextEvidenceItems(c),
    ],
  },
  {
    id: 'cmd-depleted',
    matches: (c) => c.level === 'DEPLETED',
    evidence: (c) => [readinessItem(c, 'depleted', 'lowers_readiness'), ...contextEvidenceItems(c)],
  },
  {
    id: 'cmd-recovering',
    matches: (c) => c.level === 'RECOVERING',
    evidence: (c) => [readinessItem(c, 'recovering', 'lowers_readiness'), ...contextEvidenceItems(c)],
  },
  {
    id: 'cmd-balanced',
    matches: (c) => c.level === 'BALANCED',
    evidence: (c) => [readinessItem(c, 'balanced', 'maintains_state'), ...contextEvidenceItems(c)],
  },
  {
    id: 'cmd-peak',
    matches: (c) => c.level === 'PEAK',
    evidence: (c) => [readinessItem(c, 'peak', 'positive_reinforcement'), ...contextEvidenceItems(c)],
  },
];

function selectRuleForContext(ctx: CommandRuleContext): CommandRule | null {
  return RULES.find((r) => r.matches(ctx)) ?? null;
}

/**
 * The command id the evidence selector believes SHOULD have fired for these
 * inputs, or null when no rule matched. Exported for the parity test that
 * proves lockstep with the real `generateCommand`.
 */
export function selectCommandRuleId(
  state: UserState,
  engineOutput: ScoreEngineOutput,
  now: number = Date.now(),
): string | null {
  return selectRuleForContext(buildContext(state, engineOutput, now))?.id ?? null;
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface DeriveCommandEvidenceArgs {
  /** The command that actually fired (from generateCommand). */
  command: Command;
  state: UserState;
  engineOutput: ScoreEngineOutput;
  /** Injected clock for deterministic freshness windows; defaults to now. */
  now?: number;
}

function failClosed(commandId: string, integrity: EvidenceIntegrity): CommandEvidence {
  return {
    commandId,
    summaryKey: 'evidence.summary.unavailable',
    confidence: 'low',
    items: [],
    integrity,
  };
}

/**
 * Derive the structured evidence for the command that actually fired. Pure;
 * never mutates its inputs and never touches the score. Fails closed (empty
 * items, low confidence) on any selector/command mismatch so it can never
 * present a reason that did not drive the recommendation.
 */
export function deriveCommandEvidence(args: DeriveCommandEvidenceArgs): CommandEvidence {
  const { command, state, engineOutput } = args;
  const now = args.now ?? Date.now();

  const ctx = buildContext(state, engineOutput, now);
  const selected = selectRuleForContext(ctx);

  if (!selected) return failClosed(command.id, 'unknown-command');
  if (selected.id !== command.id) return failClosed(command.id, 'mismatch');

  const confidence = deriveCommandConfidence(commandConfidenceInputsFromState(state, now));
  return {
    commandId: command.id,
    summaryKey: 'evidence.summary.matched',
    confidence,
    items: selected.evidence(ctx),
    integrity: 'matched',
  };
}
