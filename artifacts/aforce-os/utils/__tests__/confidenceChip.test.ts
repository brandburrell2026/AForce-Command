/**
 * Show-10 — Confidence Chip display model.
 *
 * Pins: the ramp is anchored to §58's CONFIDENCE_OPACITY (no parallel ramp);
 * every gradient vocabulary (quality/freshness/completeness) maps every level to
 * a monotonically-descending opacity; labels are structural caps tokens (not
 * claims); §56 is absent by design.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { CONFIDENCE_OPACITY } from '../commandConfidenceDisplay';
import {
  completenessChip,
  signalQualityChip,
  freshnessChip,
  CHIP_OPACITY,
  type ConfidenceChipModel,
} from '../confidence/confidenceChip';

describe('Show-10 — CHIP_OPACITY anchors to §58 (no parallel ramp)', () => {
  it('reuses Command Confidence opacities for full/strong/weak', () => {
    expect(CHIP_OPACITY.full).toBe(CONFIDENCE_OPACITY.high);     // 1
    expect(CHIP_OPACITY.strong).toBe(CONFIDENCE_OPACITY.medium); // 0.7
    expect(CHIP_OPACITY.weak).toBe(CONFIDENCE_OPACITY.low);      // 0.45
    expect(CHIP_OPACITY.faint).toBeLessThan(CHIP_OPACITY.weak);  // 0.3 < 0.45
  });

  it('the anchor is a real reuse, not a coincidental literal (source-pin, qa M2)', () => {
    // Value-equality can't tell `CONFIDENCE_OPACITY.high` from a hardcoded `1`
    // (primitives carry no provenance). Pin the source references so a future
    // delink to literals — silently reintroducing the parallel ramp this module
    // exists to prevent — fails loudly. Robust to reformatting (references only).
    const modulePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../confidence/confidenceChip.ts',
    );
    const src = readFileSync(modulePath, 'utf-8');
    expect(src).toMatch(/full:\s*CONFIDENCE_OPACITY\.high\b/);
    expect(src).toMatch(/strong:\s*CONFIDENCE_OPACITY\.medium\b/);
    expect(src).toMatch(/weak:\s*CONFIDENCE_OPACITY\.low\b/);
  });
});

describe('Show-10 — completeness chip (§55)', () => {
  it('maps every level to the right token + opacity', () => {
    expect(completenessChip('rich')).toEqual({ label: 'RICH', opacity: 1 });
    expect(completenessChip('partial')).toEqual({ label: 'PARTIAL', opacity: 0.7 });
    expect(completenessChip('sparse')).toEqual({ label: 'SPARSE', opacity: 0.45 });
  });
});

describe('Show-10 — signal quality chip (§54)', () => {
  it('maps all four ratings, opacity descending', () => {
    expect(signalQualityChip('excellent')).toEqual({ label: 'EXCELLENT', opacity: 1 });
    expect(signalQualityChip('good')).toEqual({ label: 'GOOD', opacity: 0.7 });
    expect(signalQualityChip('limited')).toEqual({ label: 'LIMITED', opacity: 0.45 });
    expect(signalQualityChip('unavailable')).toEqual({ label: 'UNAVAILABLE', opacity: 0.3 });
  });
});

describe('Show-10 — freshness chip (§53)', () => {
  it('maps all four ratings, opacity descending', () => {
    expect(freshnessChip('fresh')).toEqual({ label: 'FRESH', opacity: 1 });
    expect(freshnessChip('aging')).toEqual({ label: 'AGING', opacity: 0.7 });
    expect(freshnessChip('stale')).toEqual({ label: 'STALE', opacity: 0.45 });
    expect(freshnessChip('expired')).toEqual({ label: 'EXPIRED', opacity: 0.3 });
  });
});

describe('Show-10 — invariants across all vocabularies', () => {
  const gradients: ConfidenceChipModel[][] = [
    (['rich', 'partial', 'sparse'] as const).map(completenessChip),
    (['excellent', 'good', 'limited', 'unavailable'] as const).map(signalQualityChip),
    (['fresh', 'aging', 'stale', 'expired'] as const).map(freshnessChip),
  ];

  it('opacity strictly decreases with each worse level (a real gradient)', () => {
    for (const ramp of gradients) {
      for (let i = 1; i < ramp.length; i += 1) {
        expect(ramp[i].opacity).toBeLessThan(ramp[i - 1].opacity);
      }
    }
  });

  it('labels are non-empty uppercase structural tokens (no claim, no lowercase copy)', () => {
    for (const ramp of gradients) {
      for (const chip of ramp) {
        expect(chip.label).toBe(chip.label.toUpperCase());
        expect(chip.label.length).toBeGreaterThan(0);
        expect(chip.label).toMatch(/^[A-Z]+$/); // a single token, never a sentence
      }
    }
  });

  it('every opacity sits in (0,1]', () => {
    for (const ramp of gradients) {
      for (const chip of ramp) {
        expect(chip.opacity).toBeGreaterThan(0);
        expect(chip.opacity).toBeLessThanOrEqual(1);
      }
    }
  });
});
