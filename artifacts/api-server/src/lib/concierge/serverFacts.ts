/**
 * AForce Concierge — facts the SERVER owns and can vouch for.
 *
 * Read from the member's own `aforce_user_state` row (already keyed by the
 * authenticated userId). The client's copy of these values is advisory; when
 * the server has them, the server's figures are the ones the model sees.
 *
 * Nothing is computed here beyond a freshness label (mirror constants in
 * config.ts). No score, no target maths — those stay in the client engine.
 */
import { CONCIERGE_FRESHNESS_MIRROR } from "./config";
import type { Freshness, ServerFacts } from "./types";

export interface UserStateFactsRow {
  ozConsumedToday: number;
  ozTarget: number;
  unitsConsumedToday: number;
  dailyTarget: number;
  biometrics?: Record<string, { providerId?: string; fetchedAt?: number } | undefined> | null;
  weatherTempC?: number | null;
  weatherHumidity?: number | null;
  weatherCity?: string | null;
  weatherFetchedAt?: Date | string | null;
}

export function freshnessFor(
  ageMs: number,
  windows: { freshUntilMs: number; staleAfterMs: number; expireAfterMs?: number },
): Freshness {
  if (!Number.isFinite(ageMs) || ageMs < 0) return "missing";
  if (ageMs <= windows.freshUntilMs) return "fresh";
  if (ageMs <= windows.staleAfterMs) return "aging";
  if (windows.expireAfterMs !== undefined && ageMs > windows.expireAfterMs) return "expired";
  return "stale";
}

export function serverFactsFromRow(row: UserStateFactsRow | null, nowMs = Date.now()): ServerFacts {
  if (!row) return { intake: null, weather: null, providerSyncs: [] };

  const providerSyncs: ServerFacts["providerSyncs"] = [];
  for (const [key, snap] of Object.entries(row.biometrics ?? {})) {
    const fetchedAt = snap?.fetchedAt;
    if (typeof fetchedAt !== "number" || !Number.isFinite(fetchedAt)) continue;
    providerSyncs.push({
      id: snap?.providerId ?? key,
      fetchedAtIso: new Date(fetchedAt).toISOString(),
      freshness: freshnessFor(nowMs - fetchedAt, CONCIERGE_FRESHNESS_MIRROR.wearable_sync),
    });
  }

  let weather: ServerFacts["weather"] = null;
  if (typeof row.weatherTempC === "number" && row.weatherFetchedAt) {
    const fetched = new Date(row.weatherFetchedAt).getTime();
    if (Number.isFinite(fetched)) {
      const freshness = freshnessFor(nowMs - fetched, CONCIERGE_FRESHNESS_MIRROR.weather);
      // Expired weather is withheld entirely — "use current weather only when a
      // functioning, authorized source provides it".
      if (freshness !== "expired") {
        weather = {
          tempC: row.weatherTempC,
          humidity: typeof row.weatherHumidity === "number" ? row.weatherHumidity : null,
          city: row.weatherCity ?? null,
          fetchedAtIso: new Date(fetched).toISOString(),
          freshness,
        };
      }
    }
  }

  return {
    intake: {
      ozToday: Number(row.ozConsumedToday) || 0,
      ozTarget: Number(row.ozTarget) || 0,
      unitsToday: Number(row.unitsConsumedToday) || 0,
      unitsTarget: Number(row.dailyTarget) || 0,
    },
    weather,
    providerSyncs,
  };
}
