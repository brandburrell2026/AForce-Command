/**
 * HomeScreenV2 — the two signature moments, and the absence of everything else
 * (Wave-5 motion + haptics pass).
 *
 * The founder's brief: "Do not animate everything. Select no more than 3-5
 * signature AForce interaction moments across the entire Phase-1 product. Keep
 * the rest calm." Home used to stagger FIVE entrances (header, hero, command,
 * moments, signals) behind `elite_home_experience_enabled` — animate-everything
 * wearing a flag, and none of it shipped because the flag is off. It now
 * carries exactly two, neither flag-gated:
 *
 *   1. HydroState reveal — the readiness arc draws itself in.
 *   2. Command reveal    — the one command card arrives a beat later.
 *
 * Source-text guard, per this directory's documented convention: HomeScreenV2
 * is a store + router + Clerk-connected container the suite never mounts (see
 * `homeScreenV2Wiring.test.ts`'s header for the full rationale). The pure
 * DECISION behind moment 1 is unit-tested in `homePresentation.test.ts`, and
 * the arc's reveal-then-progress behavior in
 * `components/ui/__tests__/AFReadinessArc.motion.render.test.tsx`; this file
 * covers what the screen actually wires up.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, '..', 'HomeScreenV2.tsx'), 'utf8');
// Comments may discuss the removed choreography; code may not.
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

describe('HomeScreenV2 — exactly one entrance animation', () => {
  it('animates exactly ONE element on the whole screen', () => {
    const entrances = CODE.match(/entering=\{/g) ?? [];
    expect(entrances).toHaveLength(1);
  });

  it('that one element is the command card', () => {
    const wrapper = CODE.slice(
      CODE.indexOf('entering={commandReveal}'),
      CODE.indexOf('</Animated.View>', CODE.indexOf('entering={commandReveal}')),
    );
    expect(wrapper).toContain('<AFCommandCard');
  });

  it('the staggered reveal() helper is gone — no index-driven choreography', () => {
    expect(CODE).not.toMatch(/const reveal = /);
    expect(CODE).not.toMatch(/entering=\{reveal\(/);
  });

  it('the command reveal is skipped entirely under reduced motion', () => {
    expect(CODE).toMatch(
      /const commandReveal = reducedMotion\s*\?\s*undefined\s*:\s*FadeInDown/,
    );
  });

  it('uses afMotion duration tokens, not invented magic numbers', () => {
    const decl = CODE.slice(CODE.indexOf('const commandReveal'), CODE.indexOf('const arcDims'));
    expect(decl).toContain('afMotion.durations.entrance');
    expect(decl).toContain('afMotion.durations.standard');
    expect(decl).not.toMatch(/duration\(\d/);
  });
});

describe('HomeScreenV2 — the HydroState reveal is the arc itself', () => {
  it('passes the arc-animation plan to AFReadinessArc', () => {
    expect(CODE).toMatch(/<AFReadinessArc[^>]*animate=\{arcPlan\.animateRing\}/);
  });

  it('no longer wraps the hero in its own entrance (the arc IS the reveal)', () => {
    const heroStart = CODE.indexOf("evidence === 'building'");
    const commandStart = CODE.indexOf('entering={commandReveal}');
    expect(heroStart).toBeGreaterThan(-1);
    expect(commandStart).toBeGreaterThan(heroStart);
    const heroBlock = CODE.slice(heroStart, commandStart);
    expect(heroBlock).toContain('<AFReadinessArc');
    expect(heroBlock).not.toContain('entering=');
  });

  it('the decorative "alive" breathing halo is no longer requested', () => {
    expect(CODE).not.toMatch(/alive=/);
  });
});

describe('HomeScreenV2 — command completion reaches the hand', () => {
  it('imports the shared moment façade rather than expo-haptics directly', () => {
    expect(CODE).toContain("import { fireMoment } from '@/services/haptics';");
    expect(CODE).not.toMatch(/from 'expo-haptics'/);
  });

  /**
   * BUILD-61 CORRECTION 2 — this used to assert the moment fired from INSIDE
   * `onPrimary`, alongside the log. That was the defect, not the contract: the
   * press handler ran `fireMoment('command_completed')` and THEN dispatched a
   * write it never waited on, so the hand was told "logged" before the request
   * was attempted — and was told the same thing when the request failed. The
   * requirement ("completion reaches the hand") is unchanged and the
   * assertions below are strictly stronger: the moment must reach the hand
   * only on a CONFIRMED completion.
   */
  it("does NOT fire 'command_completed' from the press handler any more", () => {
    const onPrimary = CODE.slice(
      CODE.indexOf('onPrimary={'),
      CODE.indexOf('rationale={engine.command.explanation'),
    );
    expect(onPrimary).not.toContain('fireMoment(');
    // …and the press does not write, either — it opens the logging surface.
    expect(onPrimary).not.toContain('logIntake(');
  });

  it("fires 'command_completed' only once the cycle has SETTLED with a result", () => {
    // The store's `logIntake` catches its own errors and resolves either way,
    // so the settled cycle state — not the promise — is the honest signal.
    const effect = CODE.slice(
      CODE.indexOf('if (!confirmInFlightRef.current) return;'),
      CODE.indexOf('}, [isCompletingCycle, lastCycleResult]);'),
    );
    expect(effect).toContain('if (isCompletingCycle) return;');
    expect(effect).toContain('if (!lastCycleResult) return;');
    expect(effect).toContain("fireMoment('command_completed')");
    // Order matters: both guards must precede the moment, or a failed write
    // (CYCLE_FAILURE → lastCycleResult null) would still buzz "completed".
    expect(effect.indexOf('if (isCompletingCycle) return;')).toBeLessThan(
      effect.indexOf("fireMoment('command_completed')"),
    );
    expect(effect.indexOf('if (!lastCycleResult) return;')).toBeLessThan(
      effect.indexOf("fireMoment('command_completed')"),
    );
  });

  it('mutation-verify: dropping the failure guard is detectable', () => {
    // Proves the slice measured above actually tracks the source. If the
    // `!lastCycleResult` early-return were deleted, a CYCLE_FAILURE would fire
    // a completion haptic for a write that never landed.
    const mutated = CODE.replace('if (!lastCycleResult) return;', '');
    const effect = mutated.slice(
      mutated.indexOf('if (!confirmInFlightRef.current) return;'),
      mutated.indexOf('}, [isCompletingCycle, lastCycleResult]);'),
    );
    expect(effect).not.toContain('if (!lastCycleResult) return;');
    expect(effect).toContain("fireMoment('command_completed')");
  });

  it('fires no other haptic moment from this screen', () => {
    const moments = CODE.match(/fireMoment\(/g) ?? [];
    expect(moments).toHaveLength(1);
  });
});
