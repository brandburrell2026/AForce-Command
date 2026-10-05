/**
 * AForce Concierge — provider availability (the truth behind GET /status).
 *
 * Env presence is not availability: on 2026-10-05 production carried a
 * placeholder key (401 on every call) and then an OpenAI organization with no
 * credits (429), and `/status` said "available" both times. This module
 * probes the provider (a cheap `models.retrieve`) and classifies the outcome,
 * caching the answer so the probe costs one request per `CONCIERGE_STATUS_CACHE_MS`
 * (a failed probe is re-checked sooner so recovery shows up quickly).
 *
 * The same classifier maps upstream errors inside the turn pipeline, so the
 * client can show "out of capacity" vs "not configured" vs "unreachable"
 * instead of one generic message.
 */
import { CONCIERGE_MODEL, CONCIERGE_STATUS_CACHE_MS, CONCIERGE_STATUS_FAIL_CACHE_MS, CONCIERGE_STATUS_PROBE_TIMEOUT_MS, conciergeAiConfigured } from "./config";

export type AiUnavailableReason =
  | "ai_not_configured"
  | "ai_key_invalid"
  | "ai_quota_exhausted"
  | "ai_rate_limited"
  | "ai_model_unavailable"
  | "ai_unreachable";

/** Turn-pipeline codes derived from the same classification. */
export type UpstreamErrorCode =
  | "upstream_auth"
  | "upstream_quota"
  | "upstream_rate_limited"
  | "upstream_model"
  | "upstream_timeout"
  | "upstream_error";

export interface AvailabilityResult {
  available: boolean;
  reason: AiUnavailableReason | null;
  checkedAt: string;
  cached: boolean;
  /** Redacted provider message for logs/audit, never for members. */
  detail?: string;
}

/** Minimal provider surface the probe needs (injectable for tests). */
export interface ModelsClient {
  models: { retrieve(model: string, options?: { signal?: AbortSignal }): Promise<unknown> };
}

function errStatus(err: unknown): number | null {
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : null;
}
function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? "");
}

/** Classify a provider error (OpenAI SDK APIError shape: `.status`, `.message`). */
export function classifyUpstreamError(err: unknown, aborted = false): UpstreamErrorCode {
  if (aborted) return "upstream_timeout";
  const status = errStatus(err);
  const msg = errMessage(err).toLowerCase();
  if (status === 401 || status === 403) return "upstream_auth";
  if (status === 429) {
    return /credit|quota|billing|insufficient_quota|exceeded your current/.test(msg) ? "upstream_quota" : "upstream_rate_limited";
  }
  if (status === 404 && /model/.test(msg)) return "upstream_model";
  if (msg.includes("abort") || msg.includes("timeout") || msg.includes("timed out")) return "upstream_timeout";
  return "upstream_error";
}

export function reasonForUpstream(code: UpstreamErrorCode): AiUnavailableReason {
  switch (code) {
    case "upstream_auth":
      return "ai_key_invalid";
    case "upstream_quota":
      return "ai_quota_exhausted";
    case "upstream_rate_limited":
      return "ai_rate_limited";
    case "upstream_model":
      return "ai_model_unavailable";
    default:
      return "ai_unreachable";
  }
}

/** Strip anything key-shaped before a message is logged or stored. */
export function redactProviderMessage(msg: string): string {
  return msg.replace(/sk-[A-Za-z0-9_*-]{4,}/g, "sk-[redacted]").slice(0, 200);
}

export interface AvailabilityChecker {
  check(now?: number): Promise<AvailabilityResult>;
  /** Drop the cache (tests; or after a config change). */
  reset(): void;
}

export function createAvailabilityChecker(
  getClient: () => Promise<ModelsClient>,
  opts: {
    configured?: () => boolean;
    cacheMs?: number;
    failCacheMs?: number;
    probeTimeoutMs?: number;
    model?: string;
  } = {},
): AvailabilityChecker {
  const configured = opts.configured ?? conciergeAiConfigured;
  const cacheMs = opts.cacheMs ?? CONCIERGE_STATUS_CACHE_MS;
  const failCacheMs = opts.failCacheMs ?? CONCIERGE_STATUS_FAIL_CACHE_MS;
  const probeTimeoutMs = opts.probeTimeoutMs ?? CONCIERGE_STATUS_PROBE_TIMEOUT_MS;
  const model = opts.model ?? CONCIERGE_MODEL;

  let last: { result: AvailabilityResult; at: number } | null = null;
  let inflight: Promise<AvailabilityResult> | null = null;

  async function probe(now: number): Promise<AvailabilityResult> {
    const checkedAt = new Date(now).toISOString();
    if (!configured()) {
      return { available: false, reason: "ai_not_configured", checkedAt, cached: false };
    }
    let client: ModelsClient;
    try {
      client = await getClient();
    } catch (err) {
      return { available: false, reason: "ai_not_configured", checkedAt, cached: false, detail: redactProviderMessage(errMessage(err)) };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), probeTimeoutMs);
    try {
      // Race against the abort: a provider that ignores the signal must still
      // resolve the probe as "unreachable" instead of hanging the status route.
      const aborted = new Promise<never>((_, reject) =>
        controller.signal.addEventListener("abort", () => reject(new Error("status probe timed out"))),
      );
      await Promise.race([client.models.retrieve(model, { signal: controller.signal }), aborted]);
      return { available: true, reason: null, checkedAt, cached: false };
    } catch (err) {
      const code = classifyUpstreamError(err, controller.signal.aborted);
      return {
        available: false,
        reason: reasonForUpstream(code),
        checkedAt,
        cached: false,
        detail: redactProviderMessage(errMessage(err)),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async check(now = Date.now()) {
      if (last) {
        const ttl = last.result.available ? cacheMs : failCacheMs;
        if (now - last.at < ttl) return { ...last.result, cached: true };
      }
      if (!inflight) {
        inflight = probe(now)
          .then((result) => {
            last = { result, at: now };
            return result;
          })
          .finally(() => {
            inflight = null;
          });
      }
      return inflight;
    },
    reset() {
      last = null;
      inflight = null;
    },
  };
}
