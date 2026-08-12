/**
 * Wave-3 PR10 — honest degraded modes (the invisible-correctness set).
 *
 * MOCK-ON-FAILURE / FAKE-SUCCESS-ON-FAILURE / FRESH-TIMESTAMP-ON-STALE
 * eliminations, locked:
 *   1. fetchHome failure is DISCRIMINATED (stale:true, serverTime:null)
 *      — the old envelope was indistinguishable from server truth and
 *      minted a fresh server clock for a server never reached.
 *   2. The five fabricated history entries are gone from the store seed
 *      — which un-deadens buildSyntheticBaselineEntry, the designed
 *      self-labeling honest state.
 *   3. confirmCommand no longer applies a local ±3 the server never
 *      heard about (reward-then-silent-revert).
 *   4. battle supportSide rolls back its optimistic bump on double
 *      failure (no phantom support).
 *   5. Cruise fallback weather carries fetchedAt:null (never a fresh
 *      stamp on fabricated values); partial upstream payloads may not
 *      wear the 'openweather' source tag.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const read = (rel: string) =>
  readFileSync(resolve(ROOT, rel), 'utf8');

describe('fetchHome failure is honest', () => {
  const src = read('services/realApi.ts');
  it('the catch path returns stale:true and a null serverTime — never a fabricated clock', () => {
    const catchBlock = src.slice(src.indexOf('fetchHome failed, falling back'));
    expect(catchBlock.slice(0, 500)).toContain('serverTime: null');
    expect(catchBlock.slice(0, 500)).toContain('stale: true');
    expect(catchBlock.slice(0, 500)).not.toContain('new Date().toISOString()');
  });
  it('HomePayload carries the discriminator', () => {
    expect(src).toMatch(/stale\?: boolean;/);
    expect(src).toMatch(/serverTime: string \| null;/);
  });
});

describe('the fabricated history seed is gone', () => {
  it('the store starts with an EMPTY history (synthetic baseline activates)', () => {
    const src = read('store/useAppStore.tsx');
    expect(src).not.toMatch(/history: mockHistory/);
    expect(src).toMatch(/history: \[\],/);
    expect(src).not.toMatch(/import \{[^}]*mockHistory[^}]*\} from/);
  });
  it('the designed honest baseline entry self-labels as synthetic', () => {
    const src = read('store/app/helpers.ts');
    expect(src).toContain('buildSyntheticBaselineEntry');
    expect(src).toMatch(/isSynthetic/);
  });
});

describe('no fake success on user actions', () => {
  it('confirmCommand fails visibly — no local ±3 fallback remains', () => {
    const src = read('store/app/actions.ts');
    const catchBlock = src.slice(
      src.indexOf("confirmCommand failed"),
      src.indexOf("confirmCommand failed") + 900,
    );
    expect(catchBlock).not.toContain("CONFIRM_COMMAND");
    expect(catchBlock).toContain('Alert.alert');
  });
  it('battle support rolls back the optimistic bump on double failure', () => {
    const src = read('services/battleService.ts');
    expect(src).toContain('const prior = battles.find');
    const catchBlock = src.slice(src.indexOf('double'));
    expect(catchBlock).toContain('b.id === id ? prior : b');
  });
});

describe('cruise weather timestamps are honest', () => {
  const serverSrc = readFileSync(
    resolve(ROOT, '../api-server/src/routes/cruise.ts'),
    'utf8',
  );
  it('the fallback env has NO fetch time; partial payloads lose the openweather tag', () => {
    const fallbackIdx = serverSrc.indexOf('fallbackFor');
    const fallbackBlock = serverSrc.slice(fallbackIdx, fallbackIdx + 900);
    expect(fallbackBlock).toContain('fetchedAt: null');
    expect(serverSrc).toMatch(/data\.main\?\.temp == null[\s\S]{0,80}"fallback"/);
  });
  it('the client renders an em dash for a missing fetch time', () => {
    const src = read('screens/CruiseModeScreen.tsx');
    expect(src).toMatch(/env\.fetchedAt \? formatClock\(env\.fetchedAt\) : '\\u2014'/);
  });
});
