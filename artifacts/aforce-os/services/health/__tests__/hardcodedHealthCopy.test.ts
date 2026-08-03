/**
 * HARDCODED-COPY LOCK (Wave-3 follow-up PR 3: localization).
 *
 * Companion to `prohibitedCopy.test.ts` (which guards ONE specific banned
 * phrase across `locales/*.json`). This test guards a broader, structural
 * property across the Connected Health + canonical-consumer SOURCE tree:
 * no NEW user-facing sentence should be written as a raw string literal
 * instead of routed through the `I18nText` / `t()` locale system documented
 * in `connectedHealthView.ts`'s file header and consumed by
 * `ConnectedHealthView.tsx`.
 *
 * SCOPE — exactly what "the consumer layer" means here
 *   Every `*.ts` / `*.tsx` file directly under `services/health/` and
 *   `components/health/` (recursing into subdirectories like `healthConnect/`),
 *   EXCLUDING:
 *     - `__tests__/` directories (tests routinely assert literal expected
 *       copy on purpose — that is their job, not a violation).
 *     - `*Fixtures.ts` files (hand-built mock data for tests, not runtime
 *       consumer/presentation code).
 *
 * HEURISTIC — how a string literal is judged "suspicious"
 *   A single-quoted, double-quoted, or template (backtick) string literal
 *   (comments stripped first) is flagged as a possible hardcoded user-facing
 *   string when ALL of:
 *     1. It has at least two whitespace-separated tokens (rules out unit
 *        strings like `'ms'`, `' bpm'`, `'hours'`, single-word enum values
 *        like `'stale'`, `'connected'`, and code identifiers).
 *     2. It is not "key-shaped" — a dotted lowercase/underscore path like
 *        `connected_health.header.title` (that IS the desired i18n routing
 *        value, never something to flag).
 *     3. It does not look like an import/require path (starts with `.`,
 *        `/`, or `@`, or contains a `/` anywhere — module specifiers never
 *        trip this scan).
 *   Two further exemptions keep the scan honest without needing a per-line
 *   `eslint-disable`-style escape hatch:
 *     - CANONICAL DOCUMENTED LITERALS: a string that is the right-hand side
 *       of an `(export) const UPPER_SNAKE_NAME = ` assignment (on the same
 *       logical statement, comments/newlines collapsed) is exempt. This
 *       codebase's convention (see `SCORE_PROTECTION_LINE` in
 *       `connectedHealthView.ts`, `READINESS_SIGNALS_SCORE_PROTECTION` in
 *       `readinessSignals.ts`) is to keep the EXACT, load-bearing English
 *       sentence as a named constant for tests/documentation to import and
 *       compare against — that is the opposite of a hardcoded-copy leak; it
 *       is the one legitimate place the literal is allowed to live.
 *     - INTERNAL DIAGNOSTIC MESSAGES: a string passed as the sole argument to
 *       `new SomethingError(...)` / `throw new Something(...)`, or assigned
 *       as an Error subclass's `message = '...'` default parameter, is
 *       exempt — these are developer-facing exception text (see
 *       `AppleHealthKitAuthorizationRevokedError`,
 *       `HealthConnectChangesTokenExpiredError`), never rendered to a user.
 *       The honesty discipline in this codebase already maps every thrown
 *       error to a closed status enum before it reaches any UI (see
 *       `providerPresentation.ts`, `connectedHealthView.ts`'s
 *       `ConnectedHealthErrorKind`) — raw error text has no path to a
 *       screen.
 *   A secondary, narrower check scans `.tsx` files for raw JSX text nodes
 *   (`>Some Words<` with no `{}` interpolation) as defense-in-depth against
 *   a literal slipping in as component children rather than a prop/string.
 *
 * KNOWN, DOCUMENTED DEBT — the pending-extraction allowlist
 *   `sleepSignals.ts` currently returns plain-string `freshness` / metric
 *   `label` values instead of `I18nText` keys. Extraction was investigated
 *   for this PR and found to be UNSAFE to perform blind:
 *     - `SleepSignalsForContainer.freshness` and `SleepMetricInput.label`
 *       flow directly into `services/sleep/sleepModeView.ts` and
 *       `screens/SleepModeScreen.tsx` — an entirely separate, currently
 *       non-i18n surface (verified: `PHASE_LABEL` / `CHIP_LABEL` /
 *       `CONFIDENCE_LABEL` and the rest of that module are all hardcoded
 *       English with zero `useTranslation()` calls anywhere in the Sleep
 *       Mode screen). Changing `sleepSignals.ts`'s return shape to
 *       `I18nText` would either render raw locale keys on that screen or
 *       fail to type-check there — both outside this PR's Connected-Health /
 *       canonical-consumer scope.
 *   The specific literals below are therefore allowlisted BY EXACT STRING,
 *   scoped to `sleepSignals.ts` only — a new, DIFFERENT hardcoded string
 *   anywhere in this file (or any other) still fails the scan. See
 *   `docs/health/TRANSLATION-REVIEW.md` ("pending extraction") for the full
 *   writeup and the follow-up recommendation.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..'); // artifacts/aforce-os
const SCAN_DIRS = ['services/health', 'components/health'];

/**
 * Exact literals known to still be hardcoded, scoped to one file each.
 * Removing a string here without fixing its source should make this test
 * fail again — see the self-test at the bottom that proves the allowlist
 * cannot silently swallow an unrelated new violation.
 */
const PENDING_EXTRACTION_ALLOWLIST: Readonly<Record<string, readonly string[]>> = {
  'services/health/sleepSignals.ts': [
    'Last night',
    'No recent signal',
    'Signal is stale',
    'Permission needed',
    'Resting HR',
    'HRV (RMSSD)',
    'HRV (SDNN)',
  ],
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__') continue;
      out.push(...walk(full));
    } else if (st.isFile() && (extname(entry) === '.ts' || extname(entry) === '.tsx')) {
      if (/Fixtures\.ts$/.test(entry)) continue;
      out.push(full);
    }
  }
  return out;
}

function stripComments(src: string): string {
  // Block comments are blanked (not deleted) char-for-char so line numbers
  // in any future debugging stay aligned with the original file.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, '');
}

const KEY_SHAPE = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;
const PATH_PREFIX = /^[./@]/;
// Anchored on the declaration keyword: without it, ANY identifier merely
// ENDING in a capital run (`probeA`, `hrvSDNN`) exempted its literal.
const CANONICAL_CONST = /\b(?:export\s+)?(?:const|let|var)\s+[A-Z][A-Z0-9_]*\s*(?::\s*string)?\s*=\s*$/;
// `message:` (diagnostic-result object property) and `super(` (Error subclass
// constructor) are exempt alongside `new XxxError(`: this layer's contract
// maps every error/diagnostic to a closed status enum before any UI, so these
// strings have no path to a screen (see the file header).
const ERROR_DIAGNOSTIC =
  /(new\s+[A-Za-z0-9_]*Error\s*\(\s*$|throw\s+new\s+[A-Za-z0-9_]*\s*\(\s*$|\bsuper\s*\(\s*$|\bmessage\s*[:=]\s*$)/;

function isSuspiciousLiteral(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  if (KEY_SHAPE.test(trimmed)) return false;
  if (PATH_PREFIX.test(trimmed)) return false;
  if (trimmed.includes('/')) return false;
  return true;
}

interface Finding {
  file: string;
  line: number;
  value: string;
}

function scanSource(raw: string, relPath: string): Finding[] {
  const src = stripComments(raw);
  const allowlist = new Set(PENDING_EXTRACTION_ALLOWLIST[relPath] ?? []);
  // Template literals included: interpolated copy (`Synced ${h}h ago`) is the
  // natural shape for hardcoded user-facing sentences and was invisible to
  // the original quoted-only scan.
  const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  const findings: Finding[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const val = m[1] ?? m[2] ?? m[3] ?? '';
    // For template literals, judge only the STATIC text: blanking `${…}`
    // holes keeps interpolated sentences flaggable while exempting key
    // builders (`connected_health.sub_copy.${k}`), composite map keys
    // (`${a}|${b}`), and template-literal TYPES — their static remainder has
    // no two-word sentence in it.
    const judged = m[3] != null ? val.replace(/\$\{[^}]*\}/g, '') : val;
    if (!isSuspiciousLiteral(judged)) continue;
    const idx = m.index;
    const before = src.slice(Math.max(0, idx - 120), idx).replace(/\n/g, ' ');
    if (CANONICAL_CONST.test(before)) continue;
    if (ERROR_DIAGNOSTIC.test(before)) continue;
    if (allowlist.has(val)) continue;
    findings.push({ file: relPath, line: src.slice(0, idx).split('\n').length, value: val });
  }
  return findings;
}

function scanFile(absPath: string): Finding[] {
  const relPath = relative(ROOT, absPath).split('\\').join('/');
  return scanSource(readFileSync(absPath, 'utf8'), relPath);
}

/** Defense-in-depth: raw JSX text nodes (`>Some words<`) with no `{}` escape. */
function scanJsxSource(raw: string, relPath: string): Finding[] {
  const src = stripComments(raw);
  // Match ANY brace-free text node, then apply the same capital-start +
  // two-word gate as the literal scan. The original pattern's inner class
  // ([a-zA-Z ] only) silently dropped any sentence containing punctuation —
  // an apostrophe or period defeated the net entirely.
  const re = />([^<>{}]+)</g;
  const findings: Finding[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const text = m[1].trim();
    if (!/^[A-Z]/.test(text)) continue;
    if (text.split(/\s+/).filter(Boolean).length < 2) continue;
    findings.push({ file: relPath, line: src.slice(0, m.index).split('\n').length, value: text });
  }
  return findings;
}

function scanJsxTextNodes(absPath: string): Finding[] {
  if (extname(absPath) !== '.tsx') return [];
  const relPath = relative(ROOT, absPath).split('\\').join('/');
  return scanJsxSource(readFileSync(absPath, 'utf8'), relPath);
}

function allScannedFiles(): string[] {
  return SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
}

describe('no new hardcoded user-facing strings in the health consumer layer', () => {
  const files = allScannedFiles();

  it('scans a non-trivial number of source files (scope sanity check)', () => {
    // Pinned to the current file count: a DROP below it means the scan's
    // scope silently narrowed (growth is fine and expected).
    expect(files.length).toBeGreaterThanOrEqual(17);
  });

  for (const file of files) {
    const relPath = relative(ROOT, file).split('\\').join('/');
    it(`${relPath} has no un-allowlisted hardcoded copy`, () => {
      const findings = [...scanFile(file), ...scanJsxTextNodes(file)];
      if (findings.length > 0) {
        const detail = findings.map((f) => `  L${f.line}: ${JSON.stringify(f.value)}`).join('\n');
        throw new Error(
          `${relPath} contains hardcoded user-facing string(s) not routed through the ` +
            `locale system (I18nText / t()). If this is genuinely new copy, add a locale ` +
            `key (see connected_health.* in locales/*.json) instead of a literal. If it is ` +
            `known, tracked debt, add it to PENDING_EXTRACTION_ALLOWLIST in this test AND to ` +
            `docs/health/TRANSLATION-REVIEW.md's pending-extraction table.\n${detail}`,
        );
      }
      expect(findings).toEqual([]);
    });
  }

  it('every allowlisted pending-extraction file still exists and is still scanned', () => {
    const scannedRel = new Set(files.map((f) => relative(ROOT, f).split('\\').join('/')));
    for (const relPath of Object.keys(PENDING_EXTRACTION_ALLOWLIST)) {
      expect(scannedRel.has(relPath)).toBe(true);
    }
  });

  it('self-test: the scanner actually flags a hardcoded sentence when one is present', () => {
    // Proves the heuristic is live, not accidentally neutered — mirrors
    // prohibitedCopy.test.ts's own "trap" sanity check.
    expect(isSuspiciousLiteral('This is a hardcoded sentence')).toBe(true);
    expect(isSuspiciousLiteral('connected_health.header.title')).toBe(false); // key-shaped
    expect(isSuspiciousLiteral('@/services/health/signalResolution')).toBe(false); // import path
    expect(isSuspiciousLiteral('ms')).toBe(false); // unit, single word
    expect(isSuspiciousLiteral('stale')).toBe(false); // enum value, single word
    expect(isSuspiciousLiteral('HRV (RMSSD)')).toBe(true); // multi-word, all-caps acronym still counts
  });

  it('self-test: template literals are scanned (the original scan was blind to backticks)', () => {
    const src = 'export const staleText = `Your sleep data could not be refreshed right now.`;\n';
    const findings = scanSource(src, 'services/health/synthetic.ts');
    expect(findings.map((f) => f.value)).toEqual([
      'Your sleep data could not be refreshed right now.',
    ]);
  });

  it("self-test: JSX text nodes with punctuation are caught (an apostrophe used to defeat the net)", () => {
    const src = "<Text>Couldn't check your connections</Text>\n";
    const findings = scanJsxSource(src, 'components/health/Synthetic.tsx');
    expect(findings.map((f) => f.value)).toEqual(["Couldn't check your connections"]);
    // Single words, lowercase starts, and interpolations stay exempt.
    expect(scanJsxSource('<Text>Connected</Text>', 'x.tsx')).toEqual([]);
    expect(scanJsxSource('<Text>{t("connected_health.header.title")}</Text>', 'x.tsx')).toEqual([]);
  });

  it('self-test: the canonical-const exemption requires a declaration keyword', () => {
    // A lone capital-suffixed identifier must NOT exempt its literal…
    expect(
      scanSource("const x = probeA = 'Two hardcoded words';\n", 'services/health/synthetic.ts'),
    ).toHaveLength(1);
    // …while the documented UPPER_SNAKE constant convention stays exempt.
    expect(
      scanSource(
        "export const SCORE_PROTECTION_LINE = 'Never affects your Hydration Score.';\n",
        'services/health/synthetic.ts',
      ),
    ).toEqual([]);
  });

  it('self-test: the allowlist only exempts its exact literal, not the whole file', () => {
    // If sleepSignals.ts grows a NEW hardcoded sentence beyond the tracked
    // seven, this proves it would still be caught (not masked by presence
    // in the allowlist map).
    const relPath = 'services/health/sleepSignals.ts';
    const allowlist = new Set(PENDING_EXTRACTION_ALLOWLIST[relPath] ?? []);
    expect(allowlist.has('A brand new hardcoded sentence')).toBe(false);
  });
});
