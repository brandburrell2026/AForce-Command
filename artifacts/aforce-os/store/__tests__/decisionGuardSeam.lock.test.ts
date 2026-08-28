/**
 * DECISION GUARD SEAM LOCK — pins the wiring, not just the module.
 *
 * The directive makes "Decision Guard bypass" a zero-tolerance release
 * category (:1158) and the adaptEngineOutput precedent proved that
 * "single seam" claims drift (it was documented as the one seam before
 * timer-resetting dispatches, yet 5 of 8 engine-output ingress points
 * bypass it today). This lock therefore pins every delivery path out of
 * AppProvider to the guard, at the source level:
 *
 *  1. AppProvider guards once per engine-output change
 *     (guardEngineOutput memo) and builds `deliveredState`.
 *  2. The facade delivers guarded output (pickFacadeState(deliveredState),
 *     dep keyed on guardedDelivery.engineOutput).
 *  3. The slices deliver guarded output (<SliceProvider state={deliveredState}).
 *  4. The voice effect speaks guarded copy only.
 *  5. The journal snapshot persists guarded copy only.
 *  6. The verdict is recorded to the command ledger
 *     (decisionGuardResultToCommandEvent → appendCommandEvents), and the
 *     event survives the ledger's own normalizer round-trip.
 *
 * A future delivery path added to AppProvider that reads raw
 * `state.engineOutput.command` trips check 7 and must either consume the
 * guarded value or be consciously allowlisted here.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { decisionGuardResultToCommandEvent } from '../../utils/intelligence/commandEventAdapters';
import { normalizeCommandEvent } from '../../utils/intelligence/commandEvents';

const SRC = readFileSync(join(__dirname, '..', 'useAppStore.tsx'), 'utf8');

describe('AppProvider delivers only guarded engine output', () => {
  it('guards once per engine-output change', () => {
    expect(SRC).toMatch(
      /const guardedDelivery = useMemo\(\(\) => guardEngineOutput\(state\.engineOutput\), \[state\.engineOutput\]\);/,
    );
    // Exactly one guard call site — a second one would fork the verdict.
    expect(SRC.match(/guardEngineOutput\(/g)?.length).toBe(1);
  });

  it('facade and slices consume deliveredState, never raw state', () => {
    expect(SRC).toMatch(/pickFacadeState\(deliveredState\)/);
    expect(SRC).not.toMatch(/pickFacadeState\(state\)/);
    expect(SRC).toMatch(/<SliceProvider\s*\n\s*state=\{deliveredState\}/);
    expect(SRC).not.toMatch(/<SliceProvider\s*\n\s*state=\{state\}/);
  });

  it('voice effect and journal snapshot read guarded copy', () => {
    expect(SRC).toMatch(/const cmd = guardedDelivery\.engineOutput\.command;/);
    expect(SRC).toMatch(
      /const reason = guardedDelivery\.engineOutput\.command\?\.action\?\.slice\(0, 240\) \?\? '';/,
    );
  });

  it('records the Decision Guard result to the command ledger', () => {
    expect(SRC).toMatch(/decisionGuardResultToCommandEvent\(\{/);
    expect(SRC).toMatch(/void appendCommandEvents\(\[ev\]\);/);
  });

  it('no delivery-side raw command reads remain (allowlist-anchored sweep)', () => {
    // Raw `state.engineOutput.command` may appear ONLY at the sanctioned
    // sites: the guard memo input is `state.engineOutput` (not .command),
    // and the ledger-key read in the record effect. Everything else must
    // go through guardedDelivery/deliveredState.
    const rawCommandReads = SRC.match(/state\.engineOutput\.command/g) ?? [];
    // 2 sanctioned: the ledger effect's `cmdId` read + its dep entry.
    expect(
      rawCommandReads.length,
      'new raw state.engineOutput.command read in AppProvider — route it through the Decision Guard',
    ).toBeLessThanOrEqual(2);
  });
});

describe('ledger row — schema-safe and normalizer-stable', () => {
  it('approved and blocked rows survive normalizeCommandEvent round-trip', () => {
    for (const result of [
      { verdict: 'approved' } as const,
      { verdict: 'blocked', reason: 'unsafe_dose' } as const,
    ]) {
      const ev = decisionGuardResultToCommandEvent({
        result,
        commandId: 'cmd-test',
        atMs: 1_700_000_000_000,
      });
      expect(ev).not.toBeNull();
      const normalized = normalizeCommandEvent(ev as unknown);
      expect(normalized).toEqual(ev);
      expect(normalized?.kind).toBe('execution_event');
      expect((normalized as { subtype?: string }).subtype).toBe('decision_guard_result');
    }
  });

  it('id encodes the evaluation instant (first-wins merge cannot freeze verdicts)', () => {
    const a = decisionGuardResultToCommandEvent({
      result: { verdict: 'approved' },
      commandId: 'cmd-test',
      atMs: 1_700_000_000_000,
    });
    const b = decisionGuardResultToCommandEvent({
      result: { verdict: 'approved' },
      commandId: 'cmd-test',
      atMs: 1_700_000_000_001,
    });
    expect(a?.id).not.toBe(b?.id);
  });
});
