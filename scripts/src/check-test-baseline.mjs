#!/usr/bin/env node
/**
 * Test-baseline comparison — the gate that decides pass/fail for every PR.
 *
 * WHY THIS MOVED OUT OF ci.yml. The comparison used to be a heredoc inline in
 * the workflow, which meant the one piece of logic deciding whether a PR has
 * regressed could not itself be tested. It can now: every function below is
 * pure and `__tests__/checkTestBaseline.test.ts` drives it against fixtures
 * AND against the real governance document.
 *
 * WHERE THE ALLOWANCE COMES FROM — AND WHERE IT DOES NOT. On 2026-08-12
 * governance/TEST-BASELINE.md declared "the accepted failure ceiling is now
 * 0 files / 0 tests" — in prose, above tables that were deliberately kept
 * "as the historical record". This checker read those historical tables.
 * So for six weeks the document said zero and the gate enforced 45 files /
 * 18 tests, with matching fallback constants for when the table did not
 * parse: up to eighteen failing assertions could merge green.
 *
 * The allowance is now read from ONE clearly delimited block in that
 * document (`<!-- test-baseline:active-policy:begin/end -->`) and from
 * nowhere else. Historical tables are ignored by construction. There is NO
 * fallback: a document without the block, with two blocks, with a missing or
 * duplicated row, or with a non-integer value fails this check closed. A
 * report that is missing, not JSON, or that executed no tests fails closed
 * too — a run that reports nothing verifies nothing.
 *
 * WHICH DOCUMENT. On a pull request ci.yml hands this script BOTH the
 * target branch's copy of the document and the PR's own copy, and the LOWER
 * allowance per row is enforced. A PR can therefore tighten the allowance
 * but never loosen it by editing its own copy — the protection PR 2.2B
 * added (judge against the target, not the PR) is preserved, and the
 * reviewer-applied `baseline-override` label is still required for any edit.
 *
 * COLLECTION ERRORS. A file that does not load reports as a failed suite
 * carrying zero assertions. It is judged separately from failing tests and is
 * never subject to any allowance: a suite that reports nothing verifies
 * nothing. Known-cause collection failures may be tolerated by exact path in
 * ALLOWED_COLLECTION_FAILURES — each one a recorded decision, never a glob.
 *
 * Run:  node scripts/src/check-test-baseline.mjs <report.json> <target-baseline.md> <head-baseline.md>
 *
 * Exit codes: 0 pass · 1 regression (failures or collection errors) ·
 * 2 fail-closed (policy or report missing, malformed or ambiguous).
 *
 * WIRED INTO CI. `.github/workflows/ci.yml`'s `tests-baseline` job invokes
 * this directly; it is what decides pass or fail for every pull request.
 */
import { existsSync, readFileSync } from 'node:fs';

/**
 * Collection failures that are expected and accounted for.
 *
 * EMPTY, deliberately. The canonical CI run sets a placeholder DATABASE_URL in
 * vitest.setup.ts, and DB-dependent suites guard themselves with
 * `describe.runIf(DB_TESTS)` — so they SKIP rather than fail to load, and a
 * clean run has zero collection errors.
 *
 * If a genuine, understood one appears, add its exact path here WITH the
 * reason. Do not add a prefix or a glob: the point is that each entry is a
 * decision somebody made.
 */
export const ALLOWED_COLLECTION_FAILURES = Object.freeze({
  // 'path/to/file.test.ts': 'why this one cannot load in the canonical run',
});

export const ACTIVE_POLICY_BEGIN = '<!-- test-baseline:active-policy:begin -->';
export const ACTIVE_POLICY_END = '<!-- test-baseline:active-policy:end -->';
export const ROW_FILES = 'Active failure allowance — test files';
export const ROW_TESTS = 'Active failure allowance — tests';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const count = (haystack, needle) => haystack.split(needle).length - 1;

/**
 * One row of the active-policy table, e.g.
 *   | **Active failure allowance — tests** | **0** |
 * Exactly one occurrence inside the block; a non-negative integer value.
 */
function readRow(block, label) {
  const re = new RegExp(`\\*\\*${escapeRe(label)}\\*\\*\\s*\\|\\s*\\*\\*(\\d+)\\*\\*`, 'g');
  const matches = [...block.matchAll(re)];
  if (matches.length === 0) return { ok: false, reason: `row "${label}" is missing or malformed` };
  if (matches.length > 1) return { ok: false, reason: `row "${label}" appears ${matches.length} times — ambiguous` };
  return { ok: true, value: Number(matches[0][1]) };
}

/**
 * The ACTIVE failure allowance. Reads only the text between the two markers;
 * everything outside — including the historical 2026-07-22 / 2026-08-05
 * tables that carry the retired 45 / 18 figures — is ignored by construction.
 *
 * Returns { ok: true, files, tests, source } or { ok: false, reason }. There
 * is deliberately no fallback value: an unreadable policy is a failed check.
 */
export function parseActivePolicy(markdown, label = 'governance/TEST-BASELINE.md') {
  if (typeof markdown !== 'string' || markdown.length === 0) {
    return { ok: false, reason: `${label}: document is empty or not text` };
  }
  const begins = count(markdown, ACTIVE_POLICY_BEGIN);
  const ends = count(markdown, ACTIVE_POLICY_END);
  if (begins === 0 && ends === 0) {
    return { ok: false, reason: `${label}: no active-policy block (${ACTIVE_POLICY_BEGIN} … ${ACTIVE_POLICY_END})` };
  }
  if (begins !== 1 || ends !== 1) {
    return { ok: false, reason: `${label}: found ${begins} begin / ${ends} end markers — exactly one block is required` };
  }
  const b = markdown.indexOf(ACTIVE_POLICY_BEGIN) + ACTIVE_POLICY_BEGIN.length;
  const e = markdown.indexOf(ACTIVE_POLICY_END);
  if (e < b) return { ok: false, reason: `${label}: end marker precedes begin marker` };

  const block = markdown.slice(b, e);
  const files = readRow(block, ROW_FILES);
  if (!files.ok) return { ok: false, reason: `${label}: ${files.reason}` };
  const tests = readRow(block, ROW_TESTS);
  if (!tests.ok) return { ok: false, reason: `${label}: ${tests.reason}` };

  return { ok: true, files: files.value, tests: tests.value, source: `${label} (active-policy block)` };
}

/**
 * TRANSITION ONLY. Reads the pre-2026-09-23 table format
 * (`**Test files — failed** | **N**`) that this checker used to enforce.
 *
 * It exists for exactly one situation: the pull request that introduces the
 * active-policy block is judged against a TARGET branch whose document does
 * not carry the block yet. It is never applied to the head document (see
 * resolveCeiling), and once main carries the block this path is unreachable.
 * It prints as "LEGACY" wherever it is used so that fact stays visible.
 */
export function parseLegacyTable(markdown, label = 'target-baseline.md') {
  if (typeof markdown !== 'string') return { ok: false, reason: `${label}: document is not text` };
  const f = markdown.match(/\*\*Test files — failed\*\*\s*\|\s*\*\*(\d+)\*\*/);
  const t = markdown.match(/\*\*Tests — failed\*\*\s*\|\s*\*\*(\d+)\*\*/);
  if (!f || !t) {
    return { ok: false, reason: `${label}: neither an active-policy block nor a legacy baseline table` };
  }
  return {
    ok: true,
    files: Number(f[1]),
    tests: Number(t[1]),
    legacy: true,
    source: `${label} (LEGACY table — transition only; carries no active policy)`,
  };
}

/**
 * The allowance this run is judged against.
 *
 *   head   — the document in the commit under test. MUST carry the active
 *            block; anything else fails closed. This is what a merge would
 *            make the policy of record.
 *   target — the document on the branch being merged into. Active block if
 *            present; the legacy table is accepted for it (and only it) during
 *            the transition.
 *
 * The effective allowance is the LOWER of the two, per row. A PR editing its
 * own copy can therefore tighten the gate, never loosen it: the target still
 * bounds it from above, exactly as before.
 */
export function resolveCeiling({ target, head }) {
  const headPolicy = parseActivePolicy(head, 'head governance/TEST-BASELINE.md');
  if (!headPolicy.ok) return { ok: false, reason: headPolicy.reason };

  let targetPolicy = parseActivePolicy(target, 'target-baseline.md');
  if (!targetPolicy.ok) targetPolicy = parseLegacyTable(target, 'target-baseline.md');
  if (!targetPolicy.ok) return { ok: false, reason: targetPolicy.reason };

  return {
    ok: true,
    files: Math.min(targetPolicy.files, headPolicy.files),
    tests: Math.min(targetPolicy.tests, headPolicy.tests),
    source: `min(${targetPolicy.source}, ${headPolicy.source})`,
    target: targetPolicy,
    head: headPolicy,
  };
}

/**
 * A vitest JSON report we are willing to judge. Anything else fails closed:
 * a missing file, a non-object, no testResults, an empty testResults, or a
 * run that executed no tests cannot be accepted as "zero failures".
 */
export function validateReport(report) {
  const problems = [];
  if (report === null || typeof report !== 'object' || Array.isArray(report)) {
    return { ok: false, problems: ['report is not a JSON object'] };
  }
  if (!Array.isArray(report.testResults)) {
    problems.push('report.testResults is not an array');
  } else if (report.testResults.length === 0) {
    problems.push('report.testResults is empty — a run that executed no test files cannot be accepted as zero failures');
  } else {
    report.testResults.forEach((t, i) => {
      if (t === null || typeof t !== 'object' || typeof t.name !== 'string' || typeof t.status !== 'string') {
        problems.push(`report.testResults[${i}] is not a test-file result (needs string name and status)`);
      }
    });
  }
  if (!Number.isInteger(report.numTotalTests) || report.numTotalTests < 1) {
    problems.push('report.numTotalTests is missing, not an integer, or below 1 — a run that executed no tests cannot be accepted as zero failures');
  }
  return { ok: problems.length === 0, problems };
}

/** Relative to the repo root, for stable comparison against the allow-list. */
function relativePath(name) {
  const marker = 'AForce-Command/';
  const i = name.lastIndexOf(marker);
  return i === -1 ? name : name.slice(i + marker.length);
}

/**
 * A file that failed with no failed assertions did not RUN its tests.
 *
 * Vitest reports an unloadable file as a failed suite carrying zero
 * assertionResults. A file whose tests all passed is `passed`; a file with a
 * genuine failure carries at least one failed assertion. Only the
 * did-not-load case produces this shape.
 */
export function isCollectionError(testResult) {
  if (testResult.status !== 'failed') return false;
  const results = testResult.assertionResults ?? [];
  return !results.some((a) => a.status === 'failed');
}

export function analyseRun(report, baseline) {
  const files = report.testResults ?? [];

  const collectionErrors = files.filter(isCollectionError).map((t) => ({
    path: relativePath(t.name),
    message: (t.message ?? '').split('\n')[0].slice(0, 200),
  }));

  const unexpectedCollectionErrors = collectionErrors.filter(
    (e) => !(e.path in ALLOWED_COLLECTION_FAILURES),
  );

  const failedFiles = files.filter((t) => t.status === 'failed').length;
  const failedTests =
    report.numFailedTests ??
    files.reduce(
      (sum, t) => sum + (t.assertionResults ?? []).filter((a) => a.status === 'failed').length,
      0,
    );

  const problems = [];
  for (const e of unexpectedCollectionErrors) {
    problems.push(
      `COLLECTION ERROR — ${e.path} did not load, so none of its tests ran. ` +
        `This is not a failing test and no allowance applies to it: ` +
        `a suite that reports nothing verifies nothing. ${e.message}`,
    );
  }
  if (failedFiles > baseline.files) {
    problems.push(
      `${failedFiles} failed files exceeds documented baseline of ${baseline.files} — new regression.`,
    );
  }
  if (failedTests > baseline.tests) {
    problems.push(
      `${failedTests} failed tests exceeds documented baseline of ${baseline.tests} — new regression.`,
    );
  }

  return {
    failedFiles,
    failedTests,
    collectionErrors,
    unexpectedCollectionErrors,
    problems,
    ok: problems.length === 0,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────
// Guarded so the module can be imported by its tests without running.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ''))) {
  const [reportPath, targetPath, headPath] = process.argv.slice(2);

  const failClosed = (why) => {
    console.log(`::error::${why}`);
    console.log('FAIL-CLOSED: this check cannot pass without an unambiguous policy and a real report.');
    process.exit(2);
  };

  if (!reportPath || !targetPath || !headPath) {
    failClosed('usage: check-test-baseline.mjs <report.json> <target-baseline.md> <head-baseline.md> — all three are required');
  }
  for (const p of [reportPath, targetPath, headPath]) {
    if (!existsSync(p)) failClosed(`${p} does not exist`);
  }

  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch (err) {
    failClosed(`${reportPath} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const shape = validateReport(report);
  if (!shape.ok) failClosed(`${reportPath}: ${shape.problems.join('; ')}`);

  const ceiling = resolveCeiling({
    target: readFileSync(targetPath, 'utf8'),
    head: readFileSync(headPath, 'utf8'),
  });
  if (!ceiling.ok) failClosed(ceiling.reason);

  const result = analyseRun(report, ceiling);

  console.log(`Policy source: ${ceiling.source}`);
  if (ceiling.target.legacy) {
    console.log('::warning::Target branch document carries no active-policy block; its LEGACY table was read for the target side only. The head document governs the effective allowance.');
  }
  console.log(`Allowance: ${ceiling.files} failed files / ${ceiling.tests} failed tests`);
  console.log(`Observed:  ${result.failedFiles} failed files / ${result.failedTests} failed tests (${report.numTotalTests} tests executed)`);
  console.log(`Collection errors: ${result.collectionErrors.length}`);

  for (const problem of result.problems) console.log(`::error::${problem}`);

  if (!result.ok) {
    console.log(
      'New PASSING tests are always fine; any FAILURE above the allowance, or a file that stops loading, fails this check. See governance/TEST-BASELINE.md §0 and §5.',
    );
    process.exit(1);
  }
  console.log('Within the active allowance, and every test file loaded.');
}
