/**
 * One Breath · Capture (App Spec v1.8.2, Appendix G · One Breath: the short
 * approved version). Layout and wording only; nothing here can seal.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '..', 'oneBreath');
const view = readFileSync(join(DIR, 'OneBreathCapture.tsx'), 'utf8');
const screen = readFileSync(join(DIR, 'MomentPreparationScreen.tsx'), 'utf8');
const orb = readFileSync(join(DIR, 'PreparationOrb.tsx'), 'utf8');

describe('One Breath capture', () => {
  it('asks the short question', () => {
    expect(screen).toContain('question={`What matters ${day ? "today" : "tonight"}?`}');
    expect(screen).not.toContain('What would make');
  });

  it('the line under the orb says what the control really does', () => {
    expect(view).toContain('return "Tap to speak. Tap again when done.";');
    expect(view).toContain('"Listening… Tap to stop."');
    expect(view).toContain('"Starting voice… Tap to cancel."');
    // Hold-to-speak is not built; the screen must not tell members to hold.
    expect(view).not.toMatch(/"Hold to speak/);
  });

  it('uses the 170pt orb with the Master Brief gradient', () => {
    expect(view).toContain('ONE_BREATH_CAPTURE_ORB_SIZE = 170');
    expect(orb).toContain('r="98%"');
    expect(orb).toContain('offset=".32"');
    expect(orb).toContain('offset=".62"');
  });

  it('typing is its own step with the short placeholder and Continue', () => {
    expect(view).toContain('placeholder="A few words is enough"');
    expect(view).toContain('>Continue</Text>');
    expect(view).toContain('accessibilityLabel="Your moment"');
  });

  it('the primary is warm white; blue only in a Social Moment', () => {
    expect(view).toContain('backgroundColor: p.social ? T.blue : T.bone');
    expect(screen).toContain('backgroundColor: social ? T.blue : T.bone');
  });

  it('the capture view cannot seal, save or record on its own', () => {
    const code = view.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/commit|seal|logIntake|useOneBreathVoice|AsyncStorage/i);
  });

  it('the screen still routes Continue through review, never straight to a save', () => {
    expect(screen).toContain('onContinue={reviewWords}');
  });
});
