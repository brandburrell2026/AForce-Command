/**
 * Foundation 1A — provider activation lock.
 *
 * NO health provider may be activated by this foundation work: every
 * `health_*` provider flag stays default OFF in BOTH flag sets (the demo set
 * may only enable the labeled demo-data overlay, never a provider). A future
 * provider-activation PR must flip its flag deliberately and update this
 * lock — it cannot happen as a side effect.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../flags';

const PROVIDER_FLAGS = [
  'healthkit_native_enabled',
  'health_apple_enabled',
  'health_whoop_enabled',
  'health_oura_enabled',
  'health_strava_enabled',
  'health_garmin_enabled',
  'health_samsung_direct_enabled',
] as const;

describe('health provider flags remain OFF (no provider activated)', () => {
  for (const flag of PROVIDER_FLAGS) {
    it(`${flag} is false in DEFAULT_FLAGS`, () => {
      expect(DEFAULT_FLAGS[flag]).toBe(false);
    });
    it(`${flag} is false even in DEMO_ALL_ON_FLAGS (demo never activates a provider)`, () => {
      expect(DEMO_ALL_ON_FLAGS[flag]).toBe(false);
    });
  }

  it('health_google_connect_enabled is ACTIVATED (founder ruling 2026-08-20, internal Android testing)', () => {
    // The deliberate provider-activation flip this lock's header anticipated.
    // The member CTA stays Platform.OS === 'android'-gated (runner.test.ts),
    // so iOS builds are behaviorally unchanged; demo remains OFF because the
    // demo profile never claims a live provider connection.
    expect(DEFAULT_FLAGS.health_google_connect_enabled).toBe(true);
    expect(DEMO_ALL_ON_FLAGS.health_google_connect_enabled).toBe(false);
  });

  it('health_demo_data_enabled stays a demo-only overlay (off by default, on in demo)', () => {
    expect(DEFAULT_FLAGS.health_demo_data_enabled).toBe(false);
    expect(DEMO_ALL_ON_FLAGS.health_demo_data_enabled).toBe(true);
  });
});
