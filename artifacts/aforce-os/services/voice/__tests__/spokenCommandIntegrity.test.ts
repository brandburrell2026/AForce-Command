/**
 * RP-5 — SPOKEN COMMAND INTEGRITY (founder ruling R6, Wave 2, 2026-08-31).
 *
 * Planted BEFORE implementation. The defect: standard intensity + DEPLETED
 * routed the spoken system command through pressureCommandLine's hard 10-word
 * clip — the highest-risk guidance in the app truncated mid-clause by a
 * presentation constraint. Executed against main, the canonical Spanish
 * depleted action lost "ahora" (the urgency word) and pre-RP-2 the English
 * one ended in a dangling "Recheck in." with the interval amputated.
 *
 * Ruling R6: safety-critical truth does not adapt to presentation —
 * presentation adapts to safety-critical truth.
 *
 *   L1  DEPLETED is spoken VERBATIM under every intensity. No replacement
 *       table, no clip — the member hears the canonical instruction
 *       byte-exact, in every locale.
 *   L2  For other bands, explicit Pressure Mode may sharpen and may drop
 *       WHOLE trailing clauses past the 10-word cadence — but it never
 *       severs inside a clause: a single long sentence stays whole.
 *   L3  A dose token that enters the voice path leaves the voice path,
 *       at every band × intensity.
 *   L4  The risk-timer alert speaks the LIVE canonical minutes, not the
 *       static "15" it used to approximate the timer with (the one clock,
 *       ruling R2, extends to what the voice says about it).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  effectiveCommandLine,
  pressureCommandLine,
  riskTimerLine,
} from '../commandVoice';

const LOCALES_DIR = join(__dirname, '..', '..', '..', 'locales');
const localeFiles = () => readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
const coachOf = (f: string) =>
  JSON.parse(readFileSync(join(LOCALES_DIR, f), 'utf8')).coach ?? {};
const interpolate = (s: string) => s.split('{{score}}').join('22').split('{{oz}}').join('16');

const INTENSITIES = ['calm', 'standard', 'pressure'] as const;
const LEVELS = ['PEAK', 'BALANCED', 'RECOVERING'] as const;

describe('R6 — DEPLETED is never transformed', () => {
  it("every locale's canonical depleted action is spoken byte-exact at every intensity", () => {
    for (const f of localeFiles()) {
      const raw = coachOf(f).depleted_action;
      if (!raw) continue; // locale falls back to en at runtime; en is covered
      const action = interpolate(raw);
      for (const intensity of INTENSITIES) {
        expect(
          effectiveCommandLine(action, intensity, 'DEPLETED'),
          `${f} depleted_action must survive '${intensity}' verbatim`,
        ).toBe(action);
      }
    }
  });
});

describe('R6 — the pressure clip is clause-safe for the other bands', () => {
  it('a single sentence longer than the cadence stays WHOLE — no mid-clause severance', () => {
    // 13 words after transforms; the old clip amputated it after word 10.
    const out = pressureCommandLine(
      'Drink eight ounces of water with one AForce stick and one electrolyte pack now.',
    );
    // The clause's terminal word survives — nothing was cut mid-clause.
    expect(out.endsWith('now.')).toBe(true);
  });

  it('whole trailing clauses may drop; the surviving text is a whole-sentence prefix', () => {
    const out = pressureCommandLine(
      'Drink 12 ounces of water with 1 stick right now. Then log the intake on the journal screen when you are done.',
    );
    // First clause survives complete; the trailing clause is dropped whole.
    expect(out).toBe('Drink 12 ounces with 1 stick now.');
  });

  it('dose tokens that enter the voice path leave the voice path — every band × intensity', () => {
    const coach = coachOf('en.json');
    for (const key of ['peak_action', 'balanced_action', 'recovering_action', 'depleted_action']) {
      const action = interpolate(coach[key]);
      const doses = action.match(/\d+\s*(?:oz|ounces?|sticks?)/gi) ?? [];
      expect(doses.length, `${key} must carry a dose to make this law real`).toBeGreaterThan(0);
      for (const level of [...LEVELS, 'DEPLETED' as const]) {
        for (const intensity of INTENSITIES) {
          const spoken = effectiveCommandLine(action, intensity, level);
          for (const dose of doses) {
            const num = dose.match(/\d+/)![0];
            expect(
              spoken.includes(num),
              `${key} @ ${level}/${intensity}: dose '${dose}' lost — spoke: ${spoken}`,
            ).toBe(true);
          }
        }
      }
    }
  });
});

describe('R2×R6 — the risk-timer alert speaks the live canonical minutes', () => {
  it('the 16-minute threshold line carries the ACTUAL minutes, not a static 15', () => {
    expect(riskTimerLine(16, 'calm', 12)).toContain('12');
    expect(riskTimerLine(16, 'standard', 16)).toContain('16');
    expect(riskTimerLine(16, 'standard', 16)).not.toContain('15');
  });

  it('without live minutes the line degrades to the threshold itself — never a third number', () => {
    expect(riskTimerLine(16, 'standard')).toContain('16');
    expect(riskTimerLine(16, 'standard')).not.toContain('15');
  });

  it('no template braces ever reach the speaker', () => {
    for (const t of [16, 8, 4, 0] as const) {
      for (const intensity of INTENSITIES) {
        expect(riskTimerLine(t, intensity, 12)).not.toMatch(/[{}]/);
        expect(riskTimerLine(t, intensity)).not.toMatch(/[{}]/);
      }
    }
  });
});
