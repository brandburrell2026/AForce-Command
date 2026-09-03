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
import {
  spansModelBoundary,
  isComparableModelVersion,
  provenanceOfVersions,
  type DayModelProvenance,
} from './modelBoundary';

/* ── the ONE reading of a day's provenance ────────────────────────────────── */

/**
 * Canonical per-day provenance for a journal rollup. Every consumer in this
 * module reads the field that answers ITS question and never re-derives another
 * consumer's meaning from `modelVersions`.
 */
export function dayProvenance(r: JournalRollup): DayModelProvenance {
  return provenanceOfVersions(r.modelVersions);
}

/**
 * THE SCORE-OBSERVATION SEAM — asked before any provenance question.
 *
 * `snapshotsCount === 0` means NO HYDROSTATE OBSERVATION EXISTS for that day.
 * The server still emits a row (a day with intakes but no captured snapshot is
 * real activity), and it fills the score fields with a SENTINEL:
 * `avgScore: snapshotsCount > 0 ? real : 0` (journal.ts:443).
 *
 * NO OBSERVATION != SCORE ZERO. Read without this seam, one missed sync
 * dragged a member's 30-day average from 90 to 87, halved their streak, was
 * plotted at the very bottom of the chart on a day they logged water — and,
 * after the v1.0 rollout, made the card announce "MODEL HISTORY UNAVAILABLE"
 * because a day with no score has no version stamp either. A day with no
 * observation has no provenance to be unknown about.
 *
 * Declared ONCE here; no consumer re-encodes it.
 */
export function hasHydroStateObservation(r: JournalRollup): boolean {
  return r.snapshotsCount > 0;
}

/**
 * THE OBSERVATION POPULATION — the one denominator, declared once.
 *
 * A seam enforced at four call sites is a convention, not a seam. The previous
 * round installed `hasHydroStateObservation` and wired it into `recapStatsScope`
 * and `classifyRecapProvenance`; `ShareJournalRecap` kept asking
 * `statsScope.length === rollups.length`, and the card held two answers about
 * the same array. One missed sync then either deleted a real streak in silence
 * or announced "MODEL HISTORY UNAVAILABLE" over a fully-stamped month.
 *
 * So the population itself is a named value, not a filter every consumer
 * repeats. Whenever the question is "how many days did HydroState actually
 * measure", it is answered here — never by `rollups.length`, which answers the
 * different question of how many days the label covers.
 */
export function observedRows(
  rollups: readonly JournalRollup[],
): readonly JournalRollup[] {
  return rollups.filter(hasHydroStateObservation);
}

export function observedCount(rollups: readonly JournalRollup[]): number {
  return observedRows(rollups).length;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A `YYYY-MM-DD` day key as a UTC instant, or null if it is not one. */
function parseDayUTC(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  // Rejects 2026-02-30 and friends, which `Date.UTC` silently rolls forward.
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d
    ? t
    : null;
}

/**
 * THE REPORTING WINDOW, measured in CALENDAR days rather than rows.
 *
 * `rollups.length` counts the rows the SERVER MATERIALISED. That is a different
 * question from how many days the window covers, and reading one as the other
 * is the defect this function exists to make unspellable: the route used to
 * omit any day with neither a snapshot nor an intake, so a day the member
 * skipped entirely VANISHED from the array. Its absence was then invisible —
 * the streak walked straight across it and published a BROKEN streak for a day
 * HydroState had never observed.
 *
 * The route now densifies, so the two numbers agree by construction. This is
 * the belt to that braces: client and server are separate deployables, and a
 * client running against a server that has not shipped densification must
 * still see the gap rather than silently miss it. Measuring the calendar makes
 * that automatic.
 */
export function reportedSpanDays(rollups: readonly JournalRollup[]): number {
  if (rollups.length === 0) return 0;
  const first = parseDayUTC(rollups[0]!.date);
  const last = parseDayUTC(rollups[rollups.length - 1]!.date);
  // A malformed day key is a wire violation, not a production state (the server
  // emits `YYYY-MM-DD` and the wire-contract laws pin it). Falling back to the
  // row count keeps the answer a lower bound rather than inventing a span.
  if (first == null || last == null) return rollups.length;
  // `Math.max` guards the degenerate cases a span alone cannot: duplicate dates
  // and an unsorted array both compute a span SHORTER than the rows present,
  // and a window can never be smaller than the days it contains.
  return Math.max(rollups.length, Math.round((last - first) / DAY_MS) + 1);
}

/** Q1 — may this day's score enter a statistical population, and under which version? */
export function statsDayVersion(r: JournalRollup): string | null {
  return dayProvenance(r).scoreableVersion;
}

/**
 * The RENDER key for a rollup day — TOTAL over the three provenance kinds.
 *
 * `dayVersion` returns `null` for three DISJOINT states: an unrecorded day, an
 * incompatible day, and a `known` day carrying two same-major versions. Segment
 * grouping compares with `===`, and `null === null`, so all three shared one
 * visual run: on the column-deploy day the chart drew ONE unbroken 30-point
 * stroke beneath a caption reading "29 OF 30 DAYS", and at the first minor bump
 * the single fully-known day in the population was welded into the unstamped
 * history beneath "1 COMPARABLE DAY".
 *
 * Every isolation law placed the non-clean day between STAMPED neighbours,
 * which is the one arrangement where exact-identity grouping isolates it by
 * accident. Beside unstamped days — the modal shape while the column has no
 * backfill — it welds.
 *
 * So the key is total: unrecorded days share one key, a cleanly-stamped day
 * shares its version's key, and anything else gets a key unique to its own
 * index and can never join a neighbour.
 */
/**
 * The RENDER key for a chart snapshot — also TOTAL, for the same reason.
 *
 * A snapshot carries a single version, so it cannot straddle; but a nullable
 * scalar is still the shape that welded three states together on the rollup
 * side, and no consumer may reconstruct render identity from one.
 */
export function snapshotRenderKeyOf(s: { modelVersion?: string | null }): string {
  return s.modelVersion == null ? 'unrecorded' : `v:${s.modelVersion}`;
}

export function renderKeyOf(r: JournalRollup, index: number): string {
  // A day with no observation is a GAP in the score series, never a point.
  // Plotting the server's sentinel drew a hard zero on a day the member simply
  // did not sync — inventing an observation, and the worst possible one.
  if (!hasHydroStateObservation(r)) return `gap:${index}`;
  const p = dayProvenance(r);
  if (p.kind === 'unrecorded') return 'unrecorded';
  // A KNOWN day keys on its EXACT recorded set, which preserves the ruled
  // visual semantics (v1.0 and v1.1 are separate runs) while letting two days
  // carrying the SAME set share one — keying on the index alone would have
  // fragmented a continuous stretch of identical straddle days into one run
  // each, which is over-isolation rather than honesty.
  if (p.kind === 'known') return `v:${p.recordedVersions.join('|')}`;
  // Incompatible: no set can be shared, because the day is comparable to
  // nothing — including to another incompatible day.
  return `isolated:${index}`;
}

/** Q3 helper — a day whose recorded versions cannot collapse to one. */
export function isRecordedIncompatibleDay(r: JournalRollup): boolean {
  return dayProvenance(r).kind === 'incompatible';
}

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
  versionOf: (p: T, index: number) => string | null,
): RenderSegment<T>[] {
  const out: RenderSegment<T>[] = [];
  for (let i = 0; i < points.length; i++) {
    const point = points[i]!;
    const v = versionOf(point, i);
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
  const segments = segmentForRender(data, snapshotRenderKeyOf);
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
 * THE ONE PLACE A ROLLUP'S SCORE BECOMES A COORDINATE.
 *
 * Three call sites below used to compute this, and one of them — the deleted
 * single-row shortcut — did it without the clamp and, far worse, without the
 * observation seam. A row's score may be read for geometry only here, so a
 * fourth reader cannot appear without touching this function.
 */
function yForRow(r: JournalRollup, innerH: number, padding: RecapPadding): number {
  return padding.top + (1 - Math.max(0, Math.min(100, r.avgScore)) / 100) * innerH;
}

/**
 * Build ONE svg path per model-version segment of the exported range.
 *
 * `x` stays keyed to each day's index in the WHOLE range, so segmenting changes
 * which strokes exist, never where a day sits on the timeline.
 *
 * THERE IS NO SINGLE-ROW FAST PATH (founder ruling B, 2026-09-02). A
 * `rollups.length === 1` branch used to read `rollups[0].avgScore` directly and
 * return a full-width stroke. It predated the observation seam and never
 * learned it, so a lone intake-without-snapshot day — real activity, sentinel
 * score — was drawn as a hard line across the whole card at the score-0
 * baseline, beneath tiles that all correctly read "—". A second scoring path is
 * how a seam drifts; the fix is to have one path, not two gates.
 */
export function buildRecapSegmentPaths(
  rollups: readonly JournalRollup[],
  innerW: number,
  innerH: number,
  padding: RecapPadding,
): string[] {
  if (rollups.length === 0) return [];
  // A one-row range has no span to divide by. It is still one segment through
  // the same pipeline, so it gets the same seam, key and clamp as every other.
  const span = Math.max(1, rollups.length - 1);
  const segs = segmentForRender(rollups, renderKeyOf);
  let cursor = 0;
  const out: string[] = [];
  for (const seg of segs) {
    // A gap emits no geometry at all — and, being its own segment, it also
    // breaks the stroke rather than letting a line be drawn THROUGH the
    // missing day, which would interpolate an observation that never existed.
    if (seg.modelVersion?.startsWith('gap:')) { cursor += seg.points.length; continue; }
    const cmds = seg.points.map((r, j) => {
      const i = cursor + j;
      const x = padding.left + (i / span) * innerW;
      return `${j === 0 ? 'M' : 'L'}${x.toFixed(1)},${yForRow(r, innerH, padding).toFixed(1)}`;
    });
    cursor += seg.points.length;
    if (cmds.length === 1) {
      // A lone day gets a minimum-length tick so it strokes instead of
      // vanishing — held inside the plot area, because the first and last days
      // of a range sit exactly on its edges and half the tick would otherwise
      // be drawn outside the chart. Reachable from a one-row range, where the
      // lone day IS the first and last day.
      const x = Math.min(
        Math.max(padding.left + ((cursor - 1) / span) * innerW, padding.left + LONE_POINT_TICK_PX),
        padding.left + innerW - LONE_POINT_TICK_PX,
      );
      const y = yForRow(seg.points[0]!, innerH, padding).toFixed(1);
      out.push(`M${(x - LONE_POINT_TICK_PX).toFixed(1)},${y} L${(x + LONE_POINT_TICK_PX).toFixed(1)},${y}`);
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
  // OBSERVATION FIRST, provenance second. A day with no HydroState observation
  // is not an unknown-provenance day — it is not a score at all, so no
  // comparability question applies to it.
  const observed = observedRows(rollups);
  if (observed.length === 0) return [];
  // A day whose own recorded versions disagree can NEVER contribute to an
  // aggregate: its `avgScore` is already a blend of two measurements, so
  // including it publishes exactly the claim this module exists to prevent.
  // Unrecorded days are NOT excluded — unknown is not incompatible, and the
  // existing behaviour for an all-unstamped history is preserved.
  const eligible = observed.filter((r) => dayProvenance(r).kind !== 'incompatible');
  if (eligible.length === 0) return eligible;   // caller must suppress aggregates
  const versions = eligible.map(statsDayVersion);
  if (!spansModelBoundary(versions)) return eligible;

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
  if (newestKnown === null) return eligible;

  // COMPARABILITY, not render identity. Rendering uses exact identity by
  // founder ruling — v1.0 and v1.1 get separate visual runs — but a statistics
  // population is a scientific question, and the registry says same-major
  // versions ARE comparable. Reusing the render predicate here under-selected:
  // [v1.0 x10, unstamped x5, v1.1 x5] kept only the trailing 5 rather than the
  // 15 that are genuinely comparable. Visual continuity and statistical
  // comparability are separate contracts, and this is the statistical one.
  return eligible.filter((r) => isComparableModelVersion(statsDayVersion(r), newestKnown));
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
  /** No score observations at all — nothing to have provenance FOR. */
  | { kind: 'no_history' }
  | { kind: 'provenance_unknown'; knownTransition: boolean; comparableDays: number; observedDays: number }
  /**
   * Provenance IS recorded; the recorded versions simply cannot be compared
   * under the active rules. Distinct from `provenance_unknown` because nothing
   * here is missing — and it must never wear that state's words, which would
   * tell the member their history could not be established when in fact it was
   * established and found incomparable.
   */
  | { kind: 'recorded_incompatible'; knownTransition: boolean };

export function classifyRecapProvenance(
  rollups: readonly JournalRollup[],
): RecapProvenance {
  // Ruling 1: model-history qualifiers apply only when score observations
  // exist. An empty range has no provenance to report, not unknown provenance.
  if (rollups.length === 0) return { kind: 'no_history' };

  // ONE pass, ONE classification per day. Each question below reads the field
  // that answers it; none re-derives another's meaning.
  // Only OBSERVED days carry provenance. A scoreless day contributes no
  // version evidence and must not make an otherwise-known run look uncertain.
  const observed = observedRows(rollups);
  if (observed.length === 0) return { kind: 'no_history' };
  const days = observed.map(dayProvenance);

  // Q3 — a transition is witnessed by RECORDED versions, including those on a
  // day that is itself unusable for scoring. A deploy day is evidence even
  // though its own aggregate is a blend.
  const recorded: string[] = [];
  for (const d of days) for (const v of d.recordedVersions) {
    if (!recorded.includes(v)) recorded.push(v);
  }
  const knownTransition = recorded.length >= 2 && spansModelBoundary(recorded);

  // Q2 — provenance absent (NOT disagreeing).
  const hasUnrecorded = days.some((d) => d.kind === 'unrecorded');
  const hasIncompatible = days.some((d) => d.kind === 'incompatible');

  // Q1 — the population, via `scoreableVersion` only.
  const scope = recapStatsScope(rollups);

  // No comparable subset: aggregates must be suppressed, never rendered as 0.
  if (scope.length === 0) {
    // Ruling 3/C: the INCOMPATIBLE wording requires two mutually incomparable
    // KNOWN versions. A range unusable only because recorded days sit beside
    // unrecorded ones is MISSING provenance, and must not wear the incompatible
    // wording — that is the D3A error inverted.
    const trulyIncompatible = hasIncompatible && knownTransition;
    if (trulyIncompatible) return { kind: 'recorded_incompatible', knownTransition };
    return hasIncompatible || hasUnrecorded
      ? { kind: 'provenance_unknown', knownTransition, comparableDays: 0, observedDays: observed.length }
      : { kind: 'no_history' };
  }

  // "N COMPARABLE DAYS" asserts comparability was DECIDED for each of the N.
  // It may only be claimed when every survivor carries a scoreable version —
  // narrowing caused solely by dropping incompatible days leaves survivors
  // that may all be unrecorded, for which nothing was decided at all.
  const scopeAllKnown = scope.every((r) => dayProvenance(r).kind === 'known');
  // Narrowing is measured against OBSERVED days, not the reporting range: a
  // missing snapshot is not a comparability event, and comparing to
  // `rollups.length` is what made one missed sync print "29 COMPARABLE DAYS".
  if (scope.length < observed.length && scopeAllKnown) {
    return { kind: 'partially_comparable', comparableDays: scope.length, knownTransition };
  }
  if (hasUnrecorded || !scopeAllKnown) {
    // Ruling B: the count is disclosed even when provenance is partly unknown.
    // Dropping it let AVG/PEAK describe 1 of 30 days silently.
    return {
      kind: 'provenance_unknown', knownTransition,
      comparableDays: scope.length, observedDays: observed.length,
    };
  }
  return { kind: 'fully_comparable' };
}

/* ── streak eligibility (founder ruling, 2026-09-02) ──────────────────────── */

/**
 * WHY a recap may or may not publish a HydroState-derived streak.
 *
 * A missing observation makes the streak UNKNOWABLE across that gap, and the
 * founder ruling closes every dishonest way out of that: the day may not be
 * scored 0, the run may not be broken (which asserts a failure the member did
 * not have), and the day may not be skipped (which asserts continuous
 * qualification nobody observed). The streak is suppressed for the window.
 *
 * THE REASON IS PART OF THE ANSWER. `ShareJournalRecap` used to derive
 * suppression from `statsScope.length === rollups.length` — ONE boolean
 * answering two different questions. Both a missed sync and a model boundary
 * make it false, so the card could not tell the member which had happened, and
 * chose wrong in both directions: a fully-stamped month with one gap fell
 * through to `fully_comparable` and said NOTHING, while an unstamped month with
 * one gap said "MODEL HISTORY UNAVAILABLE" — blaming a recalibration for a
 * missing snapshot.
 *
 * Three causes, three answers, and the union makes the collapse unspellable:
 *
 *   no_history           nothing was reported; there is nothing to explain
 *   coverage_incomplete  a day in the window has no observation, so continuity
 *                        cannot be established — NOT the member's fault and NOT
 *                        the model's
 *   not_comparable       every day was observed, but their scores are not one
 *                        population, so a run across them is not one metric
 *   eligible             complete coverage and one comparable population
 */
export type StreakEligibility =
  | { kind: 'eligible' }
  | { kind: 'no_history' }
  | { kind: 'coverage_incomplete'; measuredDays: number; rangeDays: number }
  | { kind: 'not_comparable' };

export function classifyStreakEligibility(
  rollups: readonly JournalRollup[],
): StreakEligibility {
  // IS THERE A WINDOW TO REPORT ON? This is a WINDOW question, so it is asked
  // of the calendar — not of `rollups.length`, which answers "how many rows did
  // the server materialise" and is the row count this whole module refuses to
  // read as anything else.
  //
  // It is deliberately NOT `observedCount(rollups) === 0`. That was tried: it
  // made a window with zero observations go SILENT — no streak, no reason —
  // which is precisely the harm the coverage note exists to prevent. A window
  // of N days with nothing measured is `0 OF N DAYS MEASURED`, an honest and
  // useful statement; only a window with no DAYS in it has nothing to say.
  //
  // This is why the sibling `classifyRecapProvenance` can legitimately answer
  // `no_history` for the same array: it is asked "is there PROVENANCE to
  // report" (an observation question), and this one is asked "is there a
  // WINDOW to report on". Different questions, different denominators — which
  // is the distinction the whole module is built on, not a violation of it.
  const rangeDays = reportedSpanDays(rollups);
  if (rangeDays === 0) return { kind: 'no_history' };

  // COVERAGE FIRST, comparability second — the same ordering as the score
  // population, and for the same reason: comparability is a question ABOUT
  // observations, so it cannot be asked of a day that has none. Answering in
  // the other order is what let a missing snapshot be reported as a model
  // event. When BOTH are true the model state is still disclosed, on the
  // provenance qualifier line, so naming coverage here loses no fact.
  //
  // The denominator is the CALENDAR SPAN, never `rollups.length`. The row count
  // answers "how many days did the server materialise", and reading it as the
  // window is what let a day the member skipped disappear from the array
  // entirely — taking its own absence with it.
  const measuredDays = observedCount(rollups);
  if (measuredDays < rangeDays) {
    return { kind: 'coverage_incomplete', measuredDays, rangeDays };
  }

  // Every day in the window was measured. The remaining question is whether
  // those measurements are one population.
  return recapStatsScope(rollups).length < measuredDays
    ? { kind: 'not_comparable' }
    : { kind: 'eligible' };
}
