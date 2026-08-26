/**
 * Wave-2 PR1 parity lock: the server's literal feature-entitlement tables
 * (lib/featureEntitlements.ts) must exactly match the client's catalog —
 * `getEffectiveFeatures` over data/subscriptionPlans.ts and
 * FEATURE_REQUIREMENTS in featureFlags/subscriptionGate.ts.
 *
 * Cross-boundary import is deliberate and CI-only (same pattern as
 * subscriptionPlanParity.test.ts): the server cannot import app modules
 * at runtime, so this test is what keeps the duplicated literals honest.
 */
import { describe, it, expect } from "vitest";

import {
  SUBSCRIPTION_PLANS,
  getEffectiveFeatures,
} from "../../../../aforce-os/data/subscriptionPlans";
import { FEATURE_REQUIREMENTS } from "../../../../aforce-os/featureFlags/subscriptionGate";
import {
  PLAN_FEATURES,
  FEATURE_MIN_PLAN,
  ENTITLING_STATUSES,
  planGrantsFeature,
} from "../featureEntitlements";

describe("server↔client entitlement parity", () => {
  it("covers every client plan, and no extras", () => {
    const clientPlanIds = SUBSCRIPTION_PLANS.map((p) => p.id).sort();
    expect(Object.keys(PLAN_FEATURES).sort()).toEqual(clientPlanIds);
  });

  it("per-plan effective feature sets match the client inheritance walk exactly", () => {
    for (const plan of SUBSCRIPTION_PLANS) {
      const clientFeatures = [
        ...new Set(getEffectiveFeatures(plan.id).map((f) => f.id)),
      ].sort();
      expect(
        [...PLAN_FEATURES[plan.id]!].sort(),
        `plan ${plan.id} drifted`,
      ).toEqual(clientFeatures);
    }
  });

  it("feature→minimum-plan map matches the client FEATURE_REQUIREMENTS exactly", () => {
    const clientMap = Object.fromEntries(
      Object.entries(FEATURE_REQUIREMENTS).map(([id, req]) => [id, req.plan]),
    );
    expect(FEATURE_MIN_PLAN).toEqual(clientMap);
  });

  it("entitling statuses match the client gate (active, trialing, past_due)", () => {
    expect([...ENTITLING_STATUSES].sort()).toEqual(["active", "past_due", "trialing"]);
  });

  it("spot behavior parity: recovery_plus grants shield, core does not, canceled never does", () => {
    expect(planGrantsFeature("recovery_plus", "active", "recovery_mode_enabled")).toBe(true);
    expect(planGrantsFeature("core", "active", "recovery_mode_enabled")).toBe(false);
    expect(planGrantsFeature("recovery_plus", "canceled", "recovery_mode_enabled")).toBe(false);
    expect(planGrantsFeature("nonexistent_plan", "active", "recovery_mode_enabled")).toBe(false);
  });
});
