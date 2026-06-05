/**
 * Client-side envelope construction for the INTERNAL analytics pipeline.
 *
 * Thin wrapper over `@workspace/analytics-contract.assembleEnvelope`
 * that owns id generation (kept out of the shared, environment-agnostic
 * contract). Each `eventId` is unique so ingestion is idempotent end-to-
 * end; the `analytics_id` is the pseudonymous identity from the privacy
 * manager — never the Clerk user id.
 */
import {
  assembleEnvelope,
  type AnalyticsEventEnvelope,
  type AnalyticsEventType,
} from "@workspace/analytics-contract";

/**
 * Opaque, collision-resistant id. Not cryptographic — analytics ids
 * only need to be unique and unguessable enough that a third party
 * cannot enumerate them; we layer two random segments on top of a
 * timestamp. Mirrors the id style already used in `lib/api.ts`.
 */
export function newId(prefix: string): string {
  const t = Date.now().toString(36);
  const r =
    Math.random().toString(36).slice(2, 12) +
    Math.random().toString(36).slice(2, 12);
  return `${prefix}_${t}_${r}`;
}

export function createEnvelope(
  eventType: AnalyticsEventType,
  analyticsId: string,
  payload?: Record<string, unknown>,
): AnalyticsEventEnvelope {
  return assembleEnvelope({
    eventId: newId("evt"),
    eventType,
    analyticsId,
    payload,
  });
}
