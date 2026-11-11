import { describe, expect, it } from 'vitest';
import { createSkinIACaptureAttemptGate } from '../skiniaCaptureAttemptGate';

describe('SkinIA ephemeral capture attempt gate', () => {
  it('rejects an in-flight result after backgrounding, even after foregrounding', () => {
    const gate = createSkinIACaptureAttemptGate();
    const first = gate.begin();
    expect(first).not.toBeNull();
    expect(gate.isCurrent(first!)).toBe(true);
    gate.interrupted();
    expect(gate.isCurrent(first!)).toBe(false);
    expect(gate.begin()).toBeNull();
    gate.foregrounded();
    expect(gate.isCurrent(first!)).toBe(false);
    const second = gate.begin();
    expect(second).not.toBeNull();
    expect(gate.isCurrent(second!)).toBe(true);
  });

  it('never resumes a closed screen or accepts a stale attempt', () => {
    const gate = createSkinIACaptureAttemptGate();
    const first = gate.begin()!;
    const second = gate.begin()!;
    expect(gate.isCurrent(first)).toBe(false);
    gate.close();
    gate.foregrounded();
    expect(gate.isCurrent(second)).toBe(false);
    expect(gate.begin()).toBeNull();
  });

  it('rejects invalid attempt tokens', () => {
    const gate = createSkinIACaptureAttemptGate();
    expect(gate.isCurrent(0)).toBe(false);
    gate.begin();
    expect(gate.isCurrent(Number.NaN)).toBe(false);
    expect(gate.isCurrent(Number.POSITIVE_INFINITY)).toBe(false);
    expect(gate.isCurrent(0)).toBe(false);
  });
});
