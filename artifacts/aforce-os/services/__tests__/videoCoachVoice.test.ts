import { describe, it, expect } from 'vitest';
import { buildVideoCoachLine } from '../videoCoachVoice';

describe('buildVideoCoachLine', () => {
  it('joins overlay title, subtitle, command action, and explanation in order', () => {
    const line = buildVideoCoachLine(
      {
        overlayTitle: 'CORRECT NOW',
        overlaySubtitle: 'AForce Stick + 20 oz. Immediate.',
      },
      {
        action: 'Drink 20 oz of water and take 1 AForce RTD before sleep.',
        explanation: 'Recovery window is open. Two units of fluid + electrolytes now is the difference.',
      },
    );
    expect(line).toBe(
      'CORRECT NOW. AForce Stick + 20 oz. Immediate. ' +
      'Drink 20 oz of water and take 1 AForce RTD before sleep. ' +
      'Recovery window is open. Two units of fluid + electrolytes now is the difference.',
    );
  });

  it('adds terminal punctuation to bare phrases so TTS pauses naturally', () => {
    const line = buildVideoCoachLine(
      { overlayTitle: 'GO TIME', overlaySubtitle: 'Hold the line — you are at peak' },
      { action: 'Maintain', explanation: 'Score is stable' },
    );
    expect(line).toBe('GO TIME. Hold the line — you are at peak. Maintain. Score is stable.');
  });

  it('skips the subtitle when the action already starts with it (no stutter)', () => {
    // Same prefix in both → don't read it twice.
    const line = buildVideoCoachLine(
      { overlayTitle: 'CLOSE THE GAP', overlaySubtitle: 'Recover deficit. 12 oz now.' },
      { action: 'Recover deficit. 12 oz now and recheck in 20.', explanation: '' },
    );
    expect(line).toBe('CLOSE THE GAP. Recover deficit. 12 oz now and recheck in 20.');
  });

  it('omits empty / whitespace-only sections gracefully', () => {
    const line = buildVideoCoachLine(
      { overlayTitle: 'RESET', overlaySubtitle: '' },
      { action: 'Breathe in 4, hold 2, out 6.', explanation: '   ' },
    );
    expect(line).toBe('RESET. Breathe in 4, hold 2, out 6.');
  });

  it('returns an empty string when nothing is speakable', () => {
    const line = buildVideoCoachLine(
      { overlayTitle: '', overlaySubtitle: '' },
      { action: '', explanation: '' },
    );
    expect(line).toBe('');
  });

  it('collapses internal whitespace runs in source strings', () => {
    const line = buildVideoCoachLine(
      { overlayTitle: '  CORRECT   NOW  ', overlaySubtitle: '' },
      { action: 'Drink   16  oz', explanation: '' },
    );
    expect(line).toBe('CORRECT NOW. Drink 16 oz.');
  });
});
