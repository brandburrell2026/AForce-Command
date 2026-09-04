/**
 * HydroState v1.0 — PR 1: THE MODEL BOUNDARY IS READABLE (founder ruling
 * R6, 2026-08-31). Planted BEFORE implementation.
 *
 * The audit found `hydrostate_model_version` written onto every score
 * snapshot and selected by NO read route anywhere. A version that is written
 * and never read is not provenance — it is a comment in a database column.
 *
 * v1.0 materially changes what a HydroState number MEANS (brand identity and
 * behavioural terms stop contributing physiology; intake becomes
 * target-relative). Two scores either side of that boundary are not the same
 * measurement, so a trend that plots them as neighbouring points on one line
 * is telling the member something false — and the founder cockpit's
 * week-over-week comparison would read a recalibration as a real regression.
 *
 * PR 1 ships NO model change and NO version bump. It makes the boundary
 * legible so the engine change can land behind it:
 *
 *   1. the version each snapshot was produced under reaches the client;
 *   2. a day's rollup declares every version it contains, so a day that
 *      straddles the boundary can say so;
 *   3. a pure comparability helper answers "may these points sit on one
 *      line?" in ONE place, rather than each surface inventing its own rule;
 *   4. the score analytics event carries the model that produced it.
 *
 * DELIBERATELY NOT IN THIS PR: any consumer behaviour change (Weekly,
 * trends, Moments, learning — PR 3), the engine (PR 2), and the version
 * value itself, which stays `hydrostate-v0` until the engine actually
 * changes. Shipping a bump without the engine would mislabel v0 scores.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  HYDROSTATE_MODEL_VERSION,
  isComparableModelVersion,
  spansModelBoundary,
  segmentByModelVersion,
  UNVERSIONED_MODEL,
} from '@/utils/scoring/modelBoundary';

const AOS = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(AOS, p), 'utf8');
const server = (p: string) => readFileSync(join(AOS, '..', 'api-server', p), 'utf8');

// ─────────────────── the version reaches the client

describe('R6 — the model version is READ, not merely written', () => {
  it('the journal timeline returns the model version on every snapshot entry', () => {
    const src = server('src/routes/aforce/journal.ts');
    // Bounded by the declaration that follows the union rather than by an
    // indentation-pinned brace: a reformat must not be able to silently widen
    // this window to the whole file and make the assertion below vacuous.
    const entryType = /type Entry =[\s\S]*?const entries:/.exec(src)?.[0] ?? '';
    expect(entryType, 'the Entry union must be locatable').not.toBe('');
    expect(
      entryType,
      'the located window must really be the union (anti-vacuity)',
    ).toMatch(/type:\s*"snapshot"/);
    expect(entryType, 'snapshot entries must carry their model version').toMatch(
      /modelVersion:\s*string \| null/,
    );
    expect(src, 'and it must actually be mapped from the row').toMatch(
      /modelVersion:\s*s\.hydroStateModelVersion/,
    );
  });

  it('a day rollup declares EVERY model version it contains', () => {
    // A single day can straddle the boundary. One version field would have to
    // pick a winner and silently discard the fact that the day is mixed.
    //
    // The emission moved out of the route and into the extracted aggregation
    // module when `/journal/rollups` was thinned to delegate its whole
    // response — see journalRollupsAggregation.test.ts's "a model-boundary day
    // keeps every distinct version" law for the behavioral proof this
    // source pin stands in front of.
    const src = server('src/lib/journalRollupsAggregation.ts');
    expect(src).toMatch(/modelVersions:\s*\[/);
    // ...accumulated as a Set, so a straddling day cannot lose either version.
    expect(src).toMatch(/modelVersions:\s*new Set<string \| null>\(\)/);
  });

  it('the client types carry it through', () => {
    const t = read('types/index.ts');
    expect(t).toMatch(/modelVersion\?:\s*string \| null/);
    // Widened deliberately: the server builds this from a `Set<string | null>`
    // and emits it unfiltered, so `null` IS a possible entry. Typing it
    // `string[]` was a lie about the wire shape, and it made an entire class of
    // defect impossible to write a fixture for.
    expect(t).toMatch(/modelVersions\?:\s*\(string \| null\)\[\]/);
  });

  it('the score analytics event names the model that produced the score', () => {
    const catalog = JSON.parse(read('analytics/analytics_events.json'));
    const evt = (catalog.events ?? catalog).find?.(
      (e: { eventType: string }) => e.eventType === 'hydration_score_updated',
    ) ?? Object.values(catalog).flat().find?.(
      (e: unknown) => (e as { eventType?: string })?.eventType === 'hydration_score_updated',
    );
    expect(evt, 'the score event must exist in the catalog').toBeTruthy();
    expect((evt as { payloadFields: string[] }).payloadFields).toContain('modelVersion');
    expect(read('store/app/actions.ts')).toMatch(/modelVersion:\s*HYDROSTATE_MODEL_VERSION/);
  });
});

// ─────────────────── the comparability rule lives in ONE place

describe('R6 — comparability is decided once, not re-invented per surface', () => {
  it('identical versions are comparable', () => {
    expect(isComparableModelVersion('hydrostate-v0', 'hydrostate-v0')).toBe(true);
    expect(isComparableModelVersion('hydrostate-v1.0', 'hydrostate-v1.0')).toBe(true);
  });

  it('different MAJOR versions are never comparable', () => {
    // This is the whole point: a v0 score and a v1 score are different
    // measurements wearing the same units.
    expect(isComparableModelVersion('hydrostate-v0', 'hydrostate-v1.0')).toBe(false);
    expect(isComparableModelVersion('hydrostate-v1.0', 'hydrostate-v0')).toBe(false);
  });

  it('an unversioned historical row is comparable to nothing', () => {
    // NULL means "not recorded", which is strictly weaker than "v0" — the
    // repo already refuses to coerce null → v0 on read, and so does this.
    expect(isComparableModelVersion(null, 'hydrostate-v0')).toBe(false);
    expect(isComparableModelVersion(null, null)).toBe(false);
    expect(UNVERSIONED_MODEL).toBeNull();
  });

  it('a MINOR bump inside one major stays comparable', () => {
    // Minor = output-changing but the same scoring contract (registry §3.1).
    expect(isComparableModelVersion('hydrostate-v1.0', 'hydrostate-v1.1')).toBe(true);
  });

  it('spansModelBoundary detects a mixed series', () => {
    expect(spansModelBoundary(['hydrostate-v0', 'hydrostate-v0'])).toBe(false);
    expect(spansModelBoundary(['hydrostate-v0', 'hydrostate-v1.0'])).toBe(true);
    expect(spansModelBoundary(['hydrostate-v1.0', null])).toBe(true);
    expect(spansModelBoundary([])).toBe(false);
  });

  it('segmentByModelVersion splits a series at the boundary, preserving order', () => {
    const pts = [
      { at: '1', v: 'hydrostate-v0' },
      { at: '2', v: 'hydrostate-v0' },
      { at: '3', v: 'hydrostate-v1.0' },
      { at: '4', v: 'hydrostate-v1.0' },
    ];
    const segs = segmentByModelVersion(pts, (p) => p.v);
    expect(segs).toHaveLength(2);
    expect(segs[0]!.modelVersion).toBe('hydrostate-v0');
    expect(segs[0]!.points.map((p) => p.at)).toEqual(['1', '2']);
    expect(segs[1]!.modelVersion).toBe('hydrostate-v1.0');
    expect(segs[1]!.points.map((p) => p.at)).toEqual(['3', '4']);
  });

  it('segmentation never drops or reorders a point', () => {
    const pts = [
      { at: 'a', v: 'hydrostate-v0' }, { at: 'b', v: null },
      { at: 'c', v: 'hydrostate-v1.0' }, { at: 'd', v: 'hydrostate-v0' },
    ];
    const segs = segmentByModelVersion(pts, (p) => p.v);
    expect(segs.flatMap((s) => s.points).map((p) => p.at)).toEqual(['a', 'b', 'c', 'd']);
  });
});

// ─────────────────── PR-1 scope fence

describe('PR 2 — the boundary is now REAL, and the fences that guarded it are spent', () => {
  // These two laws inverted deliberately. In PR 1 they asserted that nothing
  // had moved yet, and their whole purpose was to fail the moment PR 2 landed
  // the engine. Leaving them would have meant either a red suite or a silently
  // weakened fence, so they assert the other side of the same boundary.
  it('the version declares a MAJOR bump, because the contract materially changed', () => {
    expect(HYDROSTATE_MODEL_VERSION).toBe('hydrostate-v1.0');
    // The boundary helper must agree this is NOT comparable to v0 — a minor
    // bump would let a chart draw a line straight across the recalibration.
    expect(isComparableModelVersion('hydrostate-v0', HYDROSTATE_MODEL_VERSION)).toBe(false);
  });

  it('the commercial term is gone from BOTH copies of the formula', () => {
    const breakdown = read('utils/scoring/breakdown.ts');
    expect(breakdown).not.toMatch(/aforceBonus/);
    expect(breakdown).not.toMatch(/aforce_bonus/);
    const sums = breakdown.match(/const raw = baseIntake \+ recency \+ symptomPenalty/g) ?? [];
    expect(sums.length).toBe(2);
  });

  it('behavioural physiology no longer reaches the score', () => {
    const breakdown = read('utils/scoring/breakdown.ts');
    // Comments may still explain the removal; the CODE must not sum them.
    const code = breakdown.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    for (const term of ['consistency', 'recoveryMomentum', 'confirmation']) {
      expect(code).not.toMatch(new RegExp(`\\+ ${term}\\b`));
    }
  });

  it('the boundary helper is PURE — it may not import the engine', () => {
    const src = read('utils/scoring/modelBoundary.ts');
    expect(src).not.toMatch(/from '.*scoringEngine/);
    expect(src).not.toMatch(/from '.*breakdown/);
  });
});
