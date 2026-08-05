/**
 * RULING H (RC-2) — no HealthKit write (toShare) scopes without a
 * corresponding write capability.
 *
 * `requestAppleHealthPermissions` (services/appleHealth.ts) previously
 * requested `toShare: ['HKQuantityTypeIdentifierDietaryWater']` — a WRITE
 * scope — even though no code anywhere in this repo ever calls HealthKit's
 * write API (`saveQuantitySample` / `saveCategorySample`, from
 * @kingstinct/react-native-healthkit). Requesting a permission you never use
 * is its own problem (needless iOS permission-sheet surface area, an honesty
 * mismatch between what the app asks for and what it does), so Ruling H
 * removed it: `toShare` is now `[]`.
 *
 * This is a LOCK, not a feature test, with two independent guards:
 *   1. A source-guard on `services/appleHealth.ts` — `toShare` in the real
 *      `requestAuthorization` call must be the empty-array literal, and the
 *      surrounding comment must name this ruling.
 *   2. A repo-wide guard — no source file calls HealthKit's actual write
 *      functions. If a FUTURE feature legitimately needs to write to
 *      HealthKit, it must add a real write call (which this test will then
 *      catch, requiring a conscious update here) AND populate `toShare`
 *      with the specific type(s) that capability needs — never a scope
 *      requested "just in case."
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APPLE_HEALTH_SOURCE_PATH = join(__dirname, '..', 'appleHealth.ts');
const APP_ROOT = join(__dirname, '..', '..');

const SOURCE = readFileSync(APPLE_HEALTH_SOURCE_PATH, 'utf8');

describe('RC-2 Ruling H — appleHealth.ts requests no write scope', () => {
  it('the requestAuthorization call\'s toShare is the empty-array literal', () => {
    const match = SOURCE.match(/toShare:\s*(\[[^\]]*\])/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('[]');
  });

  it('the empty toShare is annotated with a comment naming RULING H — so a future write feature must touch this comment (and this test) consciously, not silently add a scope', () => {
    const shareIndex = SOURCE.indexOf('toShare: []');
    expect(shareIndex).toBeGreaterThan(-1);
    const preceding = SOURCE.slice(Math.max(0, shareIndex - 600), shareIndex);
    expect(preceding).toMatch(/RULING H/);
  });

  it('DietaryWater (or any other write-only identifier) no longer appears as a requested scope', () => {
    expect(SOURCE).not.toMatch(/toShare:\s*\[[^\]]*HKQuantityTypeIdentifier/);
  });
});

/**
 * Repo-wide sweep: every .ts/.tsx file under artifacts/aforce-os (excluding
 * node_modules and this file's own pattern list) must contain zero calls to
 * HealthKit's real write API. Test fixtures/specs that reference the
 * *string* "DietaryWater" as a generic example value (e.g.
 * appleHealthRecords.test.ts's `resolvePartialAppleHealthAuthorization`
 * partition tests, which use it as an arbitrary share-type label, not a
 * real permission request) are unaffected — this scan targets the actual
 * write FUNCTION CALLS, not the identifier string.
 */
const HEALTHKIT_WRITE_CALLS = [/\bsaveQuantitySample\s*\(/, /\bsaveCategorySample\s*\(/];

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('RC-2 Ruling H — no HealthKit write call exists anywhere in the app (verifies the toShare removal matches reality)', () => {
  const files = collectSourceFiles(APP_ROOT);

  it('scans a non-trivial number of source files (sanity — proves the sweep actually ran)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  for (const pattern of HEALTHKIT_WRITE_CALLS) {
    it(`no file calls ${pattern.source}`, () => {
      const offenders = files.filter((f) => pattern.test(readFileSync(f, 'utf8')));
      expect(offenders).toEqual([]);
    });
  }
});
