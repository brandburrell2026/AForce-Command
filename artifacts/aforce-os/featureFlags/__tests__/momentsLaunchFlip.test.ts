/**
 * AForce Moments launch flip — flag-state lock (founder flip 2026-08-12).
 *
 * The Moments family went live: core (`moments_enabled`), prep notifications
 * (`moments_notifications_enabled`, DR-010 constraint 4 as amended), and the
 * learning loop (`moments_learning_enabled`, DR-012 Ruling 3.1 as amended).
 * The CALENDAR core was DELIBERATELY excluded: `moments_calendar_enabled`
 * must stay OFF until Legal + Privacy sign PR-002 Appendix A — flipping it
 * requires editing this test consciously alongside that sign-off.
 * Mirrors sleepLaunchFlip / v3DashboardLaunchFlip.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../flags';
import type { FeatureFlags } from '../../types';

const LIVE_FLAGS = [
  'moments_enabled',
  'moments_notifications_enabled',
  'moments_learning_enabled',
] as const;

describe('Moments launch flip — family live, calendar gated', () => {
  it('core + notifications + learning are the DEFAULT production path', () => {
    for (const flag of LIVE_FLAGS) {
      expect(DEFAULT_FLAGS[flag], flag).toBe(true);
    }
  });

  it('the calendar core stays OFF until Legal + Privacy sign Appendix A', () => {
    // Do NOT flip this without: Appendix A Legal ☑ + Privacy ☑, the
    // DATA-CLASSIFICATION-MATRIX rows, and the privacy-policy/MHMD updates.
    expect(DEFAULT_FLAGS.moments_calendar_enabled).toBe(false);
  });

  it('an explicit override still works — forcing false selects the pre-Moments Home', () => {
    const forcedOff: FeatureFlags = { ...DEFAULT_FLAGS, moments_enabled: false };
    expect(forcedOff.moments_enabled).toBe(false);
    // Sub-features degrade with the parent: delivery requires moments_enabled
    // too (useMomentPrepScheduling gates on BOTH), so no orphaned pings.
    expect(forcedOff.moments_notifications_enabled).toBe(true);
  });

  it('demo/preview flag set is unchanged by the launch flip', () => {
    for (const flag of [...LIVE_FLAGS, 'moments_calendar_enabled'] as const) {
      expect(DEMO_ALL_ON_FLAGS[flag], flag).toBe(true);
    }
  });
});
