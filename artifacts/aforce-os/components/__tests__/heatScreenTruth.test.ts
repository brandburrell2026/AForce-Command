/**
 * HEAT SCREEN TRUTH LOCK — the useHeatGuard rehost (founder ruling,
 * 2026-08-28, the last #869 hold).
 *
 * What the census found: the LIVE /heat screen (reachable from Cruise,
 * the Guardian redirect, and the voice route table) rendered
 * evaluateHeatRisk over SAMPLE_INPUTS with a user-selectable band
 * simulator and no sample labeling — fabricated heat-risk scores and
 * safety commands presented as real — while the honest member-state
 * path (useHeatGuard → buildHeatSignalInput, the #862 truth contract)
 * sat orphaned. The founder ruled: REHOST.
 *
 * Pinned here so neither half regresses:
 *  1. the screen consumes the live guard, never the sample feed;
 *  2. the simulator cannot quietly return;
 *  3. the recheck meta line shows the hook's safety-clamped cadence
 *     (the sweat-autopilot clamp is the reason the hook exists);
 *  4. the hook threads the real monitoring cadence into the spoken
 *     escalation (the template engine's {recheck} default is a
 *     hardcoded constant, not a measurement).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AOS = join(__dirname, '..', '..');
const SCREEN = readFileSync(join(AOS, 'screens', 'HeatRiskScreen.tsx'), 'utf8');
const HOOK = readFileSync(join(AOS, 'hooks', 'useHeatGuard.ts'), 'utf8');

describe('/heat renders the member, not a sample', () => {
  it('consumes the live guard', () => {
    expect(SCREEN).toMatch(/import \{ useHeatGuard \} from "@\/hooks\/useHeatGuard";/);
    expect(SCREEN).toMatch(/const guard = useHeatGuard\(\);/);
    expect(SCREEN).toMatch(/const score = guard\.heat;/);
  });

  it('the sample feed and simulator cannot return', () => {
    expect(SCREEN).not.toMatch(/SAMPLE_INPUTS/);
    expect(SCREEN).not.toMatch(/mocks\/heatData/);
    expect(SCREEN).not.toMatch(/SIMULATE RISK PATTERN/);
    expect(SCREEN).not.toMatch(/bandPattern/);
  });

  it('the recheck meta line shows the safety-clamped cadence', () => {
    expect(SCREEN).toMatch(/Recheck in \{guard\.recheckIntervalMin\} min/);
    expect(SCREEN).not.toMatch(/Recheck in \{score\.recheckMinutes\} min/);
  });
});

describe('the escalation speaks real cadence, honest inputs', () => {
  it('the hook evaluates through the #862 honest input builder', () => {
    expect(HOOK).toMatch(/evaluateHeatRisk\(buildHeatSignalInput\(userState, score\)/);
  });

  it('the spoken escalation threads the safety-clamped monitoring cadence', () => {
    expect(HOOK).toMatch(/recheck_minutes: heatScore\.recheckIntervalMin,/);
  });
});
