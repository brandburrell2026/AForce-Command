/**
 * One Breath · opening screen, laid out as the approved prototype's One Breath
 * (mark + status, round Close, orb in a tick ring, "Tap to talk", a prompt,
 * example chips, the talk-or-type bar). Layout and wording only: no AI model,
 * and nothing here can seal.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '..', 'oneBreath');
const view = readFileSync(join(DIR, 'OneBreathCapture.tsx'), 'utf8');
const code = view.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const screen = readFileSync(join(DIR, 'MomentPreparationScreen.tsx'), 'utf8');
const orb = readFileSync(join(DIR, 'PreparationOrb.tsx'), 'utf8');

describe('One Breath opening screen', () => {
  it('has the demo parts: status word, Close, orb in a tick ring, hint, prompt, chips, bar', () => {
    expect(code).toContain('return "Standby";');
    expect(code).toContain('accessibilityLabel="Close"');
    expect(code).toContain('dial={ONE_BREATH_DIAL_SIZE}');
    expect(code).toContain('return "Tap to talk";');
    expect(code).toContain('Plan a Moment. Just say it.');
    expect(code).toContain('"Talk or type to AFORCE"');
    expect(code).toContain('accessibilityLabel="Send"');
    expect(code).toContain('accessibilityLabel="Your moment"');
  });

  it('the long question and the reservation paste entry are gone', () => {
    expect(screen).not.toContain('What would make');
    expect(code).not.toContain('reservation');
  });

  it('only offers examples One Breath can really plan', () => {
    expect(code).toContain('"Lift tomorrow at 6:30 AM, want my legs fresh"');
    // The prototype also suggests logging a drink, HydroState and scanning.
    // One Breath cannot do those yet, so it does not promise them.
    expect(code).not.toMatch(/Log 16 oz|How am I doing|Scan a drink|check your HydroState/);
  });

  it('shows no simulated sources and no operations log', () => {
    expect(code).not.toMatch(/PHANTOM|SYNCED|Synced 2m|Operations/i);
  });

  it('typed-only phones get a hint that says so and no talk control', () => {
    expect(code).toContain('if (!available) return "Type your moment";');
    expect(code).toMatch(/\{p\.voiceAvailable \? \(\s*<Pressable[\s\S]*?accessibilityLabel=\{p\.voiceListening \? "Stop" : "Speak"\}/);
  });

  it('the orb uses the Master Brief gradient and a still tick ring', () => {
    expect(code).toContain('ONE_BREATH_ORB_SIZE = 132');
    expect(orb).toContain('r="98%"');
    expect(orb).toContain('offset=".32"');
    expect(orb).toContain('offset=".62"');
    expect(orb).toContain('if (!dial) return orb;');
  });

  it('send is warm white; blue only in a Social Moment', () => {
    expect(code).toContain('backgroundColor: p.social ? T.blue : T.bone');
  });

  it('the view cannot seal, save or record on its own', () => {
    expect(code).not.toMatch(/commit|seal|logIntake|useOneBreathVoice|AsyncStorage|fetch\(/i);
  });

  it('Send goes to review, never straight to a save', () => {
    expect(screen).toContain('onSend={reviewWords}');
  });
});
