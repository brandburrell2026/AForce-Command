/**
 * HydroState model boundary — the one place that decides whether two scores
 * are the same kind of measurement (founder ruling R6, 2026-08-31).
 *
 * WHY THIS EXISTS. Every `aforce_score_snapshots` row is stamped with the
 * model version that produced it, and until now no read route selected that
 * column: the provenance was written and never used. HydroState v1.0
 * materially changes what the number MEANS — brand identity and behavioural
 * terms stop contributing physiology, and intake becomes target-relative — so
 * a v0 score and a v1 score are two different measurements sharing a unit.
 * Plotting them as adjacent points on one line asserts a continuity that does
 * not exist, and a week-over-week comparison spanning the boundary reads a
 * recalibration as a real change in the member's body.
 *
 * The rule lives HERE, once. A surface that needs to know whether it may draw
 * a line, compute a delta, or compare two days asks this module rather than
 * inventing its own version test — which is how six surfaces end up with five
 * subtly different rules.
 *
 * PURE by construction: no engine import, no store, no I/O (pinned).
 */

/** Re-exported so a consumer needs exactly one import to ask the question. */
export { HYDROSTATE_MODEL_VERSION } from '@/config/hydroStateModel';

/**
 * A historical row written before the version column existed. NULL means
 * "not recorded" — strictly weaker than a known version, and deliberately
 * NOT coerced to `hydrostate-v0`: the repository already refuses that
 * coercion on read, because an unstamped row is untrustworthy rather than
 * old (registry rule 1 — "a record without a version is not trustworthy and
 * must be retired, not reinterpreted").
 */
export const UNVERSIONED_MODEL = null;

export type ModelVersion = string | null;

/**
 * The MAJOR component of a version identifier — the part that decides
 * comparability. Format is `hydrostate-v<major>[.<minor>]` (DR-009 §3).
 *
 * Registry §3.1: a MAJOR bump means "a materially different scoring contract;
 * historical scores are NOT comparable". A MINOR bump is output-changing but
 * preserves the contract, so a minor difference stays comparable — the scores
 * still measure the same thing, slightly better.
 */
function majorOf(version: ModelVersion): string | null {
  if (!version) return null;
  const m = /^hydrostate-v(\d+)/.exec(version);
  return m ? m[1]! : null;
}

/**
 * May these two scores sit on the same axis, be differenced, or be averaged
 * together? Unstamped rows are comparable to nothing, including each other —
 * two unknown models are not evidence of one model.
 */
export function isComparableModelVersion(a: ModelVersion, b: ModelVersion): boolean {
  const ma = majorOf(a);
  const mb = majorOf(b);
  if (ma === null || mb === null) return false;
  return ma === mb;
}

/** True when a series mixes measurements that may not be compared. */
export function spansModelBoundary(versions: readonly ModelVersion[]): boolean {
  if (versions.length <= 1) return false;
  const first = versions[0]!;
  return versions.some((v) => !isComparableModelVersion(first, v));
}

export interface ModelSegment<T> {
  /** The version every point in this run was produced under. */
  modelVersion: ModelVersion;
  points: T[];
}

/**
 * Split an ordered series into runs of comparable points, preserving order
 * and dropping nothing. A renderer draws one line per segment and shows the
 * break between them, rather than interpolating across a boundary.
 *
 * Deliberately splits on RUNS rather than grouping by version: a series that
 * goes v0 → v1 → v0 (possible with an out-of-order backfill) must show three
 * segments, not two, because the chronology is what the member sees.
 */
export function segmentByModelVersion<T>(
  points: readonly T[],
  versionOf: (point: T) => ModelVersion,
): ModelSegment<T>[] {
  const out: ModelSegment<T>[] = [];
  for (const point of points) {
    const v = versionOf(point);
    const current = out[out.length - 1];
    if (current && isComparableModelVersion(current.modelVersion, v)) {
      current.points.push(point);
    } else {
      out.push({ modelVersion: v, points: [point] });
    }
  }
  return out;
}

/**
 * Does one day's rollup contain scores from more than one model version?
 *
 * A day can straddle the boundary, and its aggregate is then built from two
 * different measurements — an average that describes neither. Consumers use
 * this to mark such a day non-comparable rather than presenting its number as
 * a like-for-like daily score.
 *
 * An absent or empty list means "not recorded", which is NOT evidence of
 * mixing. Beyond that the question is COMPARABILITY, not distinctness: a known
 * version alongside an unrecorded one IS mixed (`[null, 'hydrostate-v1.0']` →
 * true), because an unstamped score is comparable to nothing — while two
 * versions sharing a major are not (`['hydrostate-v1.0', 'hydrostate-v1.1']` →
 * false). The previous wording said "only two or more distinct KNOWN versions
 * count", which contradicts both of those pinned behaviours.
 */
export function isMixedModelDay(versions: readonly (string | null)[] | undefined): boolean {
  if (!versions || versions.length <= 1) return false;
  return spansModelBoundary(versions);
}
