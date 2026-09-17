#!/usr/bin/env node
/**
 * Test-baseline comparison, with collection errors treated as their own class.
 *
 * WHY THIS MOVED OUT OF ci.yml. The comparison used to be a heredoc inline in
 * the workflow, which meant the one piece of logic deciding whether a PR has
 * regressed could not itself be tested. It can now: `analyseRun` is pure and
 * `__tests__/checkTestBaseline.test.ts` drives it against fixtures.
 *
 * WHAT IT ADDS. The old comparison asked two questions — how many files
 * failed, how many tests failed — and passed if both sat under a documented
 * ceiling. That ceiling is 45 files against roughly 5 observed, so there is
 * about forty files of headroom, and a file sliding into it is invisible.
 *
 * That headroom hid a real event. `skiniaCohortAccess.test.ts` stopped
 * COLLECTING when a transitive `@clerk/expo` import reached it:
 *
 *     SyntaxError: Unexpected token 'typeof'
 *     Tests  no tests
 *
 * The SkinIA TestFlight containment gate stopped running entirely. To this
 * check it was one more failed file — 6 instead of 5, far under 45 — so it
 * passed, for a merge cycle, while the property it guards went unverified.
 *
 * A COLLECTION ERROR IS NOT A FAILING TEST. A failing test tells you
 * something is wrong. A file that does not load tells you NOTHING, about
 * anything it contains, and it does so while looking quieter than before. So
 * it is judged separately and it is not subject to the ceiling at all.
 *
 * Known-cause collection failures are still tolerated by exact file path, so
 * a documented environmental gap does not become a permanent red build — but
 * each one has to be listed, which is the difference between a decision and
 * an accident.
 *
 * Run:  node scripts/src/check-test-baseline.mjs <report.json> <baseline.md>
 *
 * ────────────────────────────────────────────────────────────────────────
 * NOT WIRED INTO CI YET. `.github/workflows/ci.yml` still runs the original
 * inline comparison, so the collection-error rule below is NOT enforcing
 * anything on pull requests today. Wiring it is a one-line edit to that
 * workflow — replace the `NODESCRIPT` heredoc under "Compare against
 * documented baseline" with:
 *
 *     run: node scripts/src/check-test-baseline.mjs vitest-report.json target-baseline.md
 *
 * which could not be pushed from the session that wrote this: the repo's
 * git credential is a keychain PAT without the `workflow` scope, and GitHub
 * refuses any push touching .github/workflows/ without it.
 *
 * Until that edit lands, a test file that stops loading still slides under
 * the numeric ceiling exactly as skiniaCohortAccess.test.ts did.
 * ────────────────────────────────────────────────────────────────────────
 */
import { readFileSync } from 'node:fs';

/**
 * Collection failures that are expected and accounted for.
 *
 * EMPTY, deliberately. The canonical CI run sets a placeholder DATABASE_URL in
 * vitest.setup.ts, and DB-dependent suites guard themselves with
 * `describe.runIf(DB_TESTS)` — so they SKIP rather than fail to load, and a
 * clean run has zero collection errors. Verified against a full local run
 * before this check was written.
 *
 * If a genuine, understood one appears, add its exact path here WITH the
 * reason. Do not add a prefix or a glob: the point is that each entry is a
 * decision somebody made.
 */
export const ALLOWED_COLLECTION_FAILURES = Object.freeze({
  // 'path/to/file.test.ts': 'why this one cannot load in the canonical run',
});

/** Fallbacks — kept in sync with governance/TEST-BASELINE.md §2. */
export const FALLBACK_FAILED_FILES = 45;
export const FALLBACK_FAILED_TESTS = 18;

export function parseBaseline(markdown) {
  const filesMatch = markdown.match(/\*\*Test files — failed\*\*\s*\|\s*\*\*(\d+)\*\*/);
  const testsMatch = markdown.match(/\*\*Tests — failed\*\*\s*\|\s*\*\*(\d+)\*\*/);
  if (filesMatch && testsMatch) {
    return {
      files: Number(filesMatch[1]),
      tests: Number(testsMatch[1]),
      source: 'governance/TEST-BASELINE.md (parsed at runtime)',
    };
  }
  return {
    files: FALLBACK_FAILED_FILES,
    tests: FALLBACK_FAILED_TESTS,
    source: 'pinned fallback constants (doc table did not parse — fix the doc)',
  };
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
        `This is not a failing test and the baseline ceiling does not apply to it: ` +
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
  const [reportPath = 'vitest-report.json', baselinePath = 'target-baseline.md'] =
    process.argv.slice(2);

  const baseline = parseBaseline(readFileSync(baselinePath, 'utf8'));
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const result = analyseRun(report, baseline);

  console.log(`Baseline source: ${baseline.source}`);
  console.log(`Baseline:  ${baseline.files} failed files / ${baseline.tests} failed tests`);
  console.log(`Observed:  ${result.failedFiles} failed files / ${result.failedTests} failed tests`);
  console.log(`Collection errors: ${result.collectionErrors.length}`);

  if (baseline.source.startsWith('pinned')) {
    console.log('::warning::Could not parse governance/TEST-BASELINE.md; using pinned fallbacks.');
  }

  for (const problem of result.problems) console.log(`::error::${problem}`);

  if (!result.ok) {
    console.log(
      'New PASSING tests are always fine; only a rise in FAILURES, or a file that stops loading, fails this check. See governance/TEST-BASELINE.md §5.',
    );
    process.exit(1);
  }
  console.log('Within documented baseline, and every test file loaded.');
}
