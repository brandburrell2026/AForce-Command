/**
 * Drive-scale consumer INVENTORY LOCK (COR-001 close-out, founder-authorized
 * "fix/wrong-scale-normalization").
 *
 * The store drives (`heatLoad`, `sweatRate`, `activityLevel`) are the
 * canonical 0–10 scale. History: six consumers silently reinterpreted them
 * as 0–1 or 0–100 — fabricating heat stress on some surfaces and pinning
 * heat/pressure signals low on others, simultaneously.
 *
 * THE RULE: every production file that reads `.heatLoad` or `.sweatRate`
 * must appear below, consciously classified. A NEW consumer must either
 * (a) convert through `fraction01FromScale10` — the ONLY sanctioned bridge
 * (never a hand-rolled /10, clamp01, or a fresh utility) — and be listed
 * as 'bridged', or (b) genuinely operate on the raw 0–10 axis and be
 * listed as 'scale10-aware' with a reason. Failing this test means you
 * added a drive read without deciding its scale — decide it here, in
 * writing, before shipping.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const AOS_ROOT = join(__dirname, '..', '..');
const SCAN_ROOTS = ['services', 'components', 'hooks', 'utils', 'app', 'store', 'screens'];
const DRIVE_READ = /\.(heatLoad|sweatRate)\b/;

type Classification =
  | 'bridged'            // converts via fraction01FromScale10 (file must contain it)
  | 'scale10-aware'      // consumes the raw 0–10 axis correctly, on purpose
  | 'comment-only'       // the regex hit is prose, not code
  | 'defective-orphan';  // known-wrong, zero importers, pending retirement

const INVENTORY: Record<string, { cls: Classification; why: string }> = {
  // ── Fixed in this PR — the six audited consumers ──────────────────────────
  'services/comparisonEngine.ts': {
    cls: 'bridged',
    why: 'inferInputs bridges onto the 0–1 CompareInputs axis (default no longer heat_stress)',
  },
  'services/hydrationScanService.ts': {
    cls: 'bridged',
    why: 'heat01 bridged per hydrationImpact’s documented 0..1 environment contract',
  },
  'services/recoveryEngine.ts': {
    cls: 'bridged',
    why: 'recoveryInputsFromState maps onto the engine’s documented 0–100 axis (×100 after bridge)',
  },
  'components/home/HomeScreenV2.tsx': {
    cls: 'bridged',
    why: 'heat tile bridges then bands on the 0–100 axis; 60/30 thresholds unchanged',
  },
  // NOTE deliberately absent: hooks/useHeatGuard.ts — after this PR it no
  // longer reads .heatLoad/.sweatRate AT ALL (measured weather + a bridged
  // activityIntensity only). If a drive read is ever reintroduced there,
  // this lock fires and forces a fresh classification.
  'services/biometricIntelligence.ts': {
    cls: 'bridged',
    why: 'deriveSweatLoss (since #845) and deriveRecoveryLoad (this PR) both bridge',
  },
  // ── Correct raw 0–10 consumers (verified in the 2026-08-28 audit) ─────────
  'services/realApi.ts': {
    cls: 'scale10-aware',
    why: 'serializes/defaults the fields (4/3/5) and thresholds on the raw axis (heatLoad >= 6)',
  },
  'services/socialModeEngine.ts': {
    cls: 'scale10-aware',
    why: 'passes heatLoad into hangoverRisk, whose thresholds are 0–10-aware',
  },
  'utils/hangoverRisk.ts': {
    cls: 'scale10-aware',
    why: '0–10-aware thresholds by design (audited correct)',
  },
  'utils/depletionRate.ts': {
    cls: 'scale10-aware',
    why: 'heatLoadToTempC clamps 0–10 → calibrated 20–32 °C weather FALLBACK; real OpenWeather always overrides (flagged for founder invariant review as a drive→temperature estimate)',
  },
  'utils/personalizationSignals.ts': {
    cls: 'scale10-aware',
    why: '0–10-aware thresholds by design (audited correct)',
  },
  'utils/scoring/breakdown.ts': {
    cls: 'scale10-aware',
    why: 'canonical score breakdown consumes the raw axis by design (audited correct)',
  },
  'utils/scoring/copy.ts': {
    cls: 'scale10-aware',
    why: 'canonical copy generator consumes the raw axis by design (audited correct)',
  },
  'utils/impact/hydrationImpact.ts': {
    cls: 'scale10-aware',
    why: 'defines the contracts: environment.heat01 is 0..1 (callers bridge), profile.activityLevel is 0..10',
  },
  'services/useRecoverySnapshot.ts': {
    cls: 'scale10-aware',
    why: 'reads already-normalized RecoveryInputs fields only for memo deps',
  },
  'app/guardian.tsx': {
    cls: 'scale10-aware',
    why: 'passes sweatRate into guardianRiskScore’s DEAD parameter (never read — zero numeric effect); flag-gated demo screen; residual noted in the PR',
  },
  'services/sweatRateEngine.ts': {
    cls: 'comment-only',
    why: 'the regex hit is prose (“setting state.sweatRate if desired”); engine inputs are explicit args',
  },
  // ── Known-defective orphan (documented, NOT blessed) ──────────────────────
  'services/videoEngine.ts': {
    cls: 'defective-orphan',
    why: '0–1 thresholds on the 0–10 fields; ZERO importers (legacy-Home orphan tree); slated for orphan retirement, not fixed here to keep this PR to live/authorized surfaces',
  },
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.|\.node-stub\./.test(name)) out.push(full);
  }
  return out;
}

describe('drive-scale consumer inventory (0–10 is the canonical axis)', () => {
  const readers: string[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of walk(join(AOS_ROOT, root))) {
      const src = readFileSync(file, 'utf8');
      if (DRIVE_READ.test(src)) readers.push(relative(AOS_ROOT, file));
    }
  }

  it('every drive reader is consciously classified (add yours to the INVENTORY with a scale decision)', () => {
    const unclassified = readers.filter((f) => !(f in INVENTORY));
    expect(
      unclassified,
      `New file(s) read .heatLoad/.sweatRate without a scale classification. ` +
      `These fields are 0–10 (realApi defaults 4/3). Either bridge through ` +
      `fraction01FromScale10 and list as 'bridged', or consume the raw axis ` +
      `deliberately and list as 'scale10-aware' with a reason: ${unclassified.join(', ')}`,
    ).toEqual([]);
  });

  it('no stale inventory entries (deleted/renamed files leave the list)', () => {
    const stale = Object.keys(INVENTORY).filter((f) => !readers.includes(f));
    expect(stale, `Inventory entries no longer read drives: ${stale.join(', ')}`).toEqual([]);
  });

  it("every 'bridged' file actually imports the one sanctioned bridge", () => {
    for (const [file, meta] of Object.entries(INVENTORY)) {
      if (meta.cls !== 'bridged') continue;
      const src = readFileSync(join(AOS_ROOT, file), 'utf8');
      expect(src, `${file} is classified 'bridged' but does not use fraction01FromScale10`).toContain(
        'fraction01FromScale10',
      );
    }
  });

  it('no consumer hand-rolls the conversion (single sanctioned bridge)', () => {
    for (const file of readers) {
      if (INVENTORY[file]?.cls === 'defective-orphan') continue; // documented, pending deletion
      const src = readFileSync(join(AOS_ROOT, file), 'utf8');
      // A `/ 10` adjacent to a drive read is the hand-rolled-bridge smell.
      const handRolled = /\.(heatLoad|sweatRate)[^;\n]{0,20}\/\s*10\b/.test(src);
      expect(handRolled, `${file} divides a drive by 10 inline — use fraction01FromScale10`).toBe(false);
    }
  });
});
