/**
 * Series construction that respects the HydroState model boundary.
 *
 * WHY THIS IS A SEPARATE, PURE MODULE. These two functions decide what a
 * member's history LOOKS like — how many anchors, how many strokes, and which
 * points get averaged together. They were originally private to their
 * components, which meant the only way to assert their guarantees was to scan
 * the component source for an identifier. A source scan survives any mutation
 * that keeps the name and changes the call site, and one did exactly that: a
 * rejoined cross-boundary path passed the law.
 *
 * Importing the components directly is not an option either — they pull the
 * React Native / Expo runtime into the test environment. So the logic lives
 * here, free of renderer imports, where it can be executed and mutated against.
 *
 * The rule both functions enforce: a v0 score and a v1.0 score are different
 * measurements sharing a unit. They may sit on the same timeline. They may not
 * be averaged into one anchor, or joined by one stroke.
 */
import type { JournalSnapshot, JournalRollup } from '../../types';
import { spansModelBoundary, isComparableModelVersion } from './modelBoundary';

/* ── rendering segmentation ───────────────────────────────────────────────── */

/**
 * RENDER segmentation — deliberately NOT the same predicate as comparability.
 *
 * `isComparableModelVersion` answers a truth question: may I difference or
 * average these two scores? It answers `false` for two NULLs, and it is right
 * to: an unrecorded score is not evidence that it is comparable to anything.
 *
 * Using that predicate to decide STROKES was the defect. It started a new
 * segment at every unstamped point, so a member's pre-stamp history — the
 * default for all history, since `hydrostate_model_version` is nullable with no
 * backfill — shattered into one-point segments. A one-point segment produces a
 * moveto-only path, which strokes nothing: 30 days of history rendered as loose
 * dots with no line, at 30 anchors instead of the designed 5.
 *
 * Rendering asks a different question: do these two observations belong to one
 * continuous run? The two concepts must stay separate, and this helper is the
 * named place where the rendering one lives.
 *
 * The rule is EXACT-IDENTITY grouping:
 *   - consecutive nulls group together (one unstamped run, one stroke)
 *   - consecutive identical known versions group together
 *   - a null run never joins a known run
 *   - two different known versions never join
 *
 * Identity is deliberately stricter than comparability. Two versions sharing a
 * major (v1.0 / v1.1) ARE comparable per the registry, so joining them would
 * also be defensible — this helper splits them instead, because a seam where
 * none was needed is a cosmetic cost, while a join where none was warranted is
 * a truth claim. See the PR body: this is flagged for founder ruling.
 *
 * Grouping nulls for rendering says only "these are one continuous run of
 * unstamped history". It asserts nothing about whether that history is
 * comparable to a stamped v1 observation — `spansModelBoundary` still answers
 * that, unchanged, and still says no.
 */
export interface RenderSegment<T> { modelVersion: string | null; points: T[] }

export function segmentForRender<T>(
  points: readonly T[],
  versionOf: (p: T) => string | null,
): RenderSegment<T>[] {
  const out: RenderSegment<T>[] = [];
  for (const point of points) {
    const v = versionOf(point);
    const current = out[out.length - 1];
    // Exact identity — `null === null` groups, and that is the whole fix.
    if (current && current.modelVersion === v) current.points.push(point);
    else out.push({ modelVersion: v, points: [point] });
  }
  return out;
}

/* ── the trend chart ──────────────────────────────────────────────────────── */

export interface Bucket { t: number; score: number; at: string }

/**
 * Average a run of snapshots into `targetBuckets` anchors.
 *
 * The averaging here is why the caller must segment first: a bucket straddling
 * a model boundary averages a v0 score with a v1 score and produces an anchor
 * that corresponds to no measurement any member ever had.
 */
export function bucketize(data: JournalSnapshot[], targetBuckets: number): Bucket[] {
  if (data.length === 0) return [];
  if (data.length <= targetBuckets) {
    return data.map((d) => ({ t: new Date(d.at).getTime(), score: d.score, at: d.at }));
  }
  const buckets: Bucket[] = [];
  const size = data.length / targetBuckets;
  for (let i = 0; i < targetBuckets; i++) {
    const start = Math.floor(i * size);
    const end = Math.floor((i + 1) * size);
    const slice = data.slice(start, end);
    if (slice.length === 0) continue;
    const sum = slice.reduce((a, d) => a + d.score, 0);
    const midIdx = Math.floor((start + end) / 2);
    buckets.push({
      t: new Date(data[midIdx]!.at).getTime(),
      score: sum / slice.length,
      at: data[midIdx]!.at,
    });
  }
  return buckets;
}

/**
 * Split the series at every model boundary, then bucketize inside each piece.
 *
 * Anchors are distributed in proportion to how many snapshots each segment
 * contains, so a long v0 history followed by two v1 days does not receive the
 * same number of anchors as the history — while every segment keeps at least
 * one anchor, because a segment that renders nothing is indistinguishable from
 * a gap in the data.
 */
export function bucketizeSegmented(
  data: JournalSnapshot[],
  targetBuckets: number,
): Bucket[][] {
  const segments = segmentForRender(data, (d) => d.modelVersion ?? null);
  if (segments.length === 0) return [];
  const total = data.length || 1;
  return segments
    .map((seg) => {
      const share = Math.max(1, Math.round((seg.points.length / total) * targetBuckets));
      return bucketize(seg.points, share);
    })
    .filter((b) => b.length > 0);
}

/* ── the exported recap ───────────────────────────────────────────────────── */

/**
 * The single model version a day's rollup represents, or `null` when the day
 * itself mixes versions. `null` is comparable to nothing, so a mixed day
 * isolates into its own segment rather than silently joining a neighbour —
 * which is exactly the treatment it deserves.
 */
export function statsDayVersion(r: JournalRollup): string | null {
  const vs = r.modelVersions;
  if (!vs || vs.length === 0) return null;
  if (vs.length === 1) return vs[0]!;
  // A day carrying SEVERAL versions is only a hole when they disagree. At a
  // v1.0 -> v1.1 transition every version on the day is comparable, so the day
  // is a perfectly good member of the score population — collapsing it to
  // `null` excluded it and punched a gap through the middle of the run, which
  // halved the reported streak for no physiological reason.
  //
  // Distinct from `dayVersion`, which RENDERING uses: a mixed day still gets
  // its own visual run under exact identity, because a seam is cheap and a
  // false continuity claim is not.
  const anchor = vs[0]!;
  return vs.every((v) => isComparableModelVersion(v, anchor)) ? anchor : null;
}

export function dayVersion(r: JournalRollup): string | null {
  const vs = r.modelVersions;
  return vs && vs.length === 1 ? vs[0]! : null;
}

export interface RecapPadding { top: number; right: number; bottom: number; left: number }

/**
 * Half-width of the tick a single-observation segment is drawn as.
 *
 * An svg path of `M x,y` alone strokes NOTHING. That is the same root cause as
 * the shattered-history defect, surviving one layer down: an isolated day —
 * a mixed day between two known runs, or a lone stamped day among unstamped
 * ones — was emitted as a moveto and rendered invisibly. A day that exists in
 * the data must be visible in the export.
 */
const LONE_POINT_TICK_PX = 1.5;

/**
 * Build ONE svg path per model-version segment of the exported range.
 *
 * `x` stays keyed to each day's index in the WHOLE range, so segmenting changes
 * which strokes exist, never where a day sits on the timeline.
 */
export function buildRecapSegmentPaths(
  rollups: readonly JournalRollup[],
  innerW: number,
  innerH: number,
  padding: RecapPadding,
): string[] {
  if (rollups.length === 0) return [];
  if (rollups.length === 1) {
    const y = padding.top + (1 - rollups[0]!.avgScore / 100) * innerH;
    return [`M${padding.left.toFixed(1)},${y.toFixed(1)} L${(padding.left + innerW).toFixed(1)},${y.toFixed(1)}`];
  }
  const span = rollups.length - 1;
  const segs = segmentForRender(rollups, dayVersion);
  let cursor = 0;
  const out: string[] = [];
  for (const seg of segs) {
    const cmds = seg.points.map((r, j) => {
      const i = cursor + j;
      const x = padding.left + (i / span) * innerW;
      const y = padding.top + (1 - Math.max(0, Math.min(100, r.avgScore)) / 100) * innerH;
      return `${j === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    cursor += seg.points.length;
    if (cmds.length === 1) {
      // A lone day gets a minimum-length tick so it strokes instead of
      // vanishing. Same treatment the single-rollup case above already gets.
      const r = seg.points[0]!;
      const x = padding.left + ((cursor - 1) / span) * innerW;
      const y = padding.top + (1 - Math.max(0, Math.min(100, r.avgScore)) / 100) * innerH;
      out.push(`M${(x - LONE_POINT_TICK_PX).toFixed(1)},${y.toFixed(1)} L${(x + LONE_POINT_TICK_PX).toFixed(1)},${y.toFixed(1)}`);
    } else if (cmds.length > 1) out.push(cmds.join(' '));
  }
  return out;
}

/**
 * The rollups a recap's HEADLINE statistics should be computed over.
 *
 * Narrowing exists so a headline number is not blended across two different
 * measurements. It must therefore trigger on a REAL boundary only. The first
 * implementation asked `spansModelBoundary`, which answers `true` for an
 * all-unstamped range — so a 30-day export with no stamps anywhere narrowed to
 * its final row and rendered that single day's score and streak under a
 * "30-DAY TIMELINE" label. A fabricated headline in the most shareable
 * artifact the app produces, caused by a boundary that did not exist.
 *
 * Absence of stamps is not a boundary. Only genuinely incomparable known
 * versions narrow the population.
 */
export function recapStatsScope(
  rollups: readonly JournalRollup[],
): readonly JournalRollup[] {
  if (rollups.length === 0) return rollups;
  const versions = rollups.map(statsDayVersion);
  if (!spansModelBoundary(versions)) return rollups;

  // The newest KNOWN version anchors the population. Walking back past trailing
  // unstamped or mixed days matters because `dayVersion` collapses a mixed day,
  // an absent list and an empty list all to null, and a day with a logged
  // intake but no captured snapshot legitimately has `modelVersions: []`.
  let newestKnown: string | null = null;
  for (let i = versions.length - 1; i >= 0; i--) {
    const v = versions[i]!;
    if (v != null) { newestKnown = v; break; }
  }
  // Nothing known anywhere: there is no comparable anchor, so do not narrow.
  if (newestKnown === null) return rollups;

  // COMPARABILITY, not render identity. Rendering uses exact identity by
  // founder ruling — v1.0 and v1.1 get separate visual runs — but a statistics
  // population is a scientific question, and the registry says same-major
  // versions ARE comparable. Reusing the render predicate here under-selected:
  // [v1.0 x10, unstamped x5, v1.1 x5] kept only the trailing 5 rather than the
  // 15 that are genuinely comparable. Visual continuity and statistical
  // comparability are separate contracts, and this is the statistical one.
  return rollups.filter((r) => isComparableModelVersion(statsDayVersion(r), newestKnown));
}

/* ── model provenance classification (founder ruling D3A) ─────────────────── */

/**
 * Unknown provenance is NOT known comparability.
 *
 * One boolean cannot carry this: `recapStatsScope` returns the full range both
 * when every day is proven comparable AND when no day's provenance can be
 * established at all, and those two states owe the member different words. The
 * second must not silently imply the first, and neither may claim a model
 * TRANSITION that is not known to have happened.
 *
 *   fully_comparable      every day's version is known and mutually comparable
 *   partially_comparable  the population narrowed; `knownTransition` says
 *                         whether two mutually incomparable KNOWN versions are
 *                         actually present, or whether the narrowing is merely
 *                         the consequence of days whose provenance is unknown
 *   provenance_unknown    at least one day is unrecorded and the population did
 *                         NOT narrow — nothing was proven either way
 */
export type RecapProvenance =
  | { kind: 'fully_comparable' }
  | { kind: 'partially_comparable'; comparableDays: number; knownTransition: boolean }
  | { kind: 'provenance_unknown' };

export function classifyRecapProvenance(
  rollups: readonly JournalRollup[],
): RecapProvenance {
  if (rollups.length === 0) return { kind: 'fully_comparable' };
  const versions = rollups.map(statsDayVersion);
  const hasUnknown = versions.some((v) => v == null);
  const known = [...new Set(versions.filter((v): v is string => v != null))];
  // A transition is KNOWN only when two known versions genuinely disagree.
  // Unrecorded days are not evidence that the model changed.
  const knownTransition = known.length >= 2 && spansModelBoundary(known);

  const scope = recapStatsScope(rollups);
  if (scope.length < rollups.length) {
    return { kind: 'partially_comparable', comparableDays: scope.length, knownTransition };
  }
  if (hasUnknown) return { kind: 'provenance_unknown' };
  return { kind: 'fully_comparable' };
}
