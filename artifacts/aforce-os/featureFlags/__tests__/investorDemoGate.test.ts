/**
 * AForce — Investor Demo gating tests (Phase 10).
 *
 * The 60-second cinematic overlay is reachable ONLY when `demo_mode_enabled`
 * is on. These tests lock the production-safe defaults and the fail-closed
 * behaviour of `shouldShowInvestorDemo`, so a future flag refactor can never
 * silently expose the demo in a shipped build.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FLAGS,
  DEMO_ALL_ON_FLAGS,
  shouldShowInvestorDemo,
} from '../flags';
import type { FeatureFlags } from '../../types';

describe('investor demo — flag defaults', () => {
  it('is OFF in the production default flag set', () => {
    expect(DEFAULT_FLAGS.demo_mode_enabled).toBe(false);
  });

  it('is ON in the demo / preview "all on" flag set', () => {
    expect(DEMO_ALL_ON_FLAGS.demo_mode_enabled).toBe(true);
  });
});

describe('shouldShowInvestorDemo — gating logic', () => {
  it('shows only when the flag is ON and the demo is active', () => {
    expect(shouldShowInvestorDemo(DEMO_ALL_ON_FLAGS, true)).toBe(true);
  });

  it('stays hidden when the demo is not active, even with the flag ON', () => {
    expect(shouldShowInvestorDemo(DEMO_ALL_ON_FLAGS, false)).toBe(false);
  });

  it('stays hidden in production defaults, even when active (fail-closed)', () => {
    expect(shouldShowInvestorDemo(DEFAULT_FLAGS, true)).toBe(false);
  });

  it('fails closed when the flag is missing / undefined', () => {
    const noFlag = { ...DEFAULT_FLAGS } as Partial<FeatureFlags>;
    delete noFlag.demo_mode_enabled;
    expect(shouldShowInvestorDemo(noFlag as FeatureFlags, true)).toBe(false);
  });
});

describe('performance memory execution — flag defaults', () => {
  it('is OFF in the production default flag set (flag-off = no-op surface)', () => {
    expect(DEFAULT_FLAGS.performance_memory_execution_enabled).toBe(false);
  });

  it('is ON in the demo / preview "all on" flag set', () => {
    expect(DEMO_ALL_ON_FLAGS.performance_memory_execution_enabled).toBe(true);
  });
});
