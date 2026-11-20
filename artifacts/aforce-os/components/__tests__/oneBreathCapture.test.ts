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
    expect(code).toContain('ONE_BREATH_ORB_SIZE = 149');
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

  // "Make sure One Breath looks just like the link" (Brandon, 2026-11-20).
  // Values are the prototype's own, measured from its source at 390pt wide.
  it('the orb and dial are the prototype\'s sizes: a 149pt orb in a 234pt dial in a 290pt stage', () => {
    expect(code).toContain('ONE_BREATH_ORB_SIZE = 149');
    expect(code).toContain('ONE_BREATH_DIAL_SIZE = 234');
    expect(code).toContain('const STAGE_HEIGHT = 290');
  });

  it('the dial is the prototype\'s bezel: 120 ticks, every tenth longer and brighter, starting at the top', () => {
    expect(orb).toContain('const ticks = 120;');
    expect(orb).toContain('const major = i % 10 === 0;');
    expect(orb).toContain('strokeOpacity={major ? 0.38 : 0.14}');
    expect(orb).toContain('- Math.PI / 2');
  });

  it('the personal orb in its dial is the prototype\'s sphere; every other orb keeps the Master Brief ramp', () => {
    expect(orb).toContain('const deep = !!dial && !social && !moon;');
    expect(orb).toContain('D.ramp.map(');
    expect(orb).toContain('<Circle cx={75} cy={75} r={74} fill={`url(#${id})`} />');
    const tokens = readFileSync(join(__dirname, '..', '..', 'theme', 'afTokens.ts'), 'utf8');
    expect(tokens).toContain("oneBreathDeep: ['#FF7A7F', '#EE2C37', '#B5121C', '#33040A'],");
    expect(tokens).toContain("oneBreath: ['#FFC9C4', '#F0525A', '#E51E2A', '#5C0A0E'],");
    // No colour is written into the component itself.
    expect(orb.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')).not.toMatch(/#[0-9a-fA-F]{6}\b|rgba?\(/);
  });

  it('the glow is a round halo, never a square', () => {
    expect(orb).toContain('borderRadius: size / 2');
  });

  it('chips, the bar and the Close button sit on the panel surface; the hint and placeholder are the dim tone', () => {
    expect(code.match(/backgroundColor: T\.panel/g)!.length).toBeGreaterThanOrEqual(3);
    expect(code).toContain('placeholderTextColor={T.dim}');
    expect(code).toContain('marginHorizontal: -5');
  });

  it('the send button keeps its warm white when empty, and still reports disabled', () => {
    expect(code).not.toContain('p.sendDisabled && s.disabled');
    expect(code).toContain('accessibilityState={{ disabled: p.sendDisabled }}');
    expect(code).toContain('disabled={p.sendDisabled}');
  });
});
