/**
 * S2-14b — P0 truth: the Sweat "LIVE" snapshot can never present an
 * unqualified value as LIVE.
 *
 * THE REPRODUCED CONDITION (S2-14b device matrix, founder-escalated):
 * a member whose profile came through realApi's defaults —
 * `sweatRate ?? 3`, `activityLevel ?? 5`, `heatLoad ?? 4` (all 0-10 scale)
 * — rendered "600 oz projected / 30,000 mg sodium / Extreme" under the
 * "SWEAT LOSS · LIVE" eyebrow.
 *
 * ROOT CAUSE (now FIXED): `deriveSweatLoss` assumed 0-1 normalized
 * inputs and `clamp01`d them, so every 0-10-scale store value saturated
 * to 1.0 → drive = 1.0 → the 600 oz / 30,000 mg ceiling rendered as a
 * genuine computation for the entire default-profile population.
 * COR-001 close-out (founder-approved with the typed quantities layer):
 * the inputs now normalize through `fraction01FromScale10` — the
 * saturation is dead (its death certificate lives in
 * quantitiesCor001.test.ts), and this suite pins the corrected
 * derivation PLUS the S1-2 qualifier that still fronts every number.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  deriveSweatLoss,
  qualifySweatLossEstimate,
} from '../biometricIntelligence';
import type { UserState } from '../../types';

const asUser = (u: Partial<UserState>): UserState => u as unknown as UserState;

/** realApi.ts defaults verbatim: sweatRate ?? 3, activityLevel ?? 5, heatLoad ?? 4. */
const REAL_API_DEFAULT_USER = asUser({
  sweatRate: 3,
  activityLevel: 5,
  heatLoad: 4,
  ozConsumedToday: 45,
});

describe('S2-14b — the reproduced 600 oz / 30,000 mg LIVE-card condition', () => {
  it('realApi-default profile values derive the NORMALIZED projection — the ceiling is gone', () => {
    const est = deriveSweatLoss(REAL_API_DEFAULT_USER);
    // 3/5/4 on the 0-10 scale -> 0.3/0.5/0.4 -> drive 0.4 -> 240 oz.
    expect(est.fluidLossOz).toBe(240);
    expect(est.sodiumLossMg).toBe(12000);
    expect(est.intensity).toBe('moderate');
    expect(est.efficiencyPct).toBe(19); // 45 / 240
    expect(est.confidence).toBe('high');
    // The observed-bug numbers can no longer be produced from these inputs.
    expect(est.fluidLossOz).not.toBe(600);
    expect(est.intensity).not.toBe('extreme');
  });

  it('without a member-set body weight the projection is unverifiable — honest unavailable, never LIVE', () => {
    const est = deriveSweatLoss(REAL_API_DEFAULT_USER);
    const q = qualifySweatLossEstimate(est, null);
    expect(q.status).toBe('unavailable');
    expect(q.reasons).toContain('deficit_unverifiable_no_weight');
  });

  it('with a weight on file the S1-2 deficit boundary rejects the saturated projection outright', () => {
    const est = deriveSweatLoss(REAL_API_DEFAULT_USER);
    // 240 oz = 7.1 L =~ 7.1 kg against a 200 lb (90.7 kg) member: ~7.8%
    // of body mass — still past S1-2's 7% boundary, so even the corrected
    // default-profile projection may not present as authoritative.
    const q = qualifySweatLossEstimate(est, 200);
    expect(q.status).toBe('unavailable');
    expect(q.reasons).toContain('deficit_implausible');
  });

  it("a plausible projection is still at most 'limited' — a 12-hour model window is never a calibrated LIVE reading (S1-2 duration rule)", () => {
    // Small 0-10-scale inputs (1 / 0.5 / 0 -> 0.1 / 0.05 / 0 normalized)
    // -> a modest 36 oz / day projection.
    const est = deriveSweatLoss(asUser({ sweatRate: 1, activityLevel: 0.5, heatLoad: 0, ozConsumedToday: 20 }));
    expect(est.fluidLossOz).toBeLessThan(50);
    const q = qualifySweatLossEstimate(est, 200);
    expect(q.status).toBe('limited');
    expect(q.reasons).toContain('long_duration_estimate');
  });

  it('the drive inputs pass through the one sanctioned scale bridge — clamp01 saturation is dead here', () => {
    const src = readFileSync(resolve(__dirname, '..', 'biometricIntelligence.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(src).toContain('fraction01FromScale10(user.sweatRate ?? 0)');
    expect(src).not.toMatch(/clamp01\(user\./);
  });

  it('the qualifier is a seam over S1-2, not a parallel authority — no local thresholds', () => {
    const src = readFileSync(resolve(__dirname, '..', 'biometricIntelligence.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const fn = src.slice(src.indexOf('export function qualifySweatLossEstimate'));
    expect(fn).toContain('qualifySweat({');
    // The only numeric literals the seam may own are unit conversions.
    expect(fn).not.toMatch(/PROPOSED_|2\.5|3\.5|(?<!\.)\b7\b(?!2)/);
  });
});

describe('S2-14b — the snapshot card presents only what qualifies (mechanism lock)', () => {
  const kit = readFileSync(
    resolve(__dirname, '..', '..', 'components', 'sweat', 'sweatKit.tsx'),
    'utf8',
  )
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const snapshot = kit.slice(
    kit.indexOf('export function SweatLossSnapshot'),
    kit.indexOf('export function num('),
  );

  it('the card derives its posture from qualifySweatLossEstimate over the member weight', () => {
    expect(snapshot).toContain('qualifySweatLossEstimate(snap, profileIdentity.bodyWeightLbs)');
  });

  it("the LIVE eyebrow renders ONLY when the qualification is 'ok'", () => {
    expect(snapshot).toMatch(
      /qualification\.status === 'ok' \? t\('sweat\.v2\.snap_eyebrow'\) : t\('sweat\.v2\.snap_eyebrow_unqualified'\)/,
    );
  });

  it("'unavailable' renders the honest no-reading state — no numbers, no LIVE", () => {
    const unavailable = snapshot.slice(
      snapshot.indexOf("qualification.status === 'unavailable'"),
      snapshot.indexOf('const accent'),
    );
    expect(unavailable).toContain("t('sweat.v2.snap_eyebrow_unqualified')");
    expect(unavailable).toContain("t('sweat.v2.snap_unavailable_body')");
    expect(unavailable).not.toContain('snap.fluidLossOz');
    expect(unavailable).not.toContain('snap.sodiumLossMg');
  });

  it('every locale carries the two honest-state keys', () => {
    for (const loc of ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'hi', 'ar']) {
      const d = JSON.parse(
        readFileSync(resolve(__dirname, '..', '..', 'locales', `${loc}.json`), 'utf8'),
      ) as { sweat: { v2: Record<string, string> } };
      expect(d.sweat.v2.snap_eyebrow_unqualified, loc).toBeTruthy();
      expect(d.sweat.v2.snap_unavailable_body, loc).toBeTruthy();
    }
  });
});
