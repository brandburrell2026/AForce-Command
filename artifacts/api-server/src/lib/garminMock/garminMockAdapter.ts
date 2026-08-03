/**
 * Deterministic Garmin mock adapter — engineering-readiness proof, NOT a
 * live integration.
 *
 * Garmin stays DORMANT: real endpoints are unverified pending partner
 * credentials (`../garminSnapshot.ts:19-24`). This module never talks to
 * Garmin, is never wired into `runGarminFetchOnce` / the OAuth router /
 * any route, and does not modify a single `garmin*` file — it only imports
 * the REAL, unmodified `fetchGarminSnapshot` mapping and feeds it
 * deterministic fixture wire payloads.
 *
 * Why this exists: the day Garmin partner credentials are provisioned,
 * the fetch worker only needs a `GarminSnapshotFetcher` — the seam
 * `RunGarminFetchOnceDeps.snapshotFetcher` already accepts (see
 * `../garminFetchWorker.ts`). `createGarminMockAdapter()` implements that
 * EXACT same seam shape today, backed by fixtures instead of HTTP, proving
 * the plumbing (mapping -> normalized snapshot -> health-core contract)
 * already works end-to-end and activation is a credentials problem, not an
 * engineering one.
 */

import type { GarminSnapshotFetcher } from "../garminFetchWorker";
import { fetchGarminSnapshot, type GarminSnapshot } from "../garminSnapshot";
import {
  GARMIN_DAILIES_FIXTURE,
  GARMIN_HRV_FIXTURE,
  GARMIN_SLEEPS_FIXTURE,
} from "./garminMock.fixtures";

export interface GarminMockAdapterOptions {
  /** Override the raw /dailies payload (top-level array). */
  dailies?: unknown[];
  /** Override the raw /sleeps payload (top-level array). */
  sleeps?: unknown[];
  /** Override the raw /hrv payload (top-level array). */
  hrv?: unknown[];
}

type ResolvedFixtures = Required<GarminMockAdapterOptions>;

/**
 * Fake `fetch` answering Garmin's three documented wellness-summary
 * endpoints from fixture arrays — the exact wire shape `fetchGarminSnapshot`
 * expects (a top-level JSON array per endpoint). Any unrecognized path
 * 404s, mirroring how an unexpected real-API path would fail.
 */
function buildMockFetch(fixtures: ResolvedFixtures): typeof fetch {
  return (async (url: string | URL) => {
    const u = String(url);
    const body = u.includes("/dailies")
      ? fixtures.dailies
      : u.includes("/sleeps")
        ? fixtures.sleeps
        : u.includes("/hrv")
          ? fixtures.hrv
          : undefined;
    if (body === undefined) {
      return new Response("not-mocked", { status: 404 });
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

/**
 * Create a `GarminSnapshotFetcher` — same seam shape `runGarminFetchOnce`
 * consumes — backed by deterministic fixture data instead of a live Garmin
 * call. Routes through the REAL, unmodified `fetchGarminSnapshot` mapping
 * (imported verbatim, never reimplemented) so this exercises the
 * production mapping code itself, not a hand-rolled stand-in of it.
 *
 * Defaults to the shared fixtures in `garminMock.fixtures.ts`; pass
 * `dailies` / `sleeps` / `hrv` overrides to model a different scenario
 * (e.g. a missing endpoint) without touching the shared fixture file.
 */
export function createGarminMockAdapter(
  opts: GarminMockAdapterOptions = {},
): GarminSnapshotFetcher {
  const fixtures: ResolvedFixtures = {
    dailies: opts.dailies ?? GARMIN_DAILIES_FIXTURE,
    sleeps: opts.sleeps ?? GARMIN_SLEEPS_FIXTURE,
    hrv: opts.hrv ?? GARMIN_HRV_FIXTURE,
  };
  const fetchImpl = buildMockFetch(fixtures);
  return async (accessToken: string): Promise<GarminSnapshot> =>
    fetchGarminSnapshot({ accessToken, fetchImpl });
}
