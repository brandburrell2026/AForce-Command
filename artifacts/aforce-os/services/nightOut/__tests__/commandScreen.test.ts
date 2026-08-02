import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nightOutCommandFixtures } from '../commandFixtures';

const APP = join(__dirname, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(APP, ...p), 'utf8');

describe('NO-c deterministic view-model states', () => {
  const fx = nightOutCommandFixtures();

  it('every fixture resolves to its expected mode', () => {
    expect(fx['pre-session-command'].mode).toBe('pre-session');
    expect(fx['pre-session-no-command'].mode).toBe('no-command');
    expect(fx['active-timer'].mode).toBe('active');
    expect(fx['timer-expired'].mode).toBe('active'); // expired still needs explicit completion
    expect(fx['processing'].mode).toBe('processing');
    expect(fx['limited-confidence'].mode).toBe('pre-session');
    expect(fx['invalid-timer-recovery'].mode).toBe('pre-session'); // safe fallback, not broken active
  });

  it('limited-confidence + stale-offline surface honest limited/waiting copy', () => {
    expect(fx['limited-confidence'].now.confidenceLabel).toBe('Limited');
    expect(fx['limited-confidence'].now.freshnessLabel).toMatch(/Waiting for fresher/);
    expect(fx['stale-offline'].now.freshnessLabel).toMatch(/Waiting for fresher/);
  });

  it('pre-session has START WATER and no active countdown; active has COMPLETE WATER', () => {
    expect(fx['pre-session-command'].now.cta).toBe('START WATER');
    expect(fx['pre-session-command'].now.remainingLabel).toBeUndefined();
    expect(fx['active-timer'].now.cta).toBe('COMPLETE WATER');
    expect(fx['active-timer'].now.remainingLabel).toBe('15:00');
  });
});

describe('NO-c Score-Protection invariants (screen is presentation-only)', () => {
  const screen = read('screens', 'NightOutCommandScreen.tsx');

  it('completion routes through the approved logIntake path, not a direct score write', () => {
    expect(screen).toMatch(/logIntake\('water'/);
    // presentation must not dispatch/mutate score or the reducer directly
    expect(screen).not.toMatch(/dispatch\(/);
    expect(screen).not.toMatch(/setScore|engine\.score\s*=|SET_SCORE|CYCLE_SUCCESS/);
  });

  it('the timer starts ONLY on START WATER (accept), never on mount/open', () => {
    // the only timer.start call sits inside the onStartWater handler
    const starts = screen.match(/timer\.start\(/g) ?? [];
    expect(starts.length).toBe(1);
    expect(screen).toMatch(/const onStartWater = async \(\) => \{[\s\S]*timer\.start\(/);
  });

  it('restoration truth: START WATER snapshots the accepted amount, and the active view reads it', () => {
    // acceptance persists the snapshot
    expect(screen).toMatch(/timer\.start\(commandId, windowMs, \{[\s\S]*doseOz/);
    // during an active/restored command the displayed command comes from the
    // accepted snapshot, not the live engine command
    expect(screen).toMatch(/acceptedDose = timer\.accepted\?\.doseOz/);
    expect(screen).toMatch(/isActive \? \(acceptedDose \?\? engineDose\)/);
    expect(screen).toMatch(/isActive \? \(timer\.accepted\?\.title/);
  });

  it('contains NO alcohol-logging / session-activation code in NO-c', () => {
    // the word "alcohol" may appear in the doc comment; assert no such CODE.
    expect(screen).not.toMatch(/logSocialDrink\(|activateSocialMode\(|estimateBAC|logIntake\('(?!water)/);
  });

  it('the container honors reduced motion and delegates rendering to the pure view', () => {
    expect(screen).toMatch(/useReducedMotion/);
    expect(screen).toMatch(/<NightOutCommandView/);
    const viewCmp = read('components', 'nightOut', 'NightOutCommandView.tsx');
    expect(viewCmp).toMatch(/AFReadinessArc/); // HydroState hero, the only hero
    expect(viewCmp).toMatch(/animate=\{!reducedMotion\}/);
  });
});

describe('NO-c route is authorization-gated to the new command screen', () => {
  const route = read('app', 'night-out.tsx');
  it('renders NightOutCommandScreen only when authorized', () => {
    expect(route).toMatch(/NightOutCommandScreen/);
    expect(route).toMatch(/isNightOutEnabled/);
    expect(route).toMatch(/Redirect href="\/\(tabs\)\/protocol"/);
    expect(route).not.toMatch(/SocialModeV2Screen/); // no longer the alcohol screen
  });
});
