/**
 * JournalScreen — SHARE SEAM WIRING.
 *
 * `JournalScreen` pulls in `useRouter` / `useUserSlice` / `expo-print` /
 * `expo-sharing` — the same category of store+router-connected container this
 * repo's existing tests deliberately never mount directly (see
 * `components/home/__tests__/homeScreenV2Wiring.test.ts`'s header, which
 * documents the convention). This file applies that same established pattern:
 * a source-text guard, with MUTATION-VERIFY assertions proving the guard
 * actually detects the regression it exists for.
 *
 * WHY THIS FILE EXISTS. `journalShareWindow` is a fully covered pure module,
 * but nothing pinned that `onShareJournal` actually calls it instead of the
 * old direct pair —
 *
 *     publishJournalShare(rollups, range);
 *     const ctx = deriveJournalShareContext(rollups, range);
 *
 * — which is exactly the shape that let the recap card and the share payload
 * disagree from one tap.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, '..', 'JournalScreen.tsx'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

describe('JournalScreen — onShareJournal routes through the seam, not the old direct calls', () => {
  it('imports the seam and the observation helpers', () => {
    expect(CODE).toContain("import { prepareJournalShare } from '@/services/journalShareWindow';");
    expect(CODE).toContain("import { fetchJournalRollups, fetchJournalTimeline } from '@/services/realApi';");
    // Every score-derived number on this screen goes through the seam.
    expect(CODE).toContain(
      "import { hasHydroStateObservation, isEmptyWindow, observedRows } from '@/utils/scoring/boundarySeries';",
    );
  });

  it('does not re-derive the share context outside the seam', () => {
    // A stray `deriveJournalShareContext` import would let a future edit
    // silently revert to computing the payload from a different array than
    // the card renders.
    expect(CODE).not.toMatch(/import\s*\{[^}]*deriveJournalShareContext/);
  });

  it('the load effect stores the DENSE window the route returns', () => {
    expect(CODE).toMatch(
      /const\s*\[tl,\s*rl\]\s*=\s*await\s*Promise\.all\(\[\s*fetchJournalTimeline\(r\),\s*fetchJournalRollups\(r\),\s*\]\);/,
    );
    expect(CODE).toMatch(/setRollups\(rl\);/);
  });

  it('every score-derived number on the screen reads OBSERVED days, not the row count', () => {
    // The dense wire makes `rollups.length` the window width. These four were
    // the screen's own readers of it, and each would otherwise fold the
    // server's sentinel zeros into a member-facing number.
    expect(CODE).toMatch(/const observed = useMemo\(\(\) => observedRows\(rollups\), \[rollups\]\);/);
    // Compliance: both sides of the ratio, and it WITHHOLDS rather than
    // fabricating 0% — the same honesty its sibling hook was migrated to.
    // This assertion previously pinned `return 0;`, locking in a defect the
    // adversarial gate had to catch: two tiles on one card, same array,
    // opposite honesty.
    expect(CODE).toMatch(/if \(observed\.length === 0\) return null;/);
    expect(CODE).toMatch(/observed\.filter\(\(r\) => r\.avgScore >= 65\)\.length/);
    expect(CODE).toMatch(/compliantDays \/ observed\.length/);
    expect(CODE).toMatch(/value: weeklyCompliancePct == null \? EM_DASH/);
    // The headline average, and the trend beside it.
    expect(CODE).toMatch(/observed\.reduce\(\(a, r\) => a \+ r\.avgScore, 0\) \/\s*observed\.length/);
    expect(CODE).toMatch(/kpiTrend\(observed, 'avgScore'\)/);
    // The exported PDF's per-row score cells.
    expect(CODE).toMatch(/const measured = hasHydroStateObservation\(r\);/);
  });

  it('the RENDER GATES ask what happened, not how wide the window is', () => {
    // THE DEFECT THE GATE CAUGHT. `rollups.length === 0` was the empty-state
    // test. On the dense wire that is the WIDTH OF THE WINDOW and is
    // essentially never zero, so the welcome line became unreachable and a
    // member with no history was shown a full dashboard built from the
    // server's sentinel zeros.
    expect(CODE).toMatch(/error \|\| \(!loading && isEmptyWindow\(rollups\)\)/);
    // ...and no gate anywhere on this screen reads the row count as content.
    expect(CODE).not.toMatch(/rollups\.length === 0/);
    expect(CODE).not.toMatch(/rollups\.length > 0/);
  });

  it('mutation-verify: a row-count render gate is detectable', () => {
    // Re-runs the SAME assertions against a hand-written regressed source, so
    // the guard above cannot drift from what it claims to check.
    const regressed = `
      {error || (!loading && rollups.length === 0) ? (
        <View style={styles.emptyCard} />
      ) : (
        <>{!loading && rollups.length > 0 && (<StreakHero />)}</>
      )}
    `;
    expect(() => {
      expect(regressed).toMatch(/error \|\| \(!loading && isEmptyWindow\(rollups\)\)/);
      expect(regressed).not.toMatch(/rollups\.length === 0/);
    }).toThrow();
  });

  /**
   * THE WIRING PROOF, extracted so it can be run against MORE than one
   * string. Both downstream calls must consume the SEAM's output —
   * `window`/`context` — never the raw `rollups`, and never a
   * `deriveJournalShareContext` call re-derived outside the seam. A
   * call-and-discard mutant (import `prepareJournalShare`, never use its
   * result) would still show `publishJournalShare(rollups, range)`.
   *
   * Throws (via a failing `expect`) rather than returning a boolean, so
   * `assertRoutesThroughSeam(mutated)` inside `expect(() => ...).toThrow()`
   * is a direct re-run of the SAME checks the real law uses — not a second,
   * hand-rolled comparison that could silently drift.
   */
  function assertRoutesThroughSeam(handler: string): void {
    expect(handler).toMatch(
      /const\s*\{\s*window,\s*context\s*\}\s*=\s*prepareJournalShare\(\s*rollups,\s*\{\s*rangeDays:\s*range\s*\}\)/,
    );
    expect(handler).toMatch(/publishJournalShare\(window,\s*range\)/);
    expect(handler).not.toMatch(/publishJournalShare\(rollups,/);
    expect(handler).toMatch(/toShareRouteParams\(context\)/);
    expect(handler).not.toMatch(/deriveJournalShareContext\(/);
  }

  function extractHandler(code: string): string {
    const start = code.indexOf('const onShareJournal = useCallback(');
    const end = code.indexOf('}, [rollups, range, router]);', start);
    return code.slice(start, end);
  }

  it('onShareJournal calls prepareJournalShare — not a source-scannable no-op import', () => {
    const handler = extractHandler(CODE);
    expect(handler, 'the handler must be locatable').not.toBe('');
    assertRoutesThroughSeam(handler);
  });

  it('mutation-verify: reverting to the old direct pair is detectable', () => {
    // A HAND-WRITTEN pre-seam handler — not derived from the correct one via
    // `.replace()`, whose replacements silently become no-ops the moment the
    // real handler changes shape (that is exactly how an earlier version of
    // this test went vacuous). Run through the SAME assertion function the
    // real law uses, so drift between the two is structurally impossible.
    const reverted = `
      const onShareJournal = useCallback(() => {
        publishJournalShare(rollups, range);
        const ctx = deriveJournalShareContext(rollups, range);
        router.push({ pathname: '/share', params: toShareRouteParams(ctx) });
      }, [rollups, range, router]);
    `;
    expect(() => assertRoutesThroughSeam(reverted)).toThrow();
  });

  it('the share button is wired to the handler that does all of the above', () => {
    expect(CODE).toMatch(/onPress=\{onShareJournal\}/);
    expect(CODE).toContain('testID="journal-share-social"');
  });
});
