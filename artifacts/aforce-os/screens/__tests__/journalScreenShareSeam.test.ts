/**
 * JournalScreen — SHARE SEAM WIRING (founder ruling, Option B / PR A repair).
 *
 * `JournalScreen` pulls in `useRouter` / `useUserSlice` / `expo-print` /
 * `expo-sharing` — the same category of store+router-connected container this
 * repo's existing tests deliberately never mount directly (see
 * `components/home/__tests__/homeScreenV2Wiring.test.ts`'s header, which
 * documents the convention and points at
 * `components/cruise/__tests__/cruiseModeView.render.test.tsx` mounting the
 * presentational view, never the connected screen). This file applies that
 * same established pattern: a source-text guard, with MUTATION-VERIFY
 * assertions proving the guard actually detects the regression it exists for
 * — not a fabricated store+router+i18n harness this suite has no precedent for.
 *
 * WHY THIS FILE EXISTS. The server-side densification shipped with NO law
 * proving the route actually invoked the helper it built: a call-and-discard
 * mutation left all 1182 api-server tests green. That risk moved to the client
 * when densification relocated to the Journal share seam: `journalShareWindow`
 * and `journalDenseRange` are fully covered PURE modules, but nothing pinned
 * that `onShareJournal` actually calls `prepareJournalShare` instead of the old
 * direct pair —
 *
 *     publishJournalShare(rollups, range);
 *     const ctx = deriveJournalShareContext(rollups, range);
 *
 * — which is exactly the shape that let the recap card and the share payload
 * disagree from one tap (the array `rollups` is SPARSE; the seam's whole job is
 * to hand both outputs the same DENSE `window` instead).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, '..', 'JournalScreen.tsx'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

describe('JournalScreen — onShareJournal routes through the seam, not the old direct calls', () => {
  it('imports the seam and the two pure modules it depends on', () => {
    expect(CODE).toContain("import { prepareJournalShare } from '@/services/journalShareWindow';");
    expect(CODE).toContain("import { fetchJournalRollupsWithHistory, fetchJournalTimeline } from '@/services/realApi';");
    expect(CODE).toContain("import { parseHistoryStartAt } from '@/config/hydroStateHistoryEpoch';");
  });

  it('no longer imports the OLD direct wire fetch or the raw share-context deriver', () => {
    // The old fetch returned only the sparse array with no history stamp — the
    // seam needs both, so it must be gone, not merely unused alongside the new
    // one (a stray import would let a future edit silently revert to it).
    expect(CODE).not.toContain("import { fetchJournalRollups,");
    expect(CODE).not.toMatch(/import\s*\{\s*fetchJournalRollups\s*,/);
    expect(CODE).not.toContain(
      "import {\n  deriveJournalShareContext,\n  toShareRouteParams,\n} from '@/services/journalShareContext';",
    );
  });

  it('the load effect stores the SPARSE rollups AND the history stamp separately', () => {
    // Every other consumer on this screen (compliance %, section summary, win
    // moments, the chart, the day-card list) keeps reading the unchanged sparse
    // array — only the share seam below is allowed to densify it.
    expect(CODE).toMatch(/const\s*\[tl,\s*rl\]\s*=\s*await\s*Promise\.all\(\[\s*fetchJournalTimeline\(r\),\s*fetchJournalRollupsWithHistory\(r\),\s*\]\);/);
    expect(CODE).toMatch(/setRollups\(rl\.rollups\);/);
    expect(CODE).toMatch(/setHistoryStartAt\(rl\.historyStartAt\);/);
  });

  /**
   * THE WIRING PROOF, extracted so it can be run against MORE than one
   * string. Both downstream calls must consume the SEAM's output —
   * `window`/`context` — never the raw sparse `rollups`, and never a
   * `deriveJournalShareContext` call re-derived outside the seam. A
   * call-and-discard mutant (import `prepareJournalShare`, never use its
   * result) would still show `publishJournalShare(rollups, range)`.
   *
   * Throws (via `expect(...).toMatch`/`.not.toMatch` failing) rather than
   * returning a boolean, so `assertRoutesThroughSeam(mutated)` inside
   * `expect(() => ...).toThrow()` is a direct re-run of the SAME checks the
   * real law above uses — not a second, hand-rolled comparison that could
   * silently drift from what the real law actually checks.
   */
  function assertRoutesThroughSeam(handler: string): void {
    expect(handler).toMatch(
      /const\s*\{\s*window,\s*context\s*\}\s*=\s*prepareJournalShare\(\s*rollups,\s*\{/,
    );
    expect(handler).toMatch(/rangeDays:\s*range,/);
    expect(handler).toMatch(/historyStartAt:\s*parseHistoryStartAt\(historyStartAt\),/);
    expect(handler).toMatch(/now:\s*new Date\(\),/);
    expect(handler).toMatch(/publishJournalShare\(window,\s*range\)/);
    expect(handler).not.toMatch(/publishJournalShare\(rollups,/);
    expect(handler).toMatch(/toShareRouteParams\(context\)/);
    expect(handler).not.toMatch(/deriveJournalShareContext\(/);
  }

  function extractHandler(code: string): string {
    const start = code.indexOf('const onShareJournal = useCallback(');
    const end = code.indexOf('}, [rollups, range, historyStartAt, router]);', start);
    return code.slice(start, end);
  }

  it('onShareJournal calls prepareJournalShare — not a source-scannable no-op import', () => {
    const handler = extractHandler(CODE);
    expect(handler, 'the handler must be locatable').not.toBe('');
    assertRoutesThroughSeam(handler);
  });

  it('mutation-verify: reverting to the old direct pair is detectable', () => {
    // A HAND-WRITTEN pre-seam handler — not derived from the correct one via
    // `.replace()`, which is exactly what made the previous version of this
    // test vacuous: its replacements silently became no-ops the moment the
    // real handler text changed shape, so it kept "detecting" a regression
    // that had already broken its own detector. This is the literal old
    // shape (verified against git history) run through the SAME assertion
    // function the real law above uses, so drift between the two is
    // structurally impossible.
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
