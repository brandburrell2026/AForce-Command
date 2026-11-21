import { describe, expect, it } from 'vitest';
import { CUSTOM_OZ_HINT, MAX_SINGLE_LOG_OZ, parseCustomOz, planAmountStep } from '../hydroscan/amountOptions';
import type { Field } from '../hydroscan/labelEvidence';

const FALLBACK = [8, 12, 16, 20, 24] as const;
const vol = (value: number | null, confidence: Field<number>['confidence']): Field<number> => ({
  value,
  confidence,
  source: value == null ? null : 'label',
});

describe('amount step', () => {
  it('a confirmed 20 fl oz bottle offers half, all and Custom, and nothing else', () => {
    const plan = planAmountStep(vol(20, 'confirmed'), FALLBACK);
    expect(plan.mode).toBe('container');
    expect(plan.containerOz).toBe(20);
    expect(plan.choices.map((c) => c.label)).toEqual(['10 fl oz · half', '20 fl oz · all', 'Custom']);
    expect(plan.choices.map((c) => c.oz)).toEqual([10, 20, null]);
  });

  it('half of 16.9 fl oz rounds to a tenth', () => {
    const plan = planAmountStep(vol(16.9, 'confirmed'), FALLBACK);
    expect(plan.choices.map((c) => c.label)).toEqual(['8.5 fl oz · half', '16.9 fl oz · all', 'Custom']);
  });

  it('nothing is preselected: no choice carries a selected flag', () => {
    for (const c of planAmountStep(vol(20, 'confirmed'), FALLBACK).choices) {
      expect(c).not.toHaveProperty('selected');
    }
  });

  it('a package volume that is only likely, or unknown, falls back to the existing amounts', () => {
    for (const v of [vol(20, 'likely'), vol(null, 'unknown')]) {
      const plan = planAmountStep(v, FALLBACK);
      expect(plan.mode).toBe('fallback');
      expect(plan.containerOz).toBeNull();
      expect(plan.choices.map((c) => c.label)).toEqual(['8 oz', '12 oz', '16 oz', '20 oz', '24 oz', 'Custom']);
    }
  });

  it('a container above the single-log ceiling is not offered as "all"', () => {
    const plan = planAmountStep(vol(MAX_SINGLE_LOG_OZ + 1, 'confirmed'), FALLBACK);
    expect(plan.mode).toBe('fallback');
  });

  it('a tiny container offers all and Custom without a meaningless half', () => {
    const plan = planAmountStep(vol(0.8, 'confirmed'), FALLBACK);
    expect(plan.choices.map((c) => c.id)).toEqual(['full', 'custom']);
  });
});

describe('custom amount', () => {
  it.each([
    ['12', 12],
    ['12.5', 12.5],
    ['12,5', 12.5],
    [' 16 oz ', 16],
    ['16 fl oz', 16],
    ['0.5', 0.5],
    ['64', 64],
  ])('parses %s', (input, expected) => {
    expect(parseCustomOz(input)).toBe(expected);
  });

  it.each(['', 'abc', '0', '-3', '65', '0.2', '12 liters', '1e3', '12.555', '1 2'])('rejects "%s"', (input) => {
    expect(parseCustomOz(input)).toBeNull();
  });

  it('says the allowed range', () => {
    expect(CUSTOM_OZ_HINT).toBe('Enter 0.5 to 64 fl oz.');
  });
});
