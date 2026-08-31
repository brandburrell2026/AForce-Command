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
