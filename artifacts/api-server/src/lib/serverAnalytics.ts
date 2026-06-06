/**
 * Server-owned analytics emission (Task #39).
 *
 * The mobile dispatcher owns client events; a few Phase-1 events are
 * BACKEND-owned because only the server observes them with certainty:
 *   - receipt_verified / receipt_activated (scan persistence)
 *   - subscription_started (Stripe webhook)
 *
 * This module is the single server-side path into the same INTERNAL
 * `aforce_analytics_events` table the mobile ingest route writes to. It
 * reuses the shared contract's envelope assembly + zod validation so the
 * server can never write a row the client ingest path would reject.
 *
 * Privacy + safety invariants:
 *   - analytics_id is the PSEUDONYMOUS id the client forwards under the
 *     `x-aforce-analytics-id` header, only after consent. We re-validate
 *     it against the contract's `anon_` shape (safeParse) so a Clerk user
 *     id or any non-pseudonymous value is dropped, never stored.
 *   - Idempotent: eventId is minted deterministically from a stable seed
 *     so webhook/scan retries collapse via ON CONFLICT DO NOTHING.
 *   - Fire-and-forget: this NEVER throws into the caller and NEVER alters
 *     payment, scan, or any product behavior. Failures are swallowed.
 *   - No fabrication: callers emit only on REAL observed server behavior.
 */

import { createHash } from "node:crypto";
import {
  db,
  aforceAnalyticsEvents,
  type InsertAforceAnalyticsEvent,
} from "@workspace/db";
import {
  assembleEnvelope,
  type AnalyticsEventType,
} from "@workspace/analytics-contract";
import { analyticsEnvelopeSchema } from "@workspace/analytics-contract/zod";
import { logger } from "./logger";

export interface ServerAnalyticsInput {
  eventId: string;
  eventType: AnalyticsEventType;
  analyticsId: string;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}

/**
 * Deterministic, idempotent event id from a stable seed. SHA-256 hex is
 * `[0-9a-f]`, so the result always satisfies the contract's
 * `/^evt_[a-z0-9]+_[a-z0-9]+$/` guard. The same seed always maps to the
 * same id, so retries (Stripe redelivery, client re-POST) dedupe.
 */
export function deterministicEventId(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex");
  return `evt_${hex.slice(0, 16)}_${hex.slice(16, 32)}`;
}

/**
 * The pseudonymous analytics-id shape from the shared contract
 * (`@workspace/analytics-contract/zod` → ANALYTICS_ID_RE). Mirrored here so
 * the server can reject a non-`anon_` id (notably a Clerk `user_...` id) at
 * HEADER INGRESS — before it is written ANYWHERE (e.g. into Stripe
 * subscription metadata at checkout), not merely at DB-insert time. Keep in
 * lockstep with the contract regex.
 */
const ANON_ANALYTICS_ID_RE = /^anon_[a-z0-9]+_[a-z0-9]+$/;

/**
 * Validate + normalize a forwarded analytics-id header. Returns the id only
 * when it matches the pseudonymous `anon_` shape (and is within the contract
 * length bound); returns null otherwise. This is the single ingress guard —
 * a non-pseudonymous identifier can never reach Stripe metadata or the DB.
 */
export function analyticsIdFromHeader(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return null;
  return ANON_ANALYTICS_ID_RE.test(trimmed) ? trimmed : null;
}

/**
 * Persist server-owned analytics events. Validates every envelope through
 * the shared contract schema (dropping any that fail — e.g. a non-`anon_`
 * analytics_id) and inserts idempotently on eventId. Best-effort: any error
 * is logged and swallowed so analytics can never break the caller.
 */
export async function recordServerAnalyticsEvents(
  inputs: ServerAnalyticsInput[],
): Promise<void> {
  if (inputs.length === 0) return;
  try {
    const rows: InsertAforceAnalyticsEvent[] = [];
    for (const input of inputs) {
      const parsed = analyticsEnvelopeSchema.safeParse(
        assembleEnvelope(input),
      );
      if (!parsed.success) continue;
      const e = parsed.data;
      const occurred = new Date(e.occurredAt);
      rows.push({
        eventId: e.eventId,
        analyticsId: e.analytics_id,
        eventType: e.eventType,
        occurredAt: Number.isNaN(occurred.getTime()) ? new Date() : occurred,
        schemaVersion: e.schemaVersion,
        payload: e.payload,
      });
    }
    if (rows.length === 0) return;
    await db
      .insert(aforceAnalyticsEvents)
      .values(rows)
      .onConflictDoNothing({ target: aforceAnalyticsEvents.eventId });
  } catch (err) {
    logger.warn({ err }, "recordServerAnalyticsEvents failed (swallowed)");
  }
}
