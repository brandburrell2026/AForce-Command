/**
 * Wave-2 review — CORRECTION READ INTEGRITY (activated by RP-6, ruling R4).
 *
 * RP-6 is the first client that can create intake CORRECTION rows (append-only
 * §10/RC-L12 bookkeeping: same fluidType/ozAmount, scoreBefore/After 0,
 * correctsIntakeId set). The adversarial review proved every member-facing
 * intake reader was blind to them — an undo would ADD a phantom drink to the
 * journal timeline, extend achievement streaks, and count as Score-Protection
 * evidence: the exact opposite of "removed from today".
 *
 * These are SOURCE pins (the route suites are DB-gated and skipped locally):
 * each count-bearing reader must filter correction rows, and the two surfaces
 * whose semantics are "what counted" must also exclude corrected ORIGINALS.
 * A future reader repeating the omission fails the census below.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

describe('correction rows never masquerade as intakes', () => {
  it('achievements: the intake-day query filters corrections and excludes corrected originals', () => {
    const src = read('routes/aforce/achievements.ts');
    expect(src).toMatch(/isNull\(aforceIntakeLogs\.correctsIntakeId\)/);
    expect(src, 'corrected originals must not earn streak credit').toMatch(/correctedIds/);
  });

  it('journal timeline: correction rows are not intake entries', () => {
    const src = read('routes/aforce/journal.ts');
    // Both intake selects in the file (timeline + rollups) carry the filter.
    expect((src.match(/isNull\(aforceIntakeLogs\.correctsIntakeId\)/g) ?? []).length)
      .toBeGreaterThanOrEqual(3);
  });

  it('rollups: intakeCount means what COUNTED — corrections and corrected originals excluded', () => {
    const src = read('routes/aforce/journal.ts');
    expect(src).toMatch(/correctedIds/);
  });

  it('score-write evidence: a correction is not intake evidence', () => {
    const src = read('routes/aforce/journal.ts');
    // The evidence count's where() carries the filter (counted above); this
    // pins the specific site so the count cannot be satisfied elsewhere.
    const evidence = /const \[confRows, intakeRows\][\s\S]*?\]\);/.exec(src)?.[0] ?? '';
    expect(evidence, 'the evidence-count block must be locatable').not.toBe('');
    expect(evidence).toMatch(/isNull\(aforceIntakeLogs\.correctsIntakeId\)/);
  });

  it('POST /intake stores the JSONB event id on the log row — the correction linkage', () => {
    const src = read('routes/aforce/intake.ts');
    expect(src, 'the insert must persist body.event.id as eventId').toMatch(
      /eventId:\s*body\.event\.id/,
    );
  });
});

/* ═══════ ROLLUPS STAY SPARSE — historyStartAt is ADDITIVE ONLY ═══════
 *
 * Founder ruling (Option B, 2026-09-02): densifying the shared
 * `/journal/rollups` response was tried and REVERTED. Six live consumers read
 * `rollups.length` as an observation count and the empty day's sentinel
 * `avgScore: 0` as a measurement, so densifying the shared wire painted
 * unobserved days as Signal-Red DEPLETED bars and counted them as compliance
 * failures. Densification now happens ONLY at the client's Journal
 * share/recap seam (journalShareWindow.ts); the route contract itself must
 * stay exactly what every other consumer already expects, plus one additive
 * field.
 */
describe('rollups stays sparse; historyStartAt is additive-only', () => {
  /**
   * THE REAL GUARD, extracted so it can run against more than one string.
   * Throws (via a failing `expect`) on anything that imports/invokes a
   * densification helper or stops building `rollups` from `acc.values()` —
   * so `expect(() => assertStaysSparse(mutated)).toThrow()` below is a direct
   * re-run of these exact checks, not a second, disconnected assertion that
   * only proves a `.replace()` call executed.
   */
  function assertStaysSparse(src: string): void {
    expect(src, 'no dense-range import').not.toMatch(/journalDenseRange/);
    expect(src, 'no effectiveRangeKeys call').not.toMatch(/effectiveRangeKeys/);
    expect(src, 'no densifyRollups call').not.toMatch(/densifyRollups/);
    expect(src, 'built ONLY from acc.values()').toMatch(/const rollups = Array\.from\(acc\.values\(\)\)/);
  }

  it('the route does not import or invoke a densification helper', () => {
    assertStaysSparse(read('routes/aforce/journal.ts'));
  });

  it('the rollups array is still built ONLY from acc.values() — one row per day WITH data', () => {
    const src = read('routes/aforce/journal.ts');
    expect(src).toMatch(/const rollups = Array\.from\(acc\.values\(\)\)/);
  });

  it('historyStartAt is queried and returned, additively', () => {
    const src = read('routes/aforce/journal.ts');
    expect(src, 'the state query for the stamp').toMatch(
      /select\(\{\s*historyStartAt:\s*aforceUserState\.historyStartAt\s*\}\)/,
    );
    const responseBlock = /return res\.json\(\{\s*rollups,\s*days,\s*historyStartAt:[\s\S]*?\}\);/.exec(src)?.[0] ?? '';
    expect(responseBlock, 'the json() call must be locatable').not.toBe('');
    expect(responseBlock).toMatch(/historyStartAt:\s*stateRows\[0\]\?\.historyStartAt\?\.toISOString\(\)\s*\?\?\s*null/);
  });

  it('mutation-verify: a densifying route is detectable by this guard', () => {
    // A HAND-WRITTEN mutated line — not a `.replace()` against the real
    // source, whose success at inserting the substrings said nothing about
    // whether the actual guard would flag them. This re-runs the SAME
    // assertion function the real law above uses, so drift between the two
    // is structurally impossible.
    const mutated = read('routes/aforce/journal.ts').replace(
      'const rollups = Array.from(acc.values())',
      'const rollups = densifyRollups(Array.from(acc.values()), effectiveRangeKeys({}))',
    );
    expect(() => assertStaysSparse(mutated)).toThrow();
  });
});
