/**
 * Wave-2 PR4 truth locks: production cannot consume demo/mock Protocol
 * values.
 *
 * 1. `services/mockApi.ts` no longer exists, and NO production source
 *    imports it (the module graph is scanned, not assumed).
 * 2. `deriveProtocol` carries no fabricated compliance default — the
 *    parameter is required + nullable, and null passes through as null.
 * 3. No fabricated constants or randomized values remain in the
 *    protocol derivation module.
 * 4. Both Protocol consumers guard the compliance render on real data
 *    (source-lock, same pattern as sensorImportIntegrity/phantomSipGate).
 * 5. The real derivation matches the Journal Consistency KPI rule and
 *    returns null (never a number) with no data.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// The hook's realApi import transitively pulls the RN module graph
// (__DEV__, asset requires) — stub it; the pure derivation under test
// never touches the network.
vi.mock('@/services/realApi', () => ({ fetchJournalRollups: vi.fn() }));

import { computeWeeklyCompliancePct } from '../../hooks/useWeeklyCompliance';
import type { JournalRollup } from '../../types';

const ROOT = resolve(__dirname, '../..');
const PROD_DIRS = ['app', 'components', 'screens', 'services', 'store', 'hooks', 'utils'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(p);
    }
  }
  return out;
}

describe('protocol data truth (Wave-2 PR4)', () => {
  it('services/mockApi.ts is gone and nothing in production imports it', () => {
    expect(existsSync(join(ROOT, 'services/mockApi.ts'))).toBe(false);
    const offenders: string[] = [];
    for (const dir of PROD_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const src = readFileSync(file, 'utf8');
        if (/from ['"][^'"]*mockApi['"]/.test(src)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the derivation module contains no fabricated compliance and no randomness', () => {
    const src = readFileSync(join(ROOT, 'services/protocolDerivation.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/weeklyCompliancePct\s*=\s*\d/);
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/simulateLatency/);
    expect(src).toMatch(/weeklyCompliancePct:\s*number \| null/);
  });

  it('both Protocol consumers null-guard the compliance render and source it from the real hook', () => {
    const v2 = readFileSync(join(ROOT, 'components/protocol/ProtocolScreenV2.tsx'), 'utf8');
    expect(v2).toContain("from '@/hooks/useWeeklyCompliance'");
    expect(v2).toContain('useWeeklyCompliance(');
    // every compliance render site is guarded
    const renders = v2.match(/protocol\.weeklyCompliancePct/g) ?? [];
    const guards = v2.match(/protocol\.weeklyCompliancePct != null/g) ?? [];
    expect(renders.length).toBeGreaterThan(0);
    expect(guards.length * 2).toBe(renders.length); // each guard precedes exactly one render
    // honest fallback line exists for the null case
    expect(v2).toContain('why_adaptive');

    const legacy = readFileSync(join(ROOT, 'app/(tabs)/protocol.tsx'), 'utf8');
    expect(legacy).toContain('deriveProtocol(userState, engineOutput, null)');
    expect(legacy).toContain("protocol.weeklyCompliancePct != null");
  });

  it('deriveProtocol passes null through as null (no resurrection of a number)', async () => {
    vi.doMock('../../utils/scoringEngine', () => ({ calculateScore: () => ({}) }));
    const { deriveProtocol } = await import('../protocolDerivation');
    const userState = {
      unitsConsumedToday: 0,
      dailyTarget: 8,
      urineSignal: 0,
    } as never;
    const engineOutput = {
      performanceState: { level: 'BALANCED' },
      riskTimer: { minutes: 45 },
    } as never;
    expect(deriveProtocol(userState, engineOutput, null).weeklyCompliancePct).toBeNull();
    expect(deriveProtocol(userState, engineOutput, 71).weeklyCompliancePct).toBe(71);
    // runtime callers that somehow bypass TS still get null, never a number
    expect(
      (deriveProtocol as unknown as (a: unknown, b: unknown) => { weeklyCompliancePct: unknown })(
        userState,
        engineOutput,
      ).weeklyCompliancePct,
    ).toBeNull();
  });

  it('real compliance derivation: Journal KPI rule, and null (not 0) when no data', () => {
    const day = (avgScore: number, snapshotsCount = 4): JournalRollup =>
      ({ date: '2026-08-01', snapshotsCount, avgScore, minScore: 0 } as unknown as JournalRollup);
    expect(computeWeeklyCompliancePct([])).toBeNull();
    expect(computeWeeklyCompliancePct([day(80), day(70), day(50)])).toBe(67);
    expect(computeWeeklyCompliancePct([day(64.9)])).toBe(0);
    expect(computeWeeklyCompliancePct([day(65)])).toBe(100);
    // a day with zero snapshots never counts as compliant
    expect(computeWeeklyCompliancePct([day(90, 0)])).toBe(0);
  });
});
