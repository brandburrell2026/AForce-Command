import { describe, it, expect } from 'vitest';

import {
  BAND_INDEX_STOPS,
  GLOW_STOPS,
  GLOW_STOPS_PRESSURE,
  PRIMARY_STOPS,
  PRIMARY_STOPS_PRESSURE,
  STATUS_BANDS,
  getStatusBand,
  getStatusBandIndex,
  getStatusColor,
} from '../../theme/statusColor';

describe('STATUS_BANDS — five bands matching the brand spec', () => {
  it('declares exactly 5 bands ordered worst → best', () => {
    expect(STATUS_BANDS.map((b) => b.band)).toEqual([
      'CRITICAL',
      'RISK',
      'DECLINING',
      'STABLE',
      'OPTIMAL',
    ]);
  });

  it('covers 0-100 with no gaps and no overlaps', () => {
    expect(STATUS_BANDS[0]).toMatchObject({ band: 'CRITICAL',  min: 0,  max: 29  });
    expect(STATUS_BANDS[1]).toMatchObject({ band: 'RISK',      min: 30, max: 49  });
    expect(STATUS_BANDS[2]).toMatchObject({ band: 'DECLINING', min: 50, max: 69  });
    expect(STATUS_BANDS[3]).toMatchObject({ band: 'STABLE',    min: 70, max: 84  });
    expect(STATUS_BANDS[4]).toMatchObject({ band: 'OPTIMAL',   min: 85, max: 100 });

    for (let i = 1; i < STATUS_BANDS.length; i++) {
      expect(STATUS_BANDS[i].min).toBe(STATUS_BANDS[i - 1].max + 1);
    }
  });

  it('assigns sequential band indices 0..4 worst→best', () => {
    STATUS_BANDS.forEach((b, i) => expect(b.index).toBe(i));
  });
});

describe('getStatusBand — exact boundary mapping', () => {
  it('maps every published band boundary correctly', () => {
    // CRITICAL
    expect(getStatusBand(0)).toBe('CRITICAL');
    expect(getStatusBand(15)).toBe('CRITICAL');
    expect(getStatusBand(29)).toBe('CRITICAL');
    // RISK
    expect(getStatusBand(30)).toBe('RISK');
    expect(getStatusBand(40)).toBe('RISK');
    expect(getStatusBand(49)).toBe('RISK');
    // DECLINING
    expect(getStatusBand(50)).toBe('DECLINING');
    expect(getStatusBand(60)).toBe('DECLINING');
    expect(getStatusBand(69)).toBe('DECLINING');
    // STABLE
    expect(getStatusBand(70)).toBe('STABLE');
    expect(getStatusBand(78)).toBe('STABLE');
    expect(getStatusBand(84)).toBe('STABLE');
    // OPTIMAL
    expect(getStatusBand(85)).toBe('OPTIMAL');
    expect(getStatusBand(92)).toBe('OPTIMAL');
    expect(getStatusBand(100)).toBe('OPTIMAL');
  });

  it('clamps out-of-range scores to the appropriate end band', () => {
    expect(getStatusBand(-50)).toBe('CRITICAL');
    expect(getStatusBand(120)).toBe('OPTIMAL');
  });

  it('falls back to CRITICAL on non-finite input (safe-fail signal)', () => {
    // Non-finite inputs (NaN / ±Infinity) all collapse to CRITICAL so a
    // broken upstream score lights the surface red as a loud signal
    // rather than masking the failure with a calm OPTIMAL green.
    expect(getStatusBand(NaN)).toBe('CRITICAL');
    expect(getStatusBand(Infinity)).toBe('CRITICAL');
    expect(getStatusBand(-Infinity)).toBe('CRITICAL');
  });

  it('getStatusBandIndex matches the band table', () => {
    expect(getStatusBandIndex(10)).toBe(0); // CRITICAL
    expect(getStatusBandIndex(40)).toBe(1); // RISK
    expect(getStatusBandIndex(60)).toBe(2); // DECLINING
    expect(getStatusBandIndex(75)).toBe(3); // STABLE
    expect(getStatusBandIndex(95)).toBe(4); // OPTIMAL
  });
});

describe('getStatusColor — calm baseline', () => {
  it('returns brand spec hex per band', () => {
    expect(getStatusColor(95).primary).toBe('#1FA35A');  // OPTIMAL Soursop green
    expect(getStatusColor(78).primary).toBe('#3DBE7A');  // STABLE Soursop green (light tint)
    expect(getStatusColor(60).primary).toBe('#FFDE00');  // DECLINING amber
    expect(getStatusColor(40).primary).toBe('#FF8C1A');  // RISK orange
    expect(getStatusColor(15).primary).toBe('#FF2800');  // CRITICAL signal red
  });

  it('attaches band + bandIndex consistently', () => {
    const c = getStatusColor(40);
    expect(c.band).toBe('RISK');
    expect(c.bandIndex).toBe(1);
    expect(c.isPressure).toBe(false);
  });

  it('emits #RRGGBBAA glow strings with band-appropriate alpha', () => {
    // CRITICAL = tight + intense (alpha 0.70 → B3)
    expect(getStatusColor(15).glow.toUpperCase()).toBe('#FF2800B3');
    // OPTIMAL = soft + wide (alpha 0.32 → 52)
    expect(getStatusColor(95).glow.toUpperCase()).toBe('#1FA35A52');
    // DECLINING = minimal (alpha 0.20 → 33)
    expect(getStatusColor(60).glow.toUpperCase()).toBe('#FFDE0033');
  });

  it('CRITICAL uses the tightest glow radius; OPTIMAL the widest', () => {
    const critical = getStatusColor(15);
    const optimal  = getStatusColor(95);
    const declining = getStatusColor(60);
    expect(critical.glowRadius).toBeLessThan(optimal.glowRadius);
    // Spec: minimal glow for declining → smallest radius after CRITICAL
    expect(declining.glowRadius).toBeLessThan(optimal.glowRadius);
  });

  it('animationSpeed is monotonic — worse band = faster pulse', () => {
    expect(getStatusColor(95).animationSpeed).toBeLessThan(getStatusColor(78).animationSpeed);
    expect(getStatusColor(78).animationSpeed).toBeLessThan(getStatusColor(60).animationSpeed);
    expect(getStatusColor(60).animationSpeed).toBeLessThan(getStatusColor(40).animationSpeed);
    expect(getStatusColor(40).animationSpeed).toBeLessThan(getStatusColor(15).animationSpeed);
  });
});

describe('getStatusColor — Pressure Mode amplification', () => {
  it('swaps to the deeper-saturation primary per band', () => {
    expect(getStatusColor(95, { pressure: true }).primary).toBe('#17C964');
    expect(getStatusColor(78, { pressure: true }).primary).toBe('#2BAA66');
    expect(getStatusColor(60, { pressure: true }).primary).toBe('#FFC000');
    expect(getStatusColor(40, { pressure: true }).primary).toBe('#FF7A00');
    expect(getStatusColor(15, { pressure: true }).primary).toBe('#FF0040');
  });

  it('boosts glow alpha vs the calm baseline at every band', () => {
    [95, 78, 60, 40, 15].forEach((score) => {
      const calm = getStatusColor(score);
      const heat = getStatusColor(score, { pressure: true });
      expect(heat.glowAlpha).toBeGreaterThan(calm.glowAlpha);
    });
  });

  it('multiplies animationSpeed (faster voice-bar / pulse cadence)', () => {
    [95, 78, 60, 40, 15].forEach((score) => {
      const calm = getStatusColor(score);
      const heat = getStatusColor(score, { pressure: true });
      expect(heat.animationSpeed).toBeGreaterThan(calm.animationSpeed);
      // Multiplier should be roughly 1.4× (PRESSURE_SPEED_BOOST)
      expect(heat.animationSpeed / calm.animationSpeed).toBeCloseTo(1.4, 5);
    });
  });

  it('preserves the band identity (no cross-band drift in pressure)', () => {
    [10, 35, 60, 78, 95].forEach((score) => {
      expect(getStatusColor(score).band).toBe(
        getStatusColor(score, { pressure: true }).band,
      );
      expect(getStatusColor(score).bandIndex).toBe(
        getStatusColor(score, { pressure: true }).bandIndex,
      );
    });
  });

  it('flags isPressure on the result', () => {
    expect(getStatusColor(60).isPressure).toBe(false);
    expect(getStatusColor(60, { pressure: true }).isPressure).toBe(true);
  });
});

describe('Interpolation stops — wired for Reanimated', () => {
  it('exports 5 stops matching STATUS_BANDS for both calm and pressure palettes', () => {
    expect(PRIMARY_STOPS).toHaveLength(5);
    expect(PRIMARY_STOPS_PRESSURE).toHaveLength(5);
    expect(GLOW_STOPS).toHaveLength(5);
    expect(GLOW_STOPS_PRESSURE).toHaveLength(5);
    expect(BAND_INDEX_STOPS).toEqual([0, 1, 2, 3, 4]);
  });

  it('stops are ordered worst → best (index 0 = CRITICAL)', () => {
    expect(PRIMARY_STOPS[0]).toBe('#FF2800');
    expect(PRIMARY_STOPS[4]).toBe('#1FA35A');
    expect(PRIMARY_STOPS_PRESSURE[0]).toBe('#FF0040');
    expect(PRIMARY_STOPS_PRESSURE[4]).toBe('#17C964');
  });

  it('every glow stop is an 8-character #RRGGBBAA string', () => {
    GLOW_STOPS.forEach((g) => expect(g).toMatch(/^#[0-9A-F]{8}$/));
    GLOW_STOPS_PRESSURE.forEach((g) => expect(g).toMatch(/^#[0-9A-F]{8}$/));
  });
});

describe('Design-rule contract — color is a signal, not a background', () => {
  it('never returns an opaque fill — glow alphas stay under 1.0', () => {
    [10, 35, 60, 78, 95].forEach((score) => {
      const c = getStatusColor(score);
      const p = getStatusColor(score, { pressure: true });
      expect(c.glowAlpha).toBeGreaterThan(0);
      expect(c.glowAlpha).toBeLessThan(1);
      expect(p.glowAlpha).toBeGreaterThan(0);
      expect(p.glowAlpha).toBeLessThan(1);
    });
  });

  it('no two bands share a primary hex (each band is uniquely readable)', () => {
    const primaries = STATUS_BANDS.map((b) => getStatusColor(b.min).primary);
    expect(new Set(primaries).size).toBe(primaries.length);
  });
});
