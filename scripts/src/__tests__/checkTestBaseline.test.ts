/**
 * The gate that decides whether a PR has regressed, under test.
 *
 * It used to be a heredoc inline in ci.yml — the one piece of logic deciding
 * pass/fail for every pull request, and the one piece nothing could exercise.
 *
 * The case that matters most is the one it missed in production:
 * `skiniaCohortAccess.test.ts` stopped COLLECTING when a transitive
 * `@clerk/expo` import reached it. The SkinIA TestFlight containment gate
 * stopped running entirely, and to this check it was one more failed file —
 * 6 instead of 5, against a ceiling of 45 — so it passed, for a merge cycle.
 */
import { describe, expect, it } from 'vitest';

// @ts-expect-error — .mjs sibling, no types
import { analyseRun, isCollectionError, parseBaseline } from '../check-test-baseline.mjs';

const BASELINE = { files: 45, tests: 18, source: 'test' };

/** A file whose tests all passed. */
const passing = (name: string) => ({
  name: `/runner/AForce-Command/${name}`,
  status: 'passed',
  assertionResults: [
    { status: 'passed', title: 'a' },
    { status: 'passed', title: 'b' },
  ],
});

/** A file with a genuine assertion failure. */
const failing = (name: string, n = 1) => ({
  name: `/runner/AForce-Command/${name}`,
  status: 'failed',
  assertionResults: [
    ...Array.from({ length: n }, (_, i) => ({ status: 'failed', title: `bad ${i}` })),
    { status: 'passed', title: 'good' },
  ],
});

/**
 * A file that did not load. Vitest reports it as a failed suite with zero
 * assertionResults — the shape nothing else produces.
 */
const notCollected = (name: string, message = "SyntaxError: Unexpected token 'typeof'") => ({
  name: `/runner/AForce-Command/${name}`,
  status: 'failed',
  assertionResults: [],
  message,
});

const run = (results: unknown[]) => ({
  testResults: results,
  numFailedTests: results.reduce(
    (sum: number, r) =>
      sum +
      ((r as { assertionResults?: { status: string }[] }).assertionResults ?? []).filter(
        (a) => a.status === 'failed',
      ).length,
    0,
  ),
});

describe('a file that did not load is recognised for what it is', () => {
  it('a passing file is not a collection error', () => {
    expect(isCollectionError(passing('a.test.ts'))).toBe(false);
  });

  it('a file with a real failure is not a collection error', () => {
    expect(isCollectionError(failing('a.test.ts'))).toBe(false);
  });

  it('a failed file with no failed assertions IS one', () => {
    expect(isCollectionError(notCollected('a.test.ts'))).toBe(true);
  });

  it('a failed file with an empty assertion list is one, however it got there', () => {
    expect(isCollectionError({ name: 'x', status: 'failed' })).toBe(true);
  });
});

describe('the regression that slipped through', () => {
  /**
   * The exact shape of the event: a previously-passing suite stops loading,
   * and every count stays far under the ceiling.
   */
  it('fails the check even though both counts are far under baseline', () => {
    const before = run([passing('gate.test.ts'), failing('known.test.ts', 2)]);
    expect(analyseRun(before, BASELINE).ok).toBe(true);

    const after = run([notCollected('gate.test.ts'), failing('known.test.ts', 2)]);
    const result = analyseRun(after, BASELINE);

    // 2 failed files against a ceiling of 45; failed TESTS actually went DOWN.
    expect(result.failedFiles).toBe(2);
    expect(result.failedFiles).toBeLessThan(BASELINE.files);
    expect(result.failedTests).toBeLessThanOrEqual(BASELINE.tests);

    // And it fails anyway, which is the whole point.
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toContain('COLLECTION ERROR');
    expect(result.problems[0]).toContain('gate.test.ts');
  });

  it('names the file and quotes the reason, so the fix is obvious', () => {
    const result = analyseRun(run([notCollected('services/__tests__/skiniaCohortAccess.test.ts')]), BASELINE);
    expect(result.problems[0]).toContain('services/__tests__/skiniaCohortAccess.test.ts');
    expect(result.problems[0]).toContain("Unexpected token 'typeof'");
    expect(result.problems[0]).toContain('none of its tests ran');
  });

  it('reports every non-loading file, not just the first', () => {
    const result = analyseRun(
      run([notCollected('a.test.ts'), notCollected('b.test.ts'), notCollected('c.test.ts')]),
      BASELINE,
    );
    expect(result.unexpectedCollectionErrors).toHaveLength(3);
    expect(result.problems).toHaveLength(3);
  });
});

describe('the numeric ceiling still works as it did', () => {
  it('passes a run at the baseline', () => {
    const results = [
      ...Array.from({ length: 45 }, (_, i) => failing(`f${i}.test.ts`)),
      passing('ok.test.ts'),
    ];
    const report = { testResults: results, numFailedTests: 18 };
    expect(analyseRun(report, BASELINE).ok).toBe(true);
  });

  it('fails one file over', () => {
    const report = {
      testResults: Array.from({ length: 46 }, (_, i) => failing(`f${i}.test.ts`)),
      numFailedTests: 18,
    };
    const result = analyseRun(report, BASELINE);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: string) => p.includes('failed files exceeds'))).toBe(true);
  });

  it('fails one test over', () => {
    const report = { testResults: [failing('a.test.ts', 19)], numFailedTests: 19 };
    const result = analyseRun(report, BASELINE);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p: string) => p.includes('failed tests exceeds'))).toBe(true);
  });

  it('new passing tests never fail the check', () => {
    const report = run([...Array.from({ length: 200 }, (_, i) => passing(`p${i}.test.ts`))]);
    expect(analyseRun(report, BASELINE).ok).toBe(true);
  });

  it('counts failed tests itself when the report omits the total', () => {
    const report = { testResults: [failing('a.test.ts', 3)] };
    expect(analyseRun(report, BASELINE).failedTests).toBe(3);
  });
});

describe('the baseline document is the source of truth', () => {
  it('parses the documented numbers', () => {
    const doc = `
| Metric | Value |
|---|---|
| **Test files — failed** | **45** |
| **Tests — failed** | **18** |
`;
    expect(parseBaseline(doc)).toMatchObject({ files: 45, tests: 18 });
  });

  it('falls back, loudly, when the table cannot be parsed', () => {
    const result = parseBaseline('nothing resembling the table');
    expect(result).toMatchObject({ files: 45, tests: 18 });
    expect(result.source).toContain('fallback');
  });

  it('uses whatever the document says, not a hardcoded number', () => {
    const doc = `| **Test files — failed** | **3** |\n| **Tests — failed** | **1** |`;
    expect(parseBaseline(doc)).toMatchObject({ files: 3, tests: 1 });
  });
});

describe('a clean run passes', () => {
  it('no failures, no collection errors', () => {
    const result = analyseRun(run([passing('a.test.ts'), passing('b.test.ts')]), BASELINE);
    expect(result).toMatchObject({ ok: true, failedFiles: 0, failedTests: 0 });
    expect(result.collectionErrors).toEqual([]);
  });

  it('tolerates the documented failures without complaint', () => {
    const result = analyseRun(run([failing('known.test.ts', 2), passing('ok.test.ts')]), BASELINE);
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
  });
});
