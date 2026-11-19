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

describe('One Breath steps after the opening screen (prototype styling)', () => {
  const ring = readFileSync(join(DIR, 'SealRing.tsx'), 'utf8');
  const ringCode = ring.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('small labels are blue only in a Social Moment', () => {
    expect(screen).toContain('const accent = social ? T.blueHi : T.muted;');
  });

  it('Mirror is headed "What I heard" and Plan "Your plan"', () => {
    expect(screen).toContain('WHAT I HEARD');
    expect(screen).not.toContain('HERE’S WHAT I HEARD');
    expect(screen).toMatch(/>\s*Your plan\s*<\/Text>/);
  });

  it('Plan rows put the time at the left of each step', () => {
    expect(screen).toContain('<View key={i} style={s.planRow}>');
    expect(screen).toMatch(/planRow: \{\s*flexDirection: "row",/);
  });

  it('the seal control is the 150pt ring, warm white (blue in Social), not a red fill', () => {
    expect(ring).toContain('SEAL_RING_SIZE = 150');
    expect(ring).toContain('stroke={social ? T.blueHi : T.bone}');
    expect(ringCode).not.toMatch(/T\.red|af\.red/);
    expect(screen).toContain('<SealRing progress={progress} social={social}>');
    expect(screen).toContain('Release early to cancel. Nothing is saved until sealed.');
  });

  it('the ring only draws: the hold, its timing and the approval stay with the screen', () => {
    expect(ringCode).not.toMatch(/onPress|commit|seal\(|Animated\.timing|setTimeout/);
    // Exactly the same hold wiring as before on the pressable around it.
    expect(screen).toMatch(/onPressIn=\{startHold\}\s*onPressOut=\{cancelHold\}\s*onAccessibilityTap=\{sealByHold\}/);
    expect(screen).toContain('accessibilityLabel="Hold to seal"');
  });

  it('no one-tap seal was added', () => {
    expect(screen).not.toMatch(/Seal with one tap/i);
  });
});
