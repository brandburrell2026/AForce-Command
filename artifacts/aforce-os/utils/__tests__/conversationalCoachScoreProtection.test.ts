import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Score-Protection structural invariant for the §64 Step 2 live wiring.
 *   - `voiceService.ts` must stay PURE: no store, no engine, no react-native,
 *     no dispatch, no score mutation.
 *   - The proactive coach hook + mount may READ store slices (approved,
 *     read-only), but must never import a scoring engine / status color, never
 *     dispatch, and never mutate score.
 */
const here = dirname(fileURLToPath(import.meta.url));
const aforceRoot = resolve(here, '..', '..');
const read = (rel: string): string => readFileSync(resolve(aforceRoot, rel), 'utf8');

function importPaths(src: string): string[] {
  const out: string[] = [];
  const re = /(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

const NO_SCORE_MUTATION = /setScore|SET_SCORE|awardScore|applyScore|mutateScore|addPoints/i;

describe('Section 64 Step 2 — live-wiring Score-Protection invariant', () => {
  it('voiceService stays pure — no store, engine, react-native, dispatch, or score', () => {
    const rel = 'services/voiceService.ts';
    for (const p of importPaths(read(rel))) {
      expect(p, `${rel} imports forbidden module "${p}"`).not.toMatch(
        /react-native|(^|\/)store(\/|$)|scoringEngine|statusColor|reducer/i,
      );
    }
    const src = read(rel);
    expect(src, 'voiceService must not dispatch()').not.toMatch(/\bdispatch\s*\(/);
    expect(src, 'voiceService must not mutate score').not.toMatch(NO_SCORE_MUTATION);
  });

  it('the proactive coach hook + mount never import score/color, dispatch, or mutate score', () => {
    for (const rel of [
      'hooks/useConversationalCoach.ts',
      'components/conversationalCoach/ConversationalCoachMount.tsx',
    ]) {
      for (const p of importPaths(read(rel))) {
        expect(p, `${rel} imports forbidden module "${p}"`).not.toMatch(/scoringEngine|statusColor/i);
      }
      const src = read(rel);
      expect(src, `${rel} must not dispatch()`).not.toMatch(/\bdispatch\s*\(/);
      expect(src, `${rel} must not mutate score`).not.toMatch(NO_SCORE_MUTATION);
    }
  });
});
