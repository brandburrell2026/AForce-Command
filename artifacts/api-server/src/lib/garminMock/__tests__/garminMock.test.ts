/**
 * Garmin engineering-readiness contract tests.
 *
 * Garmin is DORMANT — no partner credentials, endpoints unverified (see
 * `../../garminSnapshot.ts:19-24`). This suite does not, and must not, make
 * Garmin real — it proves that IF/WHEN credentials arrive, the existing
 * pipeline already correctly:
 *
 *   (a) maps documented Garmin wire shapes -> the REAL `fetchGarminSnapshot`
 *       -> the KNOWN drifted normalized shape (`hrvMs`, `stress` — not
 *       `hrvSdnn`/`stressScore`), and
 *   (b) that drifted shape, run through `@workspace/health-core`'s
 *       `normalizeProviderSnapshot('garmin', ...)`, lands on the canonical
 *       `hrvRmssdMs` field (never `hrvSdnnMs` or the legacy `hrvSdnn`) plus
 *       `stressScore` — i.e. the foundation absorbs the Garmin drift
 *       automatically, today, with zero Garmin-specific code changes needed
 *       at activation time.
 *   (c) `createGarminMockAdapter()` itself is drop-in compatible with the
 *       `GarminSnapshotFetcher` seam `runGarminFetchOnce` already accepts.
 *
 * No `garmin*` file is modified anywhere in this lane — every import './_env';
import below
 * is read-only against the real, unmodified modules.
 *
 * health-core import note: `@workspace/health-core` is NOT a declared
 * dependency of `@workspace/api-server` (confirmed: no entry in
 * `artifacts/api-server/package.json`, no symlink under
 * `artifacts/api-server/node_modules/@workspace`). Only `artifacts/aforce-os`
 * depends on it today. Adding the dependency is a `package.json` edit,
 * which is out of scope for a test-only lane — so this file imports the
 * frozen contract source by RELATIVE PATH instead of the package
 * specifier. This is a real gap worth flagging for whoever does the G3/1B
 * provider-kit cutover: the api-server will need `@workspace/health-core`
 * added as an actual workspace dependency at that point.
 */
import { describe, it, expect } from "vitest";
import { fetchGarminSnapshot } from "../../garminSnapshot";
import {
  garminSnapshotToProviderBlob,
  type GarminSnapshot,
} from "../../garminSnapshot";
import { createGarminMockAdapter } from "../garminMockAdapter";
import {
  GARMIN_DAILIES_FIXTURE,
  GARMIN_EXPECTED_DRIFTED_SNAPSHOT,
  GARMIN_HRV_FIXTURE,
  GARMIN_SLEEPS_DURATION_FALLBACK_FIXTURE,
  GARMIN_SLEEPS_FIXTURE,
} from "../garminMock.fixtures";
// Relative import into the frozen health-core contract source — see the
// module docstring above for why this isn't `@workspace/health-core`.
import { normalizeProviderSnapshot } from "@workspace/health-core";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fixtureFetch(fixtures: {
  dailies?: unknown[];
  sleeps?: unknown[];
  hrv?: unknown[];
}): typeof fetch {
  return (async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/dailies")) return jsonResponse(fixtures.dailies ?? []);
    if (u.includes("/sleeps")) return jsonResponse(fixtures.sleeps ?? []);
    if (u.includes("/hrv")) return jsonResponse(fixtures.hrv ?? []);
    return jsonResponse([]);
  }) as unknown as typeof fetch;
}

describe("(a) documented Garmin wire fixtures -> REAL fetchGarminSnapshot -> known drifted shape", () => {
  it("maps dailies + sleeps + hrv fixtures to the pinned drifted GarminSnapshot", async () => {
    const snap = await fetchGarminSnapshot({
      accessToken: "tok",
      fetchImpl: fixtureFetch({
        dailies: GARMIN_DAILIES_FIXTURE,
        sleeps: GARMIN_SLEEPS_FIXTURE,
        hrv: GARMIN_HRV_FIXTURE,
      }),
    });
    expect(snap).toEqual<GarminSnapshot>(GARMIN_EXPECTED_DRIFTED_SNAPSHOT);
    // The drift, spelled out explicitly: these are the field NAMES that
    // don't match the persisted biometrics schema's hrvSdnn/stressScore —
    // that's the mismatch (b) proves health-core absorbs.
    expect(snap).toHaveProperty("hrvMs");
    expect(snap).toHaveProperty("stress");
    expect(snap).not.toHaveProperty("hrvSdnn");
    expect(snap).not.toHaveProperty("stressScore");
  });

  it("falls back to durationInSeconds when sleepTimeInSeconds is absent (documented alternate shape)", async () => {
    const snap = await fetchGarminSnapshot({
      accessToken: "tok",
      fetchImpl: fixtureFetch({
        dailies: GARMIN_DAILIES_FIXTURE,
        sleeps: GARMIN_SLEEPS_DURATION_FALLBACK_FIXTURE,
        hrv: GARMIN_HRV_FIXTURE,
      }),
    });
    expect(snap.sleepHoursLastNight).toBe(6.75);
  });
});

describe("(b) drifted GarminSnapshot -> health-core normalizeProviderSnapshot('garmin', ...)", () => {
  it("lands hrvRmssdMs (never hrvSdnnMs or legacy hrvSdnn) + stressScore — foundation absorbs Garmin", async () => {
    const snap = await fetchGarminSnapshot({
      accessToken: "tok",
      fetchImpl: fixtureFetch({
        dailies: GARMIN_DAILIES_FIXTURE,
        sleeps: GARMIN_SLEEPS_FIXTURE,
        hrv: GARMIN_HRV_FIXTURE,
      }),
    });
    const fetchedAt = 1_700_000_000_000;
    // The exact wire shape the api-server persists into the biometrics
    // jsonb blob (garminSnapshotToProviderBlob is the real, unmodified
    // lifter — not a hand-rolled stand-in).
    const blob = garminSnapshotToProviderBlob(snap, fetchedAt);

    const normalized = normalizeProviderSnapshot("garmin", blob);
    expect(normalized).not.toBeNull();
    // The whole point: RMSSD-family Garmin HRV lands on the canonical
    // RMSSD field, not the SDNN one and not a value-bearing legacy field.
    expect(normalized?.hrvRmssdMs).toBe(GARMIN_EXPECTED_DRIFTED_SNAPSHOT.hrvMs);
    expect(normalized?.hrvSdnnMs).toBeNull();
    expect(normalized?.hrvSdnn).toBeNull();
    // Garmin's `stress` drift absorbed into the canonical `stressScore`.
    expect(normalized?.stressScore).toBe(GARMIN_EXPECTED_DRIFTED_SNAPSHOT.stress);
    expect(normalized?.restingHeartRate).toBe(
      GARMIN_EXPECTED_DRIFTED_SNAPSHOT.restingHeartRate,
    );
    expect(normalized?.stepsToday).toBe(GARMIN_EXPECTED_DRIFTED_SNAPSHOT.steps);
    expect(normalized?.sleepHoursLastNight).toBe(
      GARMIN_EXPECTED_DRIFTED_SNAPSHOT.sleepHoursLastNight,
    );
    expect(normalized?.providerId).toBe("garmin");
    expect(normalized?.fetchedAt).toBe(fetchedAt);
  });

  it("malformed entry (missing numeric fetchedAt) is dropped, matching shipped normalizeProviderBiometrics semantics", () => {
    expect(
      normalizeProviderSnapshot("garmin", { hrvMs: 41, stress: 37 }),
    ).toBeNull();
  });
});

describe("(c) createGarminMockAdapter — GarminSnapshotFetcher seam compatibility", () => {
  it("is a plain async function taking (accessToken) and resolving a GarminSnapshot — the exact seam shape", async () => {
    const adapter = createGarminMockAdapter();
    expect(typeof adapter).toBe("function");
    expect(adapter.length).toBe(1);
    const snap = await adapter("any-access-token");
    expect(snap).toEqual<GarminSnapshot>(GARMIN_EXPECTED_DRIFTED_SNAPSHOT);
  });

  it("is deterministic across repeated calls and distinct access tokens", async () => {
    const adapter = createGarminMockAdapter();
    const first = await adapter("token-a");
    const second = await adapter("token-b");
    expect(first).toEqual(second);
    expect(first).toEqual(GARMIN_EXPECTED_DRIFTED_SNAPSHOT);
  });

  it("honors fixture overrides without touching the shared fixture file", async () => {
    const adapter = createGarminMockAdapter({
      dailies: [{ restingHeartRateInBeatsPerMinute: 61, steps: 100, averageStressLevel: 5 }],
      sleeps: [{ sleepTimeInSeconds: 5 * 3600 }],
      hrv: [{ lastNightAvg: 30 }],
    });
    const snap = await adapter("tok");
    expect(snap).toEqual<GarminSnapshot>({
      restingHeartRate: 61,
      hrvMs: 30,
      sleepHoursLastNight: 5,
      stress: 5,
      steps: 100,
    });
  });

  it("drop-in check: the adapter's output round-trips through health-core exactly like (b)'s manual pipeline", async () => {
    const adapter = createGarminMockAdapter();
    const snap = await adapter("tok");
    const blob = garminSnapshotToProviderBlob(snap, 42);
    const normalized = normalizeProviderSnapshot("garmin", blob);
    expect(normalized?.hrvRmssdMs).toBe(41);
    expect(normalized?.stressScore).toBe(37);
  });
});
