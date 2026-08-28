import { describe, it, expect } from 'vitest';
import {
  assessUrineColor,
  URINE_COLOR_OPTIONS,
  URINE_DISCLAIMER,
  type UrineColor,
} from '../urineHydrationCheck';

describe('Urine Hydration Check — color → verdict mapping (spec)', () => {
  it('exposes the four color inputs in spec order (clear → dark)', () => {
    expect(URINE_COLOR_OPTIONS.map((o) => o.color)).toEqual([
      'clear',
      'light_yellow',
      'yellow',
      'dark_yellow',
    ]);
    expect(URINE_COLOR_OPTIONS.map((o) => o.label)).toEqual([
      'Clear',
      'Light Yellow',
      'Yellow',
      'Dark Yellow',
    ]);
  });

  it('exposes the non-medical disclaimer verbatim per spec', () => {
    expect(URINE_DISCLAIMER).toBe(
      'Urine color is a general hydration signal and not a medical diagnostic tool.',
    );
  });

  it.each<[UrineColor, string, string]>([
    ['clear', 'Hydration Appears Stable', 'stable'],
    ['light_yellow', 'Good Hydration Range', 'good'],
    ['yellow', 'Hydration Support Suggested', 'support'],
    ['dark_yellow', 'Deeper Color — A Good Time for Fluids', 'correction'],
  ])('maps %s → "%s" (severity=%s)', (color, verdict, severity) => {
    const result = assessUrineColor(color);
    expect(result.color).toBe(color);
    expect(result.verdict).toBe(verdict);
    expect(result.severity).toBe(severity);
    expect(result.colorLabel).toBeTruthy();
    expect(result.detail).toBeTruthy();
    expect(result.recommendation).toBeTruthy();
    expect(result.hex).toMatch(/^#[0-9A-F]{6}$/i);
  });

  // ── COMMAND-AUTHORITY CONTAINMENT (wave 1, founder-authorized) ────────────
  // CONSCIOUS REPIN. The assertions this block replaces pinned the OLD
  // behavior — "/AForce/" product pushes and the "12 oz water" pour on the
  // corrective recommendations — which was a second command authority: this
  // observation helper issued its own doses and its own "Recheck in 30
  // minutes" clock on the same screen that renders the canonical engine
  // command. RecoveryCommand is the ONE authoritative action; the canonical
  // riskTimer owns recheck cadence; recording the reading feeds urineSignal
  // into the engine so the canonical command already reflects it. The pins
  // below are the new invariant: observe, defer, never command.

  it('CONTAINMENT: no recommendation issues a dose (no oz / stick / serving numbers)', () => {
    for (const opt of URINE_COLOR_OPTIONS) {
      const r = assessUrineColor(opt.color);
      expect(r.recommendation, `${opt.color} must not carry a dose`).not.toMatch(/\d+\s*(oz|ounce|stick|serving)/i);
      expect(r.detail, `${opt.color} detail must not carry a dose`).not.toMatch(/\d+\s*(oz|ounce|stick|serving)/i);
    }
  });

  it('CONTAINMENT: no recommendation runs its own recheck clock (canonical riskTimer owns cadence)', () => {
    for (const opt of URINE_COLOR_OPTIONS) {
      const r = assessUrineColor(opt.color);
      expect(r.recommendation, `${opt.color} must not schedule a recheck`).not.toMatch(/recheck\s+(in|before)\b/i);
      expect(r.recommendation).not.toMatch(/\bin \d+\s*(min|minute|hour)/i);
    }
  });

  it('CONTAINMENT: no recommendation pushes product (observation, never a sell)', () => {
    for (const opt of URINE_COLOR_OPTIONS) {
      expect(assessUrineColor(opt.color).recommendation).not.toMatch(/AForce/);
    }
  });

  it('every recommendation defers to the ONE canonical command', () => {
    for (const opt of URINE_COLOR_OPTIONS) {
      expect(assessUrineColor(opt.color).recommendation).toMatch(/current command/);
    }
  });

  it('keeps the CR-1 claims guards: no efficacy tails or diagnosis-adjacent framing', () => {
    for (const c of ['yellow', 'dark_yellow'] as const) {
      expect(assessUrineColor(c).recommendation).not.toMatch(/efficiency support|mineral recovery support/);
    }
    expect(assessUrineColor('dark_yellow').verdict).not.toMatch(/Correction/);
    expect(assessUrineColor('dark_yellow').detail).not.toMatch(/before performance is affected/);
  });

  it('never uses aggressive "Take 1" verbs or alarmist verdict framing', () => {
    for (const opt of URINE_COLOR_OPTIONS) {
      const r = assessUrineColor(opt.color);
      expect(r.recommendation).not.toMatch(/^Take 1\b/);
      expect(r.verdict).not.toMatch(/\bnot optimal\b/);
    }
  });
});
