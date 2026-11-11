/**
 * AForce Concierge — server tunables (Section 64 surface).
 *
 * Every number the concierge pipeline depends on lives here, named, so none is
 * hard-coded in a handler (Build Rule 13 applied to the server side; the
 * client-side tunables live in artifacts/aforce-os/config/hydroStateModel.ts).
 *
 * Freshness windows below MIRROR the client's `FRESHNESS_WINDOWS` for the two
 * signal kinds the server annotates itself (weather, wearable_sync). The
 * api-server bundle cannot import app modules at runtime, so the values are
 * duplicated as literals and locked by
 * `__tests__/conciergeFreshnessParity.test.ts` (same pattern as
 * hydroStateModelVersionParity.test.ts).
 */

/** OpenAI model id. Same model Smart Capture already uses in production. */
export const CONCIERGE_MODEL = "gpt-5.4";

/** Hard ceiling on tokens the model may spend on one reply. */
export const CONCIERGE_MAX_COMPLETION_TOKENS = 900;

/** Abort the upstream call after this long (ms). */
export const CONCIERGE_UPSTREAM_TIMEOUT_MS = 30_000;

/** Member message length cap (chars). Mirrors the client composer cap. */
export const CONCIERGE_MAX_MESSAGE_CHARS = 600;

/** Prior turns (member + assistant) sent to the model as bounded context. */
export const CONCIERGE_HISTORY_TURNS = 12;

/** Char budget for the serialised grounding context block. */
export const CONCIERGE_CONTEXT_CHAR_BUDGET = 6_000;

/** Max messages stored per conversation that the client may page back. */
export const CONCIERGE_TRANSCRIPT_PAGE = 60;

/** Max conversations listed in history. */
export const CONCIERGE_HISTORY_LIST_LIMIT = 30;

/** Per-user request limits. In-memory per process (documented limitation). */
export const CONCIERGE_PER_MINUTE_LIMIT = 20;
export const CONCIERGE_PER_DAY_LIMIT = 150;

/** One regeneration attempt when the first reply fails a gate. */
export const CONCIERGE_GATE_RETRIES = 1;

/** Answer field caps (chars). The model is told these; the server enforces them. */
export const CONCIERGE_ANSWER_MAX_CHARS = 700;
export const CONCIERGE_NEXT_STEP_MAX_CHARS = 220;
export const CONCIERGE_WHY_MAX_CHARS = 500;
export const CONCIERGE_BRIEFING_MAX_CHARS = 600;

/** Remembered-preference caps. */
export const CONCIERGE_PREF_VALUE_MAX_CHARS = 160;
export const CONCIERGE_PREF_NOTES_MAX = 12;

/** Freshness mirrors (ms). See header. */
const HOUR_MS = 60 * 60 * 1000;
export const CONCIERGE_FRESHNESS_MIRROR = {
  weather: { freshUntilMs: 1 * HOUR_MS, staleAfterMs: 3 * HOUR_MS, expireAfterMs: 12 * HOUR_MS },
  wearable_sync: { freshUntilMs: 6 * HOUR_MS, staleAfterMs: 24 * HOUR_MS, expireAfterMs: 72 * HOUR_MS },
} as const;

/** GET /status probes the provider (models.retrieve) and caches the verdict. */
export const CONCIERGE_STATUS_CACHE_MS = 5 * 60 * 1000;
/** A failed probe is re-checked sooner so recovery (new key, credits added) shows quickly. */
export const CONCIERGE_STATUS_FAIL_CACHE_MS = 60 * 1000;
/** Abort the status probe after this long (ms). */
export const CONCIERGE_STATUS_PROBE_TIMEOUT_MS = 8_000;

/** Storage driver: "drizzle" (default) or "memory" (tests / pre-push local runs). */
export function conciergeStoreDriver(): "drizzle" | "memory" {
  return process.env["CONCIERGE_STORE_DRIVER"] === "memory" ? "memory" : "drizzle";
}

/** True when the OpenAI integration env is present (the client throws otherwise). */
export function conciergeAiConfigured(): boolean {
  return Boolean(
    process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] && process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  );
}
