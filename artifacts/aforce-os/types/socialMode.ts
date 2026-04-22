/**
 * Social Mode — premium real-time alcohol mitigation types.
 *
 * Lives in its own module so the BAC engine, legal-safety service, and
 * UI layer can import the same shapes without dragging the entire
 * `types/index.ts` graph in. `types/index.ts` re-exports the shared
 * primitives (DrinkType, DrinkLog, SocialModeState, HangoverRisk) so
 * existing call sites keep working.
 *
 * SAFETY: Every BAC / impairment / time-to-clear value produced by the
 * engine is an APPROXIMATION. The UI must surround any number with the
 * `social.estimate_only` + `social.not_legal_medical` disclaimer copy.
 * The engine never decides whether the user is "safe" or "legal" — it
 * only describes risk and recommends safer next steps.
 */

// ─── Drinks ───────────────────────────────────────────────────────────────────
export type DrinkType =
  | 'beer'
  | 'wine'
  | 'cocktail'
  | 'liquor'
  | 'hard_seltzer'
  | 'custom';

export interface DrinkLog {
  id: string;
  type: DrinkType;
  loggedAt: Date;
  /** Hydration decay multiplier applied while this drink is in the active window. */
  multiplier: number;
  /** Did the user complete the post-drink hydration command? null = still pending. */
  hydrated: boolean | null;
  /** Per-drink ABV (%). Falls back to catalog default when omitted. */
  abv?: number;
  /** Volume in oz of the drink itself (not pure alcohol). */
  oz?: number;
}

// ─── Social session ───────────────────────────────────────────────────────────
export type SocialContextSex = 'male' | 'female' | 'unspecified';

export interface SocialModeState {
  active: boolean;
  startedAt: Date;
  drinks: DrinkLog[];
  lastHydrationPromptAt?: Date;
  /** Set when user taps "End Night". Recovery window = `endedAt` + 8h. */
  endedAt?: Date;
  /** Optional context for sharper BAC math. Defaults applied when missing. */
  sex?: SocialContextSex;
  ateRecently?: boolean;
}

// ─── Hangover Risk ────────────────────────────────────────────────────────────
export type HangoverRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface HangoverRisk {
  level: HangoverRiskLevel;
  /** 0–100 numeric score; drives the badge gradient + voice urgency. */
  score: number;
  reasons: string[];
}

// ─── BAC estimate ─────────────────────────────────────────────────────────────
export type BACTrend = 'rising' | 'steady' | 'falling';
export type BACConfidence = 'low' | 'medium' | 'high';

export interface BACEstimate {
  /** Inclusive low end of the estimated BAC range (e.g. 0.06). */
  rangeLow: number;
  /** Inclusive high end of the estimated BAC range (e.g. 0.08). */
  rangeHigh: number;
  trend: BACTrend;
  confidence: BACConfidence;
  /** Estimated minutes until BAC drops below ~0.005. Rounded conservatively. */
  timeToClearMinutes: number;
  /** Reasons used to localize the trend / confidence chips. */
  notes: string[];
}

// ─── Impairment risk (5 levels per spec) ─────────────────────────────────────
export type ImpairmentRiskLevel =
  | 'LOW'
  | 'ELEVATED'
  | 'MODERATE'
  | 'HIGH'
  | 'CRITICAL';

export interface ImpairmentRiskState {
  level: ImpairmentRiskLevel;
  /** Same BAC midpoint that drove the level — kept for the UI badge. */
  bacMidpoint: number;
}

// ─── Legal / transportation safety ───────────────────────────────────────────
export type TransportationSeverity = 'info' | 'caution' | 'warning' | 'critical';

export interface TransportationSafetyPrompt {
  /** False when impairment is LOW/ELEVATED — UI hides the safety card entirely. */
  show: boolean;
  severity: TransportationSeverity;
  /** i18n key for the headline copy (e.g. "social.safety_do_not_drive"). */
  titleKey: string;
  /** i18n key for the supporting body copy. */
  bodyKey: string;
  /** i18n key for the disclaimer footer. */
  disclaimerKey: string;
  /** True when the engine wants the user to stop adding drinks immediately. */
  stopDrinking: boolean;
}

// ─── Recovery recommendation ─────────────────────────────────────────────────
export interface RecoveryRecommendation {
  /** i18n keys for the steps the recovery card should render in order. */
  stepKeys: string[];
  /** Estimated minutes until BAC clears (0 when not in recovery / already clear). */
  timeToClearMinutes: number;
  /** Localizable headline for the morning estimate strip. */
  morningEstimateKey: string;
}
