/**
 * Sleep Mode — surviving flag lock after the flag-key prune (2026-08-27).
 *
 * `spec_sleep_v2` was RETIRED with the fifteen-twin retirement (#842):
 * SleepModeScreenLegacy is deleted and `screens/SleepModeScreen.tsx`
 * renders the redesigned SleepModeView unconditionally — the flag no
 * longer selects anything, so its three launch-flip assertions retired
 * with their subject. The independent public kill switch survives and is
 * pinned here.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_FLAGS } from '../flags';

describe('sleep mode — surviving kill switch', () => {
  it('the public kill switch stays independent and ON at launch', () => {
    // sleep_mode_enabled gates the surface's internal-preview banner (H1);
    // the redesign launch and the spec_sleep_v2 prune both left it untouched.
    expect(DEFAULT_FLAGS.sleep_mode_enabled).toBe(true);
  });
});
