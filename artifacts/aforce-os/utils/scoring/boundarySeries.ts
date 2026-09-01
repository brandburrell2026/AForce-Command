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
import { segmentByModelVersion } from './modelBoundary';

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
  const segments = segmentByModelVersion(data, (d) => d.modelVersion ?? null);
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
export function dayVersion(r: JournalRollup): string | null {
  const vs = r.modelVersions;
  return vs && vs.length === 1 ? vs[0]! : null;
}

export interface RecapPadding { top: number; right: number; bottom: number; left: number }

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
  const segs = segmentByModelVersion(rollups, dayVersion);
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
    if (cmds.length > 0) out.push(cmds.join(' '));
  }
  return out;
}
