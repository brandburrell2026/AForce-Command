/**
 * HydroState model-version parity guard (D-08 / DR-009).
 *
 * The server keeps a hand-maintained mirror of the app's authoritative
 * `HYDROSTATE_MODEL_VERSION` because `api-server` / `lib/db` deliberately never
 * import from the app package. If the two ever drift, snapshots would be
 * stamped with a version that does not correspond to the scoring math that
 * produced them — silently corrupting the audit trail the field exists to
 * provide.
 *
 * Founder Decision 1 (`DR-009`) requires a SINGLE authoritative value. This
 * test is what makes "single" true across the package boundary.
 *
 * Follows the precedent in `subscriptionPlanParity.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { HYDROSTATE_MODEL_VERSION as SERVER_MIRROR } from '../hydroStateModelVersion';
import { HYDROSTATE_MODEL_VERSION as APP_CANONICAL } from '../../../../aforce-os/config/hydroStateModel';

describe('HydroState model-version parity (server mirror ↔ app canonical)', () => {
  it('server mirror exactly equals the app canonical constant', () => {
    expect(SERVER_MIRROR).toBe(APP_CANONICAL);
  });

  it('is the approved identifier', () => {
    // CONSCIOUS REPIN (HydroState v1.0, founder final candidate ruling
    // 2026-09-01). Changing this requires Founder + Engineering approval
    // (+ Scientific where physiological) — DR-009 §3.
    //
    // v0.1 was the RP-8b staging stamp and was never released. It also
    // understated the change: a MINOR bump declares the two sides COMPARABLE,
    // and they are not. Brand identity no longer earns hydration credit, the
    // behavioural terms have left the score, and intake is now target-relative
    // and saturating — a member's number moves without their body moving.
    // That is the definition of a MAJOR bump in this registry.
    //
    // The reservation on `hydrostate-v1.0` is hereby consumed: the founder has
    // ruled on the urine treatment, PEAK eligibility and the confidence split.
    // Scientific validation of the individual MAGNITUDES remains outstanding
    // and is carried as model debt — see config/hydroStateModel.ts.
    expect(APP_CANONICAL).toBe('hydrostate-v1.0');
  });

  it('follows the canonical hydrostate-v<major>[.<minor>] format', () => {
    expect(APP_CANONICAL).toMatch(/^hydrostate-v\d+(\.\d+)?$/);
  });

  it('is never an empty or placeholder value', () => {
    for (const v of [SERVER_MIRROR, APP_CANONICAL]) {
      expect(v).toBeTruthy();
      expect(v).not.toBe('current');
      expect(v).not.toBe('1');
      expect(v).not.toBe('v1');
    }
  });
});
