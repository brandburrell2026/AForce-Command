/**
 * Command Center — LOCAL typed client for the founder-only INTERNAL API.
 *
 * Deliberately NOT the shared @workspace/api-client-react: founder
 * analytics must never ship in the consumer (mobile / marketing-site)
 * bundles, so this cockpit talks to the hand-written, OpenAPI-excluded
 * `GET /api/admin/command-center/summary` route through its own small
 * typed fetch + react-query hook.
 *
 * Auth is COOKIE-based (Clerk session cookie, same-origin). Do NOT attach
 * an Authorization bearer token here — that is mobile-only. The cockpit
 * and the API share the same domain, so the browser sends the session
 * cookie automatically (`credentials: "include"`).
 *
 * Honesty / Score-Protection: the server returns REAL or explicitly
 * `null` values — rates are null when their denominator is empty, the
 * score trend is null until snapshots exist. The UI must render explicit
 * empty states for null, never a fabricated 0.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

/** A ratio metric: explicit numerator/denominator + null-safe rate. */
export interface RateMetric {
  numerator: number;
  denominator: number;
  /** numerator/denominator, or null when denominator === 0 (no data). */
  rate: number | null;
}

/** A simple count with an all-time total and a trailing-window "recent". */
export interface CountMetric {
  total: number;
  recent: number;
}

/** Average readiness score this window vs the previous window + direction. */
export interface ScoreTrendMetric {
  /** Avg score over the trailing window, or null when no snapshots. */
  current: number | null;
  /** Avg score over the prior window, or null when no snapshots. */
  previous: number | null;
  /** current - previous, or null when either side is missing. */
  delta: number | null;
  direction: "up" | "down" | "flat" | null;
  currentSamples: number;
  previousSamples: number;
}

/** Founder "Daily Five" — mirrors the server DTO 1:1. */
export interface CommandCenterDailyFive {
  generatedAt: string;
  windowDays: 7;
  /** Command Activations — PROXY for "first command completed". */
  activations: CountMetric;
  /** D7+ return rate of the >=7d-old cohort. */
  d7ReturnRate: RateMetric;
  /** Command confirmation follow rate: followed / all confirmations. */
  commandFollowRate: RateMetric;
  /** Account-level subscription conversion: active|trialing / all users. */
  subscriptionConversion: RateMetric;
  /** Readiness (hydration) score trend — NOT a literal "performance age". */
  readinessScoreTrend: ScoreTrendMetric;
}

/**
 * Per-metric presentation metadata so the UI labels proxies honestly and
 * consistently. `proxy: true` metrics are stand-ins for the owner's
 * canonical funnel (the Phase-1 event catalog has no
 * first_command_completed / qr_scanned events yet) and MUST surface their
 * `sourceNote` in the UI.
 */
export const DAILY_FIVE_META = {
  activations: {
    title: "Command Activations",
    proxy: true,
    sourceNote:
      "Proxy — distinct identities with at least one command followed (no first-command event instrumented yet).",
  },
  d7ReturnRate: {
    title: "D7+ Return Rate",
    proxy: false,
    sourceNote:
      "Cohort first seen 7+ days ago who returned at least 7 days after first contact.",
  },
  commandFollowRate: {
    title: "Command Confirmation Follow Rate",
    proxy: false,
    sourceNote: "Confirmations followed divided by all confirmations.",
  },
  subscriptionConversion: {
    title: "Subscription Conversion",
    proxy: false,
    sourceNote: "Accounts active or trialing divided by all accounts.",
  },
  readinessScoreTrend: {
    title: "Readiness Score Trend",
    proxy: false,
    sourceNote:
      "Average readiness score, last 7 days vs the prior 7 days (not a performance age).",
  },
} as const;

/** Error carrying the HTTP status so the UI can branch on 401/403 vs 500. */
export class CommandCenterApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CommandCenterApiError";
  }
}

/**
 * Absolute, root-relative path. The shared Replit proxy routes `/api` to
 * the api-server regardless of which artifact made the request, so this
 * must NOT be relative (a relative `api/...` would resolve under the
 * cockpit's own base path and 404).
 */
const SUMMARY_URL = "/api/admin/command-center/summary";

export async function fetchCommandCenterSummary(): Promise<CommandCenterDailyFive> {
  const res = await fetch(SUMMARY_URL, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    let message = res.statusText || `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      // non-JSON error body — keep the status text
    }
    throw new CommandCenterApiError(res.status, message);
  }
  return (await res.json()) as CommandCenterDailyFive;
}

export const commandCenterSummaryQueryKey = ["command-center", "summary"] as const;

/**
 * Founder Daily Five query. Pass `enabled` false until the viewer is
 * signed in so the cockpit never fires a guaranteed-401 request.
 */
export function useCommandCenterSummary(
  options?: { enabled?: boolean },
): UseQueryResult<CommandCenterDailyFive, CommandCenterApiError> {
  return useQuery({
    queryKey: commandCenterSummaryQueryKey,
    queryFn: fetchCommandCenterSummary,
    enabled: options?.enabled ?? true,
  });
}

/** True when an error is a founder-access denial (signed in, not a founder). */
export function isForbidden(err: unknown): boolean {
  return err instanceof CommandCenterApiError && (err.status === 403 || err.status === 401);
}

/** Format a 0..1 rate as a percent string, or null when the rate is null. */
export function formatPercent(rate: number | null, digits = 1): string | null {
  if (rate == null) return null;
  return `${(rate * 100).toFixed(digits)}%`;
}
