/**
 * THE normalization boundary between provider payloads and AForce domain
 * consumers. Everything the app (and later the server) ingests passes
 * through here exactly once; downstream code never sees provider drift.
 *
 * Shape drift this module resolves (all shipped today):
 *   - Garmin emits `hrvMs` + `stress`; the declared model has `hrvSdnn` +
 *     `stressScore` (api-server lib/garminSnapshot.ts:186,188 vs
 *     lib/db schema/aforce.ts:84,90) — Garmin values were silently dropped.
 *   - `hrvSdnn` carries RMSSD for WHOOP (`hrv_rmssd_milli`) and Oura
 *     (`average_hrv`, RMSSD-based). RMSSD ≠ SDNN. The canonical fields
 *     `hrvRmssdMs` / `hrvSdnnMs` are populated by the explicit per-provider
 *     method table below — LEGACY `hrvSdnn` passes through byte-identical
 *     (compatibility), but no NEW mislabeled value is ever created here.
 *   - providerId re-stamped from the map key; malformed entries dropped
 *     (numeric `fetchedAt` required) — preserving realApi.normalizeBiometrics
 *     semantics verbatim.
 *
 * HONESTY: absent data stays absent (null/undefined) — never a placeholder.
 * Provider scores remain attributed; nothing here converts them into any
 * AForce score (Score-Protection).
 */

import {
  HEALTH_RECORD_SCHEMA_VERSION,
  type HealthProviderId,
  type HrvMethod,
  type ProviderBiometrics,
  type ProviderSnapshot,
} from './contracts';

// ─── Per-provider HRV statistic (explicit translation table) ────────────────

/**
 * Which statistic each provider's HRV value ACTUALLY is, regardless of the
 * legacy field it was stored in. Sources:
 *   whoop  → hrv_rmssd_milli            (api-server whoopSnapshot.ts:177-183)
 *   oura   → average_hrv, RMSSD-based   (api-server ouraSnapshot.ts:33-42)
 *   garmin → hrv `lastNightAvg` (RMSSD family; emitted as `hrvMs`)
 *   apple_health → HKQuantityTypeIdentifierHeartRateVariabilitySDNN (true SDNN)
 *   google_health → Health Connect HeartRateVariabilityRmssdRecord (RMSSD)
 *   samsung_health → via Health Connect ⇒ RMSSD family
 *   strava → no HRV.
 */
export const HRV_METHOD_BY_PROVIDER: Record<HealthProviderId, HrvMethod | null> = {
  whoop: 'rmssd',
  oura: 'rmssd',
  garmin: 'rmssd',
  google_health: 'rmssd',
  samsung_health: 'rmssd',
  apple_health: 'sdnn',
  strava: null,
};

// ─── Snapshot normalization ──────────────────────────────────────────────────

const KNOWN_PROVIDERS: ReadonlySet<string> = new Set<HealthProviderId>([
  'apple_health', 'oura', 'samsung_health', 'google_health', 'garmin', 'whoop', 'strava',
]);

function finiteOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Normalize ONE raw provider blob entry into a canonical ProviderSnapshot.
 * Returns null for malformed entries (unknown provider key or missing
 * numeric fetchedAt) — the caller drops them, matching shipped behavior.
 */
export function normalizeProviderSnapshot(
  providerKey: string,
  raw: unknown,
): ProviderSnapshot | null {
  if (!KNOWN_PROVIDERS.has(providerKey)) return null;
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.fetchedAt !== 'number' || !Number.isFinite(r.fetchedAt)) return null;

  const provider = providerKey as HealthProviderId;
  const method = HRV_METHOD_BY_PROVIDER[provider];

  // Garmin drift: `hrvMs` → canonical; `stress` → `stressScore`.
  const legacyHrvSdnn = finiteOrNull(r.hrvSdnn);
  const garminHrvMs = finiteOrNull(r.hrvMs);
  const stressScore = finiteOrNull(r.stressScore) ?? finiteOrNull(r.stress);

  // Canonical HRV: explicit translation ONLY. The raw HRV value for this
  // provider (whichever legacy field carried it) lands in the field matching
  // the provider's true statistic; the other stays null.
  const rawHrv = legacyHrvSdnn ?? garminHrvMs;
  const hrvRmssdMs = method === 'rmssd' ? rawHrv : null;
  const hrvSdnnMs = method === 'sdnn' ? rawHrv : null;

  return {
    providerId: provider,
    restingHeartRate: finiteOrNull(r.restingHeartRate),
    // Legacy passthrough — byte-identical to what the provider wrote. We do
    // NOT copy Garmin's hrvMs into it: that would CREATE a new mislabel.
    hrvSdnn: legacyHrvSdnn,
    hrvRmssdMs,
    hrvSdnnMs,
    sleepHoursLastNight: finiteOrNull(r.sleepHoursLastNight),
    stepsToday: finiteOrNull(r.stepsToday) ?? finiteOrNull(r.steps),
    workoutMinutesToday: finiteOrNull(r.workoutMinutesToday),
    strain: finiteOrNull(r.strain),
    recoveryPct: finiteOrNull(r.recoveryPct),
    readinessScore: finiteOrNull(r.readinessScore),
    stressScore,
    trainingLoad: finiteOrNull(r.trainingLoad),
    fetchedAt: r.fetchedAt,
    schemaVersion: HEALTH_RECORD_SCHEMA_VERSION,
  };
}

/** Normalize a whole server `biometrics` blob. Undefined when nothing usable. */
export function normalizeProviderBiometrics(raw: unknown): ProviderBiometrics | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<HealthProviderId, ProviderSnapshot>> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const snap = normalizeProviderSnapshot(key, val);
    if (snap) out[snap.providerId] = snap;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ─── HRV read-side selector (legacy compatibility, explicit translation) ─────

export interface ResolvedHrv {
  valueMs: number;
  method: HrvMethod;
  /** True when derived from the legacy mixed-semantics field. */
  legacyTranslated: boolean;
}

/**
 * The ONE way to read HRV off a snapshot. Prefers the canonical fields; falls
 * back to translating the legacy `hrvSdnn` via the per-provider method table.
 * Never returns a value whose statistic is unknown.
 */
export function resolveHrv(snapshot: ProviderSnapshot): ResolvedHrv | null {
  const rmssd = finiteOrNull(snapshot.hrvRmssdMs);
  if (rmssd != null) return { valueMs: rmssd, method: 'rmssd', legacyTranslated: false };
  const sdnn = finiteOrNull(snapshot.hrvSdnnMs);
  if (sdnn != null) return { valueMs: sdnn, method: 'sdnn', legacyTranslated: false };

  const legacy = finiteOrNull(snapshot.hrvSdnn);
  if (legacy == null) return null;
  const method = HRV_METHOD_BY_PROVIDER[snapshot.providerId];
  if (method == null) return null; // provider has no HRV — refuse to guess
  return { valueMs: legacy, method, legacyTranslated: true };
}
