import { describe, it, expect } from 'vitest';
import {
  HYDROSCAN_FLOW,
  HYDROSCAN_FLOW_LABELS,
  MOMENT_ENVIRONMENTS,
  MOMENT_ENVIRONMENT_LABELS,
  MOMENT_STATES,
  MOMENT_STATE_LABELS,
  type ScanRecommendation,
  clampConfidence,
  formatMoment,
  isFlowComplete,
  nextFlowStep,
  orderRecommendations,
} from '../hydroScan';

describe('hydroScan — flow manifest', () => {
  it('lists the seven spec steps in order', () => {
    expect(HYDROSCAN_FLOW).toEqual([
      'scan',
      'context',
      'command',
      'confirm',
      'orb',
      'timeline',
      'journal',
    ]);
  });

  it('labels match the spec strings verbatim', () => {
    expect(HYDROSCAN_FLOW_LABELS.scan).toBe('Scan');
    expect(HYDROSCAN_FLOW_LABELS.context).toBe('Context');
    expect(HYDROSCAN_FLOW_LABELS.command).toBe('Command');
    expect(HYDROSCAN_FLOW_LABELS.confirm).toBe('Confirm');
    expect(HYDROSCAN_FLOW_LABELS.orb).toBe('Orb');
    expect(HYDROSCAN_FLOW_LABELS.timeline).toBe('Timeline');
    expect(HYDROSCAN_FLOW_LABELS.journal).toBe('Journal');
  });
});

describe('nextFlowStep / isFlowComplete', () => {
  it('walks the flow start to finish', () => {
    expect(nextFlowStep('scan')).toBe('context');
    expect(nextFlowStep('context')).toBe('command');
    expect(nextFlowStep('command')).toBe('confirm');
    expect(nextFlowStep('confirm')).toBe('orb');
    expect(nextFlowStep('orb')).toBe('timeline');
    expect(nextFlowStep('timeline')).toBe('journal');
  });

  it('returns null at the terminal step', () => {
    expect(nextFlowStep('journal')).toBeNull();
  });

  it('flags only journal as complete', () => {
    expect(isFlowComplete('journal')).toBe(true);
    for (const step of HYDROSCAN_FLOW.slice(0, -1)) {
      expect(isFlowComplete(step)).toBe(false);
    }
  });
});

describe('hydroScan — Current Moment vocabulary', () => {
  it('exposes the three spec environments', () => {
    expect(MOMENT_ENVIRONMENTS).toEqual(['warm', 'cool', 'indoor']);
  });

  it('exposes the three spec states', () => {
    expect(MOMENT_STATES).toEqual(['stable', 'recovery', 'building']);
  });

  it('environment labels match spec', () => {
    expect(MOMENT_ENVIRONMENT_LABELS.warm).toBe('Warm');
    expect(MOMENT_ENVIRONMENT_LABELS.cool).toBe('Cool');
    expect(MOMENT_ENVIRONMENT_LABELS.indoor).toBe('Indoor');
  });

  it('state labels match spec', () => {
    expect(MOMENT_STATE_LABELS.stable).toBe('Stable');
    expect(MOMENT_STATE_LABELS.recovery).toBe('Recovery');
    expect(MOMENT_STATE_LABELS.building).toBe('Building');
  });
});

describe('formatMoment', () => {
  it('formats the three spec examples verbatim', () => {
    expect(formatMoment({ environment: 'warm', state: 'stable' })).toBe(
      'Warm + Stable',
    );
    expect(formatMoment({ environment: 'cool', state: 'recovery' })).toBe(
      'Cool + Recovery',
    );
    expect(formatMoment({ environment: 'indoor', state: 'building' })).toBe(
      'Indoor + Building',
    );
  });
});

describe('clampConfidence', () => {
  it('passes through values in [0, 1]', () => {
    expect(clampConfidence(0)).toBe(0);
    expect(clampConfidence(0.5)).toBe(0.5);
    expect(clampConfidence(1)).toBe(1);
  });

  it('clamps negatives to 0', () => {
    expect(clampConfidence(-0.5)).toBe(0);
    expect(clampConfidence(-100)).toBe(0);
  });

  it('clamps >1 to 1', () => {
    expect(clampConfidence(1.5)).toBe(1);
    expect(clampConfidence(99)).toBe(1);
  });

  it('returns 0 for NaN and Infinity', () => {
    expect(clampConfidence(NaN)).toBe(0);
    expect(clampConfidence(Infinity)).toBe(0);
    expect(clampConfidence(-Infinity)).toBe(0);
  });
});

describe('orderRecommendations', () => {
  it('puts every water rec before every support rec', () => {
    const input: ScanRecommendation[] = [
      { kind: 'support', label: 'electrolytes', confidence: 0.9 },
      { kind: 'water', label: '12 oz water', confidence: 0.5 },
      { kind: 'support', label: 'minerals', confidence: 0.4 },
      { kind: 'water', label: 'sip', confidence: 0.3 },
    ];
    const out = orderRecommendations(input);
    expect(out.map((r) => r.kind)).toEqual(['water', 'water', 'support', 'support']);
  });

  it('sorts by descending confidence within each group', () => {
    const input: ScanRecommendation[] = [
      { kind: 'water', label: 'a', confidence: 0.3 },
      { kind: 'water', label: 'b', confidence: 0.9 },
      { kind: 'support', label: 'c', confidence: 0.4 },
      { kind: 'support', label: 'd', confidence: 0.7 },
    ];
    const out = orderRecommendations(input);
    expect(out.map((r) => r.label)).toEqual(['b', 'a', 'd', 'c']);
  });

  it('is stable for equal-confidence ties (preserves input order)', () => {
    const input: ScanRecommendation[] = [
      { kind: 'water', label: 'first', confidence: 0.5 },
      { kind: 'water', label: 'second', confidence: 0.5 },
      { kind: 'water', label: 'third', confidence: 0.5 },
    ];
    const out = orderRecommendations(input);
    expect(out.map((r) => r.label)).toEqual(['first', 'second', 'third']);
  });

  it('returns empty array for empty input', () => {
    expect(orderRecommendations([])).toEqual([]);
  });

  it('does not mutate the input', () => {
    const input: ScanRecommendation[] = [
      { kind: 'support', label: 'a', confidence: 0.5 },
      { kind: 'water', label: 'b', confidence: 0.5 },
    ];
    const snapshot = input.map((r) => ({ ...r }));
    orderRecommendations(input);
    expect(input).toEqual(snapshot);
  });
});
