/**
 * Unit tests for the server-side Hydration Demand state adapter.
 *
 * Coverage:
 *   - body weight: persisted column wins; default applied + trace
 *     records `weightFromProfile=false` when null.
 *   - activity level: clamped to [0..10]; non-numeric / NaN -> 0.
 *   - weather fields: passed through when finite, omitted otherwise.
 *   - sleep: freshest-wins across legacy `appleHealth` and the
 *     multi-provider `biometrics` blob; non-numeric/null entries
 *     ignored; returns null trace when no provider has data.
 *   - overrides: merged in over derived values without fabricating.
 */
import { describe, it, expect } from "vitest";
import {
  buildHydrationDemandInputsFromState,
  selectFreshestSleep,
  type DemandSourceState,
} from "../hydrationDemandStateAdapter";

function emptyState(overrides: Partial<DemandSourceState> = {}): DemandSourceState {
  return {
    bodyWeightLbs: null,
    activityLevel: null,
    weatherTempC: null,
    weatherHumidity: null,
    appleHealth: null,
    biometrics: null,
    ...overrides,
  };
}

describe("buildHydrationDemandInputsFromState", () => {
  it("uses the persisted body weight when present", () => {
    const out = buildHydrationDemandInputsFromState(
      emptyState({ bodyWeightLbs: 200 }),
    );
    expect(out.inputs.weightLbs).toBe(200);
    expect(out.trace.weightFromProfile).toBe(true);
  });

  it("falls back to the default body weight when null and flags the trace", () => {
    const out = buildHydrationDemandInputsFromState(emptyState());
    expect(out.inputs.weightLbs).toBe(175);
    expect(out.trace.weightFromProfile).toBe(false);
  });

  it("clamps activity level to [0..10] and coerces NaN/null to 0", () => {
    expect(
      buildHydrationDemandInputsFromState(emptyState({ activityLevel: -3 }))
        .inputs.activityLevel,
    ).toBe(0);
    expect(
      buildHydrationDemandInputsFromState(emptyState({ activityLevel: 99 }))
        .inputs.activityLevel,
    ).toBe(10);
    expect(
      buildHydrationDemandInputsFromState(emptyState({ activityLevel: 6 }))
        .inputs.activityLevel,
    ).toBe(6);
    expect(
      buildHydrationDemandInputsFromState(
        emptyState({ activityLevel: Number.NaN }),
      ).inputs.activityLevel,
    ).toBe(0);
  });

  it("emits weather only when the persisted columns are finite numbers", () => {
    const out = buildHydrationDemandInputsFromState(
      emptyState({ weatherTempC: 28, weatherHumidity: 65 }),
    );
    expect(out.inputs.heatC).toBe(28);
    expect(out.inputs.humidityPct).toBe(65);

    const missing = buildHydrationDemandInputsFromState(emptyState());
    expect(missing.inputs).not.toHaveProperty("heatC");
    expect(missing.inputs).not.toHaveProperty("humidityPct");
  });

  it("merges in caller overrides without fabricating absent fields", () => {
    const out = buildHydrationDemandInputsFromState(emptyState(), {
      sweatProfile: "high",
      environmentProfile: "hot_climate",
      recoveryScore: 42,
      consumedOz: 18,
      completedCycles: 1,
    });
    expect(out.inputs.sweatProfile).toBe("high");
    expect(out.inputs.environmentProfile).toBe("hot_climate");
    expect(out.inputs.recoveryScore).toBe(42);
    expect(out.inputs.consumedOz).toBe(18);
    expect(out.inputs.completedCycles).toBe(1);
  });

  it("omits sleepHours entirely when no provider has data", () => {
    const out = buildHydrationDemandInputsFromState(emptyState());
    expect(out.inputs).not.toHaveProperty("sleepHours");
    expect(out.trace.sleepSource).toBeNull();
  });
});

describe("selectFreshestSleep", () => {
  it("returns null when both sources are empty", () => {
    expect(selectFreshestSleep({ appleHealth: null, biometrics: null })).toBeNull();
  });

  it("uses legacy appleHealth when it's the only provider with data", () => {
    const got = selectFreshestSleep({
      appleHealth: { sleepHoursLastNight: 7.4, fetchedAt: 100 },
      biometrics: null,
    });
    expect(got).toEqual({
      hours: 7.4,
      source: "apple_health",
      fetchedAt: 100,
    });
  });

  it("freshest-wins across providers ranked by fetchedAt", () => {
    const got = selectFreshestSleep({
      appleHealth: { sleepHoursLastNight: 6.0, fetchedAt: 500 },
      biometrics: {
        whoop: {
          providerId: "whoop",
          sleepHoursLastNight: 8.1,
          fetchedAt: 1000,
        },
        samsung_health: {
          providerId: "samsung_health",
          sleepHoursLastNight: 7.0,
          fetchedAt: 200,
        },
      },
    });
    expect(got?.source).toBe("whoop");
    expect(got?.hours).toBe(8.1);
    expect(got?.fetchedAt).toBe(1000);
  });

  it("trusts snap.providerId over the blob key for the source label", () => {
    const got = selectFreshestSleep({
      appleHealth: null,
      biometrics: {
        wrong_key_alias: {
          providerId: "oura",
          sleepHoursLastNight: 7.7,
          fetchedAt: 999,
        },
      },
    });
    expect(got?.source).toBe("oura");
  });

  it("ignores snapshots with non-finite fetchedAt so a malformed record can't poison selection", () => {
    const got = selectFreshestSleep({
      appleHealth: null,
      biometrics: {
        garmin: {
          providerId: "garmin",
          sleepHoursLastNight: 9.9,
          fetchedAt: Number.NaN,
        },
        whoop: {
          providerId: "whoop",
          sleepHoursLastNight: 7.3,
          fetchedAt: 500,
        },
      },
    });
    expect(got?.source).toBe("whoop");
    expect(got?.hours).toBe(7.3);
  });

  it("ignores snapshots with null or non-numeric sleepHoursLastNight", () => {
    const got = selectFreshestSleep({
      appleHealth: { sleepHoursLastNight: null, fetchedAt: 1000 },
      biometrics: {
        whoop: {
          providerId: "whoop",
          sleepHoursLastNight: 7.2,
          fetchedAt: 100,
        },
        garmin: {
          providerId: "garmin",
          sleepHoursLastNight: Number.NaN,
          fetchedAt: 999,
        },
      },
    });
    expect(got?.source).toBe("whoop");
    expect(got?.hours).toBe(7.2);
  });
});
