/**
 * The gate that decides whether a PR has regressed, under test.
 *
 * It used to be a heredoc inline in ci.yml — the one piece of logic deciding
 * pass/fail for every pull request, and the one piece nothing could exercise.
 *
 * Two cases matter most, because both happened in production:
 *
 * 1. `skiniaCohortAccess.test.ts` stopped COLLECTING when a transitive
 *    `@clerk/expo` import reached it. The SkinIA TestFlight containment gate
 *    stopped running entirely, and to this check it was one more failed file
 *    — 6 instead of 5, against a ceiling of 45 — so it passed, for a merge
 *    cycle.
 *
 * 2. On 2026-08-12 governance/TEST-BASELINE.md declared the ceiling zero in
 *    prose while keeping the 45/18 tables "as the historical record" — and
 *    this checker kept reading those tables (with 45/18 fallbacks for when
 *    they did not parse). For six weeks up to eighteen failing assertions
 *    could merge green. The blocks marked "the real document" below bind the
 *    gate to the document that is actually in the repository, so the two can
 *    never silently diverge again.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  ACTIVE_POLICY_BEGIN,
  ACTIVE_POLICY_END,
  analyseRun,
  isCollectionError,
  parseActivePolicy,
  parseLegacyTable,
  resolveCeiling,
  validateReport,
  // @ts-expect-error — .mjs sibling, no types
} from '../check-test-baseline.mjs';

/** The document as it exists in this checkout — the policy of record after merge. */
const REAL_DOC = readFileSync(new URL('../../../governance/TEST-BASELINE.md', import.meta.url), 'utf8');

/**
 * The §2 table verbatim from the document as it stood on main before the
 * active-policy block existed (commit 4b80245e, 2026-08-12). This is what a
 * PR is judged against on the TARGET side until main carries the block.
 */
const LEGACY_TARGET_DOC = `
> ## 2026-08-12 — THE BASELINE IS ZERO
>
> **Both causes are fixed. The accepted failure ceiling is now 0 files / 0 tests.**

| Metric | 2026-07-22 recorded | 2026-08-05 reconciled |
|---|---|---|
| **Test files — total** | 255 | **366** |
| Test files — passed | 209 | **321** |
| **Test files — failed** | **45** | 46 (pre-RC-1 historical) |
| **Tests — total** | 2614 | **4644** |
| Tests — passed | 2596 | **4626** |
| **Tests — failed** | **18** | 18 (unchanged) |
`;

const activeBlock = (files: number | string, tests: number | string) => `
${ACTIVE_POLICY_BEGIN}
| Allowance | Value |
|---|---|
| **Active failure allowance — test files** | **${files}** |
| **Active failure allowance — tests** | **${tests}** |
${ACTIVE_POLICY_END}
`;

const BASELINE = { files: 45, tests: 18, source: 'test' };
const ZERO = { files: 0, tests: 0, source: 'test' };

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

/** A complete, structurally valid vitest JSON report (what the CLI validates). */
const fullReport = (results: ReturnType<typeof passing>[]) => ({
  numTotalTestSuites: results.length,
  numPassedTestSuites: results.filter((r) => r.status === 'passed').length,
  numFailedTestSuites: results.filter((r) => r.status === 'failed').length,
  numPendingTestSuites: 0,
  numTotalTests: results.reduce((s, r) => s + r.assertionResults.length, 0),
  numPassedTests: results.reduce((s, r) => s + r.assertionResults.filter((a) => a.status === 'passed').length, 0),
  numFailedTests: results.reduce((s, r) => s + r.assertionResults.filter((a) => a.status === 'failed').length, 0),
  numPendingTests: 0,
  numTodoTests: 0,
  startTime: 0,
  success: results.every((r) => r.status === 'passed'),
  testResults: results,
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

describe('the active policy is read from one block, and only from there', () => {
  it('parses the block', () => {
    expect(parseActivePolicy(activeBlock(0, 0))).toMatchObject({ ok: true, files: 0, tests: 0 });
    expect(parseActivePolicy(activeBlock(3, 1))).toMatchObject({ ok: true, files: 3, tests: 1 });
  });

  it('ignores every table outside the block — including the retired 45 / 18', () => {
    const doc = `${LEGACY_TARGET_DOC}\n${activeBlock(0, 0)}\n${LEGACY_TARGET_DOC}`;
    expect(parseActivePolicy(doc)).toMatchObject({ ok: true, files: 0, tests: 0 });
  });

  it('fails closed when the block is absent — there is no fallback value', () => {
    const result = parseActivePolicy(LEGACY_TARGET_DOC);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('no active-policy block');
    expect(result).not.toHaveProperty('files');
    expect(result).not.toHaveProperty('tests');
  });

  it('fails closed on an empty document', () => {
    expect(parseActivePolicy('')).toMatchObject({ ok: false });
    expect(parseActivePolicy(undefined)).toMatchObject({ ok: false });
  });

  it('fails closed when there are two blocks — ambiguous policy is no policy', () => {
    const result = parseActivePolicy(`${activeBlock(0, 0)}\n${activeBlock(5, 5)}`);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('exactly one block');
  });

  it('fails closed when a row is missing', () => {
    const doc = `${ACTIVE_POLICY_BEGIN}\n| **Active failure allowance — test files** | **0** |\n${ACTIVE_POLICY_END}`;
    const result = parseActivePolicy(doc);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Active failure allowance — tests');
  });

  it('fails closed when a row is duplicated inside the block', () => {
    const doc = `${ACTIVE_POLICY_BEGIN}
| **Active failure allowance — test files** | **0** |
| **Active failure allowance — test files** | **9** |
| **Active failure allowance — tests** | **0** |
${ACTIVE_POLICY_END}`;
    const result = parseActivePolicy(doc);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('ambiguous');
  });

  it('fails closed on a non-integer value', () => {
    expect(parseActivePolicy(activeBlock('none', 0)).ok).toBe(false);
    expect(parseActivePolicy(activeBlock(0, '-1')).ok).toBe(false);
    expect(parseActivePolicy(activeBlock(0, '1.5')).ok).toBe(false);
  });

  it('fails closed when the markers are reversed', () => {
    const doc = `${ACTIVE_POLICY_END}\n| **Active failure allowance — test files** | **0** |\n| **Active failure allowance — tests** | **0** |\n${ACTIVE_POLICY_BEGIN}`;
    expect(parseActivePolicy(doc).ok).toBe(false);
  });
});

describe('the real document', () => {
  it('carries exactly one active-policy block and it says zero — the 2026-08-12 statement, enforced', () => {
    expect(parseActivePolicy(REAL_DOC)).toMatchObject({ ok: true, files: 0, tests: 0 });
  });

  it('still preserves the historical 45 / 18 record, and the checker does not read it', () => {
    // The history is kept, as governance requires…
    expect(parseLegacyTable(REAL_DOC)).toMatchObject({ ok: true, files: 45, tests: 18, legacy: true });
    // …and it has no bearing on the active allowance.
    expect(resolveCeiling({ target: REAL_DOC, head: REAL_DOC })).toMatchObject({ ok: true, files: 0, tests: 0 });
  });

  it('a valid zero-failure run passes against the real document', () => {
    const policy = parseActivePolicy(REAL_DOC);
    const result = analyseRun(fullReport([passing('a.test.ts'), passing('b.test.ts')]), policy);
    expect(result).toMatchObject({ ok: true, failedFiles: 0, failedTests: 0 });
  });

  it('ONE failing assertion fails against the real document', () => {
    const policy = parseActivePolicy(REAL_DOC);
    const result = analyseRun(fullReport([passing('a.test.ts'), failing('b.test.ts', 1)]), policy);
    expect(result.ok).toBe(false);
    expect(result.failedTests).toBe(1);
    expect(result.problems.some((p: string) => p.includes('1 failed tests exceeds documented baseline of 0'))).toBe(true);
  });

  it('one unexpected collection error fails against the real document', () => {
    const policy = parseActivePolicy(REAL_DOC);
    const result = analyseRun(fullReport([passing('a.test.ts'), notCollected('gate.test.ts')]), policy);
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toContain('COLLECTION ERROR');
  });
});

describe('a PR is judged against the target branch AND its own copy — the lower wins', () => {
  it('the transition case: target still legacy, head carries the block → head governs', () => {
    const ceiling = resolveCeiling({ target: LEGACY_TARGET_DOC, head: activeBlock(0, 0) });
    expect(ceiling).toMatchObject({ ok: true, files: 0, tests: 0 });
    expect(ceiling.target.legacy).toBe(true);
    expect(ceiling.head.legacy).toBeUndefined();
  });

  it('a PR cannot raise the allowance by editing its own copy', () => {
    const ceiling = resolveCeiling({ target: activeBlock(0, 0), head: activeBlock(40, 20) });
    expect(ceiling).toMatchObject({ ok: true, files: 0, tests: 0 });
  });

  it('a PR may tighten the allowance', () => {
    const ceiling = resolveCeiling({ target: activeBlock(3, 3), head: activeBlock(0, 0) });
    expect(ceiling).toMatchObject({ ok: true, files: 0, tests: 0 });
  });

  it('a head document without the block fails closed — the legacy table is never accepted for the head', () => {
    const result = resolveCeiling({ target: activeBlock(0, 0), head: LEGACY_TARGET_DOC });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('head governance/TEST-BASELINE.md');
  });

  it('a target with neither block nor legacy table fails closed', () => {
    const result = resolveCeiling({ target: 'nothing resembling policy', head: activeBlock(0, 0) });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('target-baseline.md');
  });

  it('the legacy reader is a transition aid, not a policy source', () => {
    expect(parseLegacyTable(LEGACY_TARGET_DOC)).toMatchObject({ ok: true, files: 45, tests: 18, legacy: true });
    expect(parseLegacyTable('no table here').ok).toBe(false);
  });
});

describe('a report that reports nothing verifies nothing', () => {
  it('a complete report with executed tests is accepted', () => {
    expect(validateReport(fullReport([passing('a.test.ts')]))).toMatchObject({ ok: true });
  });

  it('a missing report fails closed', () => {
    expect(validateReport(undefined).ok).toBe(false);
    expect(validateReport(null).ok).toBe(false);
  });

  it('a non-object fails closed', () => {
    expect(validateReport('{}').ok).toBe(false);
    expect(validateReport([]).ok).toBe(false);
    expect(validateReport(42).ok).toBe(false);
  });

  it('an object with no testResults fails closed', () => {
    expect(validateReport({ numTotalTests: 5 }).ok).toBe(false);
  });

  it('an empty testResults fails closed even when every count reads zero', () => {
    const result = validateReport({ ...fullReport([]), numTotalTests: 0, testResults: [] });
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toContain('cannot be accepted as zero failures');
  });

  it('a run that executed no tests fails closed', () => {
    const report = { ...fullReport([passing('a.test.ts')]), numTotalTests: 0 };
    expect(validateReport(report).ok).toBe(false);
    const missing = fullReport([passing('a.test.ts')]) as Record<string, unknown>;
    delete missing.numTotalTests;
    expect(validateReport(missing).ok).toBe(false);
  });

  it('a malformed test-file entry fails closed', () => {
    const report = { ...fullReport([passing('a.test.ts')]), testResults: [{ bogus: true }] };
    expect(validateReport(report).ok).toBe(false);
  });
});

describe('a clean run passes', () => {
  it('no failures, no collection errors', () => {
    const result = analyseRun(run([passing('a.test.ts'), passing('b.test.ts')]), ZERO);
    expect(result).toMatchObject({ ok: true, failedFiles: 0, failedTests: 0 });
    expect(result.collectionErrors).toEqual([]);
  });

  it('a documented non-zero allowance is honoured when a document declares one', () => {
    const result = analyseRun(run([failing('known.test.ts', 2), passing('ok.test.ts')]), BASELINE);
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
  });
});
