import { describe, expect, it } from 'vitest';
import { buildSkinIADerivedBaseline } from '../skiniaDerivedBaseline';

const observation = { kind: 'OBSERVATION' as const, observation: 'VISIBLE_TEXTURE' as const, confidence: 'MODERATE' as const, capturedAt: '2026-09-16T00:00:00Z', comparison: 'PERSONAL_BASELINE' as const };

describe('SkinIA derived baseline history', () => {
  it('uses derived observations only and never substitutes a missing personal baseline', () => {
    expect(buildSkinIADerivedBaseline([], 'VISIBLE_TEXTURE')).toBeNull();
    expect(buildSkinIADerivedBaseline([observation, { ...observation, observation: 'VISIBLE_REDNESS' }], 'VISIBLE_TEXTURE')).toEqual({ observation: 'VISIBLE_TEXTURE', recentCount: 1, comparison: 'PERSONAL_BASELINE' });
  });
});
