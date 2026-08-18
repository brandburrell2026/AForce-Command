/**
 * The snapshot write actually SENDS the vector.
 *
 * The column, the wire contract and the breakdown vector can all exist while
 * the one call site that writes snapshots omits the field — which is exactly
 * the failure mode `entry_source` had: schema, wire and server all present,
 * zero rows populated, and the Build-65 duplicate unattributable as a result.
 * This lock exists so `factor_deltas` cannot repeat that.
 *
 * Source-scanned per the repo convention for connected-store wiring
 * (homeScreenV2Wiring.test.ts): the assertion is about what the write site
 * declares, and the vector's behaviour is already covered by
 * utils/__tests__/factorDeltasVector.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('snapshot factorDeltas wiring', () => {
  const store = stripComments(readFileSync(resolve(PKG, 'store', 'useAppStore.tsx'), 'utf8'));
  const api = stripComments(readFileSync(resolve(PKG, 'services', 'realApi.ts'), 'utf8'));

  it('the snapshot payload includes the vector from the canonical breakdown', () => {
    const call = /postJournalSnapshot\(\{[\s\S]*?\}\)/.exec(store)?.[0] ?? '';
    expect(call, 'postJournalSnapshot call site not found').not.toBe('');
    expect(
      /factorDeltas:\s*buildBreakdown\(state\.userState,\s*now\)\.factorDeltas/.test(call),
      'the snapshot write must send factorDeltas from buildBreakdown — a column nobody ' +
        'populates is the entry_source failure mode over again',
    ).toBe(true);
  });

  it('no second breakdown implementation is invoked at the write site', () => {
    // One canonical computation. A hand-rolled vector here could drift from
    // the engine and "explain" a score the engine never produced.
    const call = /postJournalSnapshot\(\{[\s\S]*?\}\)/.exec(store)?.[0] ?? '';
    expect(call).not.toMatch(/calculateScore|calculateBaseScore|hydrationScore/);
  });

  it('the wire type carries the field as optional', () => {
    const iface = /export interface JournalSnapshotPayload \{[\s\S]*?\n\}/.exec(api)?.[0] ?? '';
    expect(iface).toMatch(/factorDeltas\?:\s*Record<string,\s*number>/);
  });

  it('labels and weights never enter the payload', () => {
    const call = /postJournalSnapshot\(\{[\s\S]*?\}\)/.exec(store)?.[0] ?? '';
    expect(call).not.toMatch(/label|maxMagnitude|hint|contributions/);
  });
});
