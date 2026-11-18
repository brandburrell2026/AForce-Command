/**
 * Stop-ship RA-N4 (founder decision 2026-11-18): Cruise Mode is OFF in a
 * production build and ON only where a build grants it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../flags';
import {
  applyInternalTestflightOverlay,
  CRUISE_INTERNAL_TESTFLIGHT_OVERLAY_FLAGS,
} from '../internalTestflightOverlay';

const CRUISE_SUB_FLAGS = [
  'cruise_journey_pulse_enabled',
  'cruise_commerce_enabled',
  'cruise_inventory_enabled',
  'cruise_stateroom_delivery_enabled',
  'cruise_pre_port_enabled',
  'cruise_excursion_readiness_enabled',
] as const;

describe('Cruise Mode by build', () => {
  it('production defaults ship the master switch and every sub-feature OFF', () => {
    expect(DEFAULT_FLAGS.cruise_mode_enabled).toBe(false);
    for (const key of CRUISE_SUB_FLAGS) expect(DEFAULT_FLAGS[key], key).toBe(false);
  });

  it('a production build (overlay not engaged) keeps it OFF', () => {
    expect(applyInternalTestflightOverlay(DEFAULT_FLAGS, false).cruise_mode_enabled).toBe(false);
  });

  it('internal TestFlight grants the master switch only', () => {
    expect([...CRUISE_INTERNAL_TESTFLIGHT_OVERLAY_FLAGS]).toEqual(['cruise_mode_enabled']);
    const internal = applyInternalTestflightOverlay(DEFAULT_FLAGS, true);
    expect(internal.cruise_mode_enabled).toBe(true);
    for (const key of CRUISE_SUB_FLAGS) expect(internal[key], key).toBe(false);
  });

  it('the demo build still presents Cruise', () => {
    expect(DEMO_ALL_ON_FLAGS.cruise_mode_enabled).toBe(true);
  });

  it('the Profile row is rendered only when the flag is on', () => {
    const src = readFileSync(
      resolve(__dirname, '..', '..', 'components/profile/panes/PerformancePane.tsx'),
      'utf8',
    );
    const gate = src.indexOf('{flags.cruise_mode_enabled ? (');
    const link = src.indexOf('testID="profile-cruise-link"');
    expect(gate).toBeGreaterThan(-1);
    expect(link).toBeGreaterThan(gate);
    expect(link - gate).toBeLessThan(400);
  });
});
