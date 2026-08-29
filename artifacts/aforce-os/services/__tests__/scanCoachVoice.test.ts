// CONSCIOUS REPIN (founder P0 containment, 2026-08-29): scanCoachVoice no
// longer AUTHORS dose/clock closes ("Take 1 with 16 ounces water and
// recheck in 20 minutes") — every case mirrors the already-contained
// result.recommendation.command VERBATIM. Fixture commands below use the
// real contained strings the scan service produces post-#873; the old
// dose-copy pins retire with the behavior they pinned. The class ban
// lives in services/__tests__/commandAuthorityContainment.test.ts.
import { describe, it, expect } from 'vitest';
import { buildScanCoachScript } from '../scanCoachVoice';
import type { ScanResult, ScannedProduct } from '../../types/scan';
import type { CompareProduct } from '../../types/comparison';

const baseScanned = (over: Partial<ScannedProduct> = {}): ScannedProduct => ({
  productId: 'gatorade',
  productName: 'Gatorade',
  brand: 'Gatorade',
  category: 'sports_drink',
  hydrationSpeed: 60,
  electrolyteDensity: 50,
  sugarLevel: 78,
  stimulantLevel: 0,
  recoveryFit: 55,
  performanceFit: 50,
  isAForce: false,
  ...over,
});

const aforceProduct: CompareProduct = {
  id: 'aforce_stick',
  name: 'AForce Stick',
  brand: 'AForce',
  category: 'electrolyte_mix',
  hydrationSpeed: 95,
  electrolytes: 90,
  sugar: 10,
  absorptionRate: 92,
  recoveryEfficiency: 94,
  compatibleProtocols: ['maintenance', 'recovery', 'depletion_correction'],
  factualNote: 'Test',
  isAForce: true,
};

const scannedAforceProduct: ScannedProduct = {
  productId: 'aforce_stick',
  productName: 'AForce Stick',
  brand: 'AForce',
  category: 'electrolyte_mix',
  hydrationSpeed: 95,
  electrolyteDensity: 90,
  sugarLevel: 10,
  stimulantLevel: 0,
  recoveryFit: 94,
  performanceFit: 92,
  isAForce: true,
  fluidType: 'aforce_stick',
};

const baseResult = (over: Partial<ScanResult> = {}): ScanResult => ({
  scannedAt: '2026-05-02T12:00:00Z',
  source: { kind: 'barcode', rawValue: '0052000124407' },
  product: baseScanned(),
  currentFitScore: 38,
  verdict: 'suboptimal',
  evaluatedAgainstState: 'DEPLETED',
  recommendation: {
    headline: 'Sub-par',
    detail: 'High sugar load',
    aforceEquivalentId: 'aforce_stick',
    command: 'Switch to AForce Stick — water first.',
    shouldLog: false,
  },
  efficiency: 0.43,
  efficiencyLabel: 'Hydrates at 43% efficiency',
  ...over,
});

describe('buildScanCoachScript', () => {
  it('CASE A: scanned IS AForce + optimal → lock-in narrative, no bullets', () => {
    const result = baseResult({
      product: scannedAforceProduct,
      currentFitScore: 92,
      verdict: 'optimal',
      evaluatedAgainstState: 'PEAK',
      efficiency: 0.94,
      recommendation: {
        headline: 'Optimal',
        detail: 'Locked in',
        command: 'Pair with water — your current command sets the amount.',
        shouldLog: true,
      },
    });
    const script = buildScanCoachScript(result, aforceProduct);
    expect(script.hasComparison).toBe(false);
    expect(script.bullets).toHaveLength(0);
    expect(script.headline).toContain('AForce Stick');
    expect(script.headline).toContain('Peak state');
    expect(script.transcript).toContain('strong match — stay with it');
    expect(script.transcript).not.toContain('Fit score');
    expect(script.transcript).not.toMatch(/\d+%\s+efficiency/);
    expect(
      script.transcript.endsWith('Pair with water — your current command sets the amount.'),
    ).toBe(true); // mirrors the contained on-screen line verbatim
  });

  it('CASE B: AForce equivalent stronger → comparison narrative + 4 bullets', () => {
    const result = baseResult();
    const script = buildScanCoachScript(result, aforceProduct);
    expect(script.hasComparison).toBe(true);
    expect(script.bullets).toHaveLength(4);
    expect(script.headline).toContain('AForce Stick');
    expect(script.headline).toContain('Gatorade');
    // Electrolyte advantage = 90-50 = 40
    expect(script.transcript).toContain('40 points stronger on electrolytes');
    // Sugar advantage = 78-10 = 68
    expect(script.transcript).toContain('68 points lower on sugar');
    expect(
      script.transcript.endsWith('Switch to AForce Stick — water first.'),
    ).toBe(true); // mirrors — the coach may not amplify commerce into a dose
    expect(script.transcript).toContain('Depleted state');
  });

  it('CASE B bullets identify per-metric winners correctly', () => {
    const result = baseResult();
    const script = buildScanCoachScript(result, aforceProduct);
    const byLabel = Object.fromEntries(script.bullets.map((b) => [b.label, b]));
    expect(byLabel['Electrolytes'].winner).toBe('aforce');     // 90 > 50
    expect(byLabel['Sugar load'].winner).toBe('aforce');       // 10 < 78 (lower wins)
    expect(byLabel['Uptake speed'].winner).toBe('aforce');     // 95 > 60
    expect(byLabel['Recovery fit'].winner).toBe('aforce');     // 94 > 55
    expect(byLabel['Electrolytes'].scanned).toBe('50/100');
    expect(byLabel['Electrolytes'].aforce).toBe('90/100');
  });

  it('CASE B with non-suboptimal scanned uses softer opener ("stronger option")', () => {
    const result = baseResult({
      verdict: 'acceptable',
      currentFitScore: 70,
      efficiency: 0.6,
    });
    const script = buildScanCoachScript(result, aforceProduct);
    expect(script.transcript).toContain('but there\'s a stronger option');
    expect(script.transcript).not.toContain('not optimal');
  });

  it('CASE C: acceptable scanned + no AForce equivalent → fits-as-is narrative', () => {
    const lmnt: ScannedProduct = baseScanned({
      productId: 'lmnt',
      productName: 'LMNT',
      brand: 'LMNT',
      category: 'electrolyte_mix',
      hydrationSpeed: 82,
      electrolyteDensity: 92,
      sugarLevel: 5,
      recoveryFit: 78,
    });
    const result = baseResult({
      product: lmnt,
      currentFitScore: 78,
      verdict: 'strong',
      efficiency: 0.78,
      recommendation: {
        headline: 'LMNT fits',
        detail: 'Strong fit',
        command: 'Pair with water — your current command sets the amount.',
        shouldLog: true,
      },
    });
    const script = buildScanCoachScript(result); // no aforceEquivalent passed
    expect(script.hasComparison).toBe(false);
    expect(script.bullets).toHaveLength(0);
    expect(script.headline).toContain('LMNT fits');
    expect(script.transcript).toContain('A solid choice right now');
    expect(script.transcript).not.toMatch(/\d+ fit, \d+%/);
    expect(
      script.transcript.endsWith('Pair with water — your current command sets the amount.'),
    ).toBe(true); // mirrors the contained on-screen line verbatim
  });

  it('CASE D: sub-par scanned, no AForce uplift → water-only fallback', () => {
    const result = baseResult({
      verdict: 'avoid',
      currentFitScore: 22,
      efficiency: 0.3,
      recommendation: {
        headline: 'Avoid',
        detail: 'High sugar',
        command: 'Water first — your current command sets the amount.',
        shouldLog: false,
      },
    });
    const script = buildScanCoachScript(result); // no aforceEquivalent passed
    expect(script.hasComparison).toBe(false);
    expect(script.bullets).toHaveLength(0);
    expect(script.headline).toContain('not optimal');
    expect(script.transcript).toContain('Water alone is the safer move here');
    expect(script.transcript).not.toContain('Fit score');
    expect(
      script.transcript.endsWith('Water first — your current command sets the amount.'),
    ).toBe(true); // mirrors the contained water-only line verbatim
  });

  it('CASE D′: sub-par scanned WITH unresolved aforceEquivalentId → mentions AForce, mirrors recommendation command', () => {
    // hydrationScanService.buildRecommendation Case 4 sets aforceEquivalentId
    // even when we can't load full nutrition data (e.g. dynamic OFF entry).
    // The narrative must stay in sync with the on-screen AForceReplacementCard.
    const result = baseResult({
      verdict: 'avoid',
      currentFitScore: 22,
      efficiency: 0.3,
      recommendation: {
        headline: 'Sub-par',
        detail: 'High sugar',
        aforceEquivalentId: 'aforce_stick',
        command: 'Switch to AForce Stick — water first.',
        shouldLog: false,
      },
    });
    const script = buildScanCoachScript(result); // aforceEquivalent UNRESOLVED
    expect(script.hasComparison).toBe(false);
    expect(script.bullets).toHaveLength(0);
    expect(script.headline).toContain('switch to AForce');
    expect(script.transcript).toContain('not optimal');
    expect(
      script.transcript.endsWith('Switch to AForce Stick — water first.'),
    ).toBe(true); // mirrors the on-screen AForceReplacementCard line verbatim
  });

  it('treats same-id "equivalent" as no-comparison (does not loop on itself)', () => {
    // Edge case: bestAforceFor returns the scanned product itself
    const result = baseResult({
      product: scannedAforceProduct,
      currentFitScore: 65,
      verdict: 'acceptable',
      efficiency: 0.7,
    });
    const script = buildScanCoachScript(result, aforceProduct);
    expect(script.hasComparison).toBe(false);
    expect(script.bullets).toHaveLength(0);
  });

  it('falls back to "cleaner overall profile" wording when no clear delta', () => {
    // Scanned product matches AForce on every axis → no specific advantage
    const matched: ScannedProduct = baseScanned({
      productId: 'tied',
      productName: 'Tied Brand',
      brand: 'Tied',
      hydrationSpeed: 95,
      electrolyteDensity: 90,
      sugarLevel: 10,
      recoveryFit: 94,
    });
    const result = baseResult({
      product: matched,
      verdict: 'suboptimal',
      currentFitScore: 40,
    });
    const script = buildScanCoachScript(result, aforceProduct);
    expect(script.transcript).toContain('cleaner overall profile');
  });

  it('script transcript stays within ≤3 sentences for every case', () => {
    const cases: ScanResult[] = [
      baseResult({ product: scannedAforceProduct, verdict: 'optimal' }),
      baseResult(),
      baseResult({ verdict: 'strong', currentFitScore: 80 }),
      baseResult({ verdict: 'avoid' }),
    ];
    for (const c of cases) {
      const equiv = c.recommendation.aforceEquivalentId ? aforceProduct : undefined;
      const script = buildScanCoachScript(c, equiv);
      const sentences = script.transcript
        .split(/\.(?:\s+|$)/)
        .filter((s) => s.trim().length > 0);
      expect(sentences.length).toBeLessThanOrEqual(3);
    }
  });
});
