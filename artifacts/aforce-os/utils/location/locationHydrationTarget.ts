/**
 * locationHydrationTarget — pure, RN-free derivation of the environment-
 * adjusted daily hydration TARGET for the Home surface.
 *
 * Location Intelligence™ computes a capped, target-side environmental
 * demand adder (`environmentalAdderOz`, in oz) from the user's conditions
 * (altitude / UV / air / heat+humidity). This helper layers that adder on
 * top of the SERVER-AUTHORITATIVE daily target as a READ-ONLY display
 * projection — it never mutates the stored target (userState.dailyTarget /
 * reducer / realApi / server), never touches score, and never fabricates
 * demand.
 *
 * SCORE-PROTECTION / NO-FABRICATION CONTRACT
 * ------------------------------------------
 * - Fails closed: when the feature flag is OFF, the adder is non-positive /
 *   non-finite, or the oz↔serving ratio is unusable, the returned target is
 *   BYTE-IDENTICAL to the base target (no adjustment, no label). So with
 *   `location_intelligence_enabled` OFF the Home surface is unchanged.
 * - Target-side only: the adder raises *demand*, never the hydration score.
 * - Granularity: the Home card reads the target in whole servings, so the
 *   adder is converted oz→servings and rounded to the NEAREST serving; a
 *   sub-serving adder (rounds to 0) is treated as no adjustment so the
 *   displayed target only moves when the change is real at card resolution.
 */

export interface LocationAdjustedTargetInput {
  /** Base daily target in servings (server-authoritative; e.g. userState.dailyTarget). */
  baseTargetUnits: number;
  /** Oz per serving for this user (userState.ozTarget / userState.dailyTarget). */
  ozPerUnit: number;
  /** Capped environmental demand adder in oz from the pure LI engine. */
  environmentalAdderOz: number;
  /** Whether `location_intelligence_enabled` is ON (the hook's `enabled`). */
  locationEnabled: boolean;
}

export interface LocationAdjustedTarget {
  /** Sanitized base target in servings (>= 1). */
  baseTargetUnits: number;
  /** Target after the environmental adder (=== base when no adjustment). */
  adjustedTargetUnits: number;
  /** Whole servings added by the environment (0 when no adjustment). */
  addedUnits: number;
  /** Exact oz that drove the adjustment (0 when no adjustment). */
  addedOz: number;
  /** True only when LI is ON and the adder rounds to >= 1 serving. */
  hasAdjustment: boolean;
}

/**
 * No-fabrication gate: only a REAL (live) location reading may move the
 * user's daily target.
 *
 * `getLocationSnapshot()` falls back to deterministic MOCK inputs (e.g.
 * Denver / Miami, `source: 'mock'`) on permission / network / native
 * failure, and a `null` source means disabled or not-yet-loaded. Honoring a
 * mock environment would fabricate the user's conditions for a user-visible
 * target, so the target is adjustable ONLY when the flag is on AND the
 * snapshot source is `'live'`. Pure, so the gate is unit-tested.
 */
export function locationCanAdjustTarget(
  enabled: boolean,
  source: 'live' | 'mock' | null,
): boolean {
  return enabled && source === 'live';
}

const MIN_TARGET = 1;

function sanitizeBase(baseTargetUnits: number): number {
  const rounded = Math.round(baseTargetUnits);
  if (!Number.isFinite(rounded) || rounded < MIN_TARGET) return MIN_TARGET;
  return rounded;
}

export function deriveLocationAdjustedHydrationTarget(
  input: LocationAdjustedTargetInput,
): LocationAdjustedTarget {
  const base = sanitizeBase(input.baseTargetUnits);
  const noAdjustment: LocationAdjustedTarget = {
    baseTargetUnits: base,
    adjustedTargetUnits: base,
    addedUnits: 0,
    addedOz: 0,
    hasAdjustment: false,
  };

  const { environmentalAdderOz: adderOz, ozPerUnit, locationEnabled } = input;

  // Fail closed: flag off, non-positive / non-finite adder, or an unusable
  // conversion ratio → byte-identical to the base target.
  if (
    !locationEnabled ||
    !Number.isFinite(adderOz) ||
    adderOz <= 0 ||
    !Number.isFinite(ozPerUnit) ||
    ozPerUnit <= 0
  ) {
    return noAdjustment;
  }

  const addedUnits = Math.round(adderOz / ozPerUnit);
  if (addedUnits < 1) return noAdjustment;

  return {
    baseTargetUnits: base,
    adjustedTargetUnits: base + addedUnits,
    addedUnits,
    addedOz: adderOz,
    hasAdjustment: true,
  };
}
