/**
 * AForce — Investor Demo seed tests (Phase 10).
 *
 * Guarantees the demo is driven ONLY by hand-authored seed values (never live
 * user data) and that the six acts cleanly tile the 60-second runtime. These
 * assertions back the Score-Protection promise: the overlay can only ever
 * project these constants, so locking them locks the demo's behaviour.
 */

import { describe, expect, it } from 'vitest';

import {
  DEMO_ACT_MS,
  DEMO_PROFILE,
  type DemoActSeed,
  type DemoBand,
  type DemoScene,
} from '../demoProfile';

const VALID_SCENES: DemoScene[] = [
  'opening',
  'readiness',
  'hydroScan',
  'social',
  'territoryHeat',
  'standard',
];

const VALID_BANDS: DemoBand[] = ['PEAK', 'STABLE', 'CORRECT', 'RISK', 'CRITICAL'];

describe('demoProfile — runtime budget', () => {
  it('each act owns exactly ten seconds', () => {
    expect(DEMO_ACT_MS).toBe(10_000);
  });

  it('has exactly six acts that sum to 60 seconds', () => {
    expect(DEMO_PROFILE.acts).toHaveLength(6);
    const total = DEMO_PROFILE.acts.reduce((sum, a) => sum + a.durationMs, 0);
    expect(total).toBe(60_000);
    for (const act of DEMO_PROFILE.acts) {
      expect(act.durationMs).toBe(DEMO_ACT_MS);
    }
  });

  it('acts are 1-indexed and sequential', () => {
    expect(DEMO_PROFILE.acts.map((a: DemoActSeed) => a.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('demoProfile — seeded values only', () => {
  it('uses valid scene + band enums for every act', () => {
    for (const act of DEMO_PROFILE.acts) {
      expect(VALID_SCENES).toContain(act.scene);
      expect(VALID_BANDS).toContain(act.band);
    }
  });

  it('carries non-empty seeded brand copy', () => {
    expect(DEMO_PROFILE.brand.wordmark).toBe('AFORCE');
    expect(DEMO_PROFILE.brand.tagline.trim().length).toBeGreaterThan(0);
    expect(DEMO_PROFILE.brand.signOff.trim().length).toBeGreaterThan(0);
  });

  it('every act carries a title, caption, and a sane seeded score', () => {
    for (const act of DEMO_PROFILE.acts) {
      expect(act.title.trim().length).toBeGreaterThan(0);
      expect(act.label.trim().length).toBeGreaterThan(0);
      expect(act.score).toBeGreaterThanOrEqual(0);
      expect(act.score).toBeLessThanOrEqual(100);
    }
  });

  it('only the HydroScan act (3) carries a voice line', () => {
    for (const act of DEMO_PROFILE.acts) {
      if (act.scene === 'hydroScan') {
        expect(act.voice).toBeDefined();
        expect(act.voice?.line.trim().length).toBeGreaterThan(0);
      } else {
        expect(act.voice).toBeUndefined();
      }
    }
  });

  it('seeds the Readiness climb from depleted (14) to peak (97)', () => {
    const readiness = DEMO_PROFILE.acts.find((a) => a.scene === 'readiness');
    expect(readiness?.scoreFrom).toBe(14);
    expect(readiness?.score).toBe(97);
  });

  it('seeds the scene-specific mock data each act needs to render', () => {
    const hydroScan = DEMO_PROFILE.acts.find((a) => a.scene === 'hydroScan');
    expect(hydroScan?.sceneData?.productName).toBeTruthy();
    expect(hydroScan?.sceneData?.productVerdict).toBeTruthy();

    const social = DEMO_PROFILE.acts.find((a) => a.scene === 'social');
    expect(social?.sceneData?.bacText).toBeTruthy();

    const heat = DEMO_PROFILE.acts.find((a) => a.scene === 'territoryHeat');
    expect(heat?.sceneData?.heatStatus).toBeTruthy();
    expect(heat?.sceneData?.heatDetail).toBeTruthy();
    expect(heat?.sceneData?.territoryLabel).toBeTruthy();
  });
});
