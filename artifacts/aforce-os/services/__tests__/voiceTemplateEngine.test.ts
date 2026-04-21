/**
 * Unit tests for the AForce Voice Engine — template renderer + tone enforcer.
 *
 * Pure functions only, no React/Expo imports — safe to run under vitest at
 * the workspace root.
 */

import { describe, it, expect } from 'vitest';

import { renderTemplate } from '../voiceTemplateEngine';
import { resolvePersona, getProfile } from '../voicePersonaService';
import { TONE_RULES } from '../../data/voiceTemplates';
import { levelToMode } from '../../types/voicePersona';
import type { VoiceContext } from '../../types/voicePersona';

const baseCtx: VoiceContext = {
  mode: 'balanced',
  score: 82,
  recheck_minutes: 20,
  command_action: 'Drink 16 oz now.',
};

describe('voiceTemplateEngine — token replacement', () => {
  it('fills score, state and recheck tokens', () => {
    const r = renderTemplate('score_update', baseCtx);
    expect(r.spoken).toContain('82');
    expect(r.detail).toContain('20');
  });

  it('fills fluid token for intake_confirmation', () => {
    const r = renderTemplate('intake_confirmation', { ...baseCtx, fluid: 'water' });
    expect(r.spoken.toLowerCase()).toContain('water');
    expect(r.spoken).toContain('82');
  });

  it('uses the mode-specific template (different copy per mode)', () => {
    const peak = renderTemplate('score_update', { ...baseCtx, mode: 'peak' });
    const dep  = renderTemplate('score_update', { ...baseCtx, mode: 'depleted' });
    expect(peak.spoken).not.toEqual(dep.spoken);
    expect(peak.spoken).toMatch(/Peak/);
    expect(dep.spoken).toMatch(/Depleted/);
  });
});

describe('voiceTemplateEngine — tone enforcement', () => {
  it('clips spoken line to the per-mode word ceiling', () => {
    // GET_COMMAND template uses {action} which we feed with a deliberately
    // long phrase. The engine must clip to balanced.max_words (16).
    const longAction =
      'You may want to consider trying to drink twenty four ounces of water before resuming your activity now please';
    const r = renderTemplate('next_action', {
      ...baseCtx,
      mode: 'balanced',
      command_action: longAction,
    });
    const wordCount = r.spoken.trim().split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(TONE_RULES.balanced.max_words);
  });

  it('strips banned multi-word phrases before clipping', () => {
    const r = renderTemplate('next_action', {
      ...baseCtx,
      mode: 'balanced',
      command_action: 'You may want to drink water.',
    });
    expect(r.spoken.toLowerCase()).not.toContain('you may want to');
    expect(r.spoken.toLowerCase()).toContain('drink water');
  });

  it('strips single-word bans only on word boundaries', () => {
    // "try" is banned, but "strategy" must NOT be corrupted.
    const r = renderTemplate('next_action', {
      ...baseCtx,
      mode: 'balanced',
      command_action: 'Maintain strategy. Try one stick.',
    });
    expect(r.spoken.toLowerCase()).toContain('strategy');
    expect(r.spoken.toLowerCase()).not.toMatch(/\btry\b/);
  });

  it('always ends in a sentence terminator', () => {
    const r = renderTemplate('score_update', baseCtx);
    expect(r.spoken).toMatch(/[.!?]$/);
  });
});

describe('voicePersonaService — mode + profile resolution', () => {
  it('lower-cases PerformanceLevel into mode keys', () => {
    expect(levelToMode('PEAK')).toBe('peak');
    expect(levelToMode('BALANCED')).toBe('balanced');
    expect(levelToMode('RECOVERING')).toBe('recovering');
    expect(levelToMode('DEPLETED')).toBe('depleted');
  });

  it('returns matching tone rule + profile per mode', () => {
    const r = resolvePersona('RECOVERING');
    expect(r.mode).toBe('recovering');
    expect(r.rule.tone).toBe('firm_calm');
    expect(r.profile.mode).toBe('recovering');
  });

  it('keeps volume at 1.0 for every mode (urgency is phrasing, not loudness)', () => {
    (['peak', 'balanced', 'recovering', 'depleted'] as const).forEach((m) => {
      expect(getProfile(m).volume).toBe(1.0);
    });
  });

  it('keeps rate within the calm-coach range (0.9–1.0) for every mode', () => {
    (['peak', 'balanced', 'recovering', 'depleted'] as const).forEach((m) => {
      const rate = getProfile(m).speech_rate;
      expect(rate).toBeGreaterThanOrEqual(0.9);
      expect(rate).toBeLessThanOrEqual(1.0);
    });
  });
});
