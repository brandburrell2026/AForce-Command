/**
 * "How am I doing?" repeats HydroState as Home resolves it and computes nothing.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('@/store/slices', () => ({ useEngineSlice: vi.fn(), useUserSlice: vi.fn(), useHistorySlice: vi.fn(), useBootstrapSlice: vi.fn() }));
vi.mock('react-native', () => ({ StyleSheet: { create: (s: unknown) => s }, Text: 'Text', View: 'View', Pressable: 'Pressable', TextInput: 'TextInput' }));
// The kit now also exports the talk-or-type bar, which draws an icon.
vi.mock('@/components/Icon', () => ({ Icon: 'Icon' }));

import { bandWord, statusAnswer } from '../oneBreath/OneBreathStatusAnswer';
import { ONE_BREATH_LINES } from '@/utils/oneBreath/session';

describe('One Breath status answer', () => {
  it('repeats the score and the app\'s own band name, as an estimate, with its source', () => {
    const a = statusAnswer({ ready: true, score: 51.4, level: 'DEPLETED', social: false });
    expect(a.text).toBe('HydroState 51, Depleted. That’s an estimate. From what you’ve logged.');
    expect(a.card).toEqual({ value: 51, word: 'Depleted' });
  });

  it('uses only the four band names the app already has', () => {
    expect(['PEAK', 'BALANCED', 'RECOVERING', 'DEPLETED'].map(bandWord)).toEqual(['Peak', 'Balanced', 'Recovering', 'Depleted']);
  });

  it('states no number while Home would still say "Collecting"', () => {
    const a = statusAnswer({ ready: false, score: 77, level: 'BALANCED', social: false });
    expect(a.text).toBe(ONE_BREATH_LINES.statusCollecting);
    expect(a.card).toBeNull();
    expect(a.text).not.toMatch(/\d/);
    expect(statusAnswer({ ready: true, score: NaN, level: 'BALANCED', social: false }).card).toBeNull();
  });

  it('reads HydroState where Home reads it and touches no scoring or status-colour file', () => {
    const code = readFileSync(join(__dirname, '..', 'oneBreath', 'OneBreathStatusAnswer.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).toContain('useEngineSlice');
    expect(code).toContain('resolveHomeEvidence');
    expect(code).not.toMatch(/scoringEngine|statusColor|hydroStateModel|logIntake|AsyncStorage|fetch\(/);
  });
});
