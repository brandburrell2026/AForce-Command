/**
 * Zod schemas for analytics envelope ingestion. Kept in a separate
 * entry point (`@workspace/analytics-contract/zod`) so the mobile
 * client can import the envelope types/catalog from the root entry
 * without pulling zod into its bundle. The api-server imports these to
 * validate incoming batches at the trust boundary.
 */
import { z } from "zod";

import { PHASE1_EVENT_TYPES, type AnalyticsEventType } from "./index";

export const analyticsEventTypeSchema = z.enum(
  PHASE1_EVENT_TYPES as [AnalyticsEventType, ...AnalyticsEventType[]],
);

/**
 * Structural id guards. The mobile client mints ids as
 * `${prefix}_${base36ts}_${base36rand}` (see event_envelope.newId), so a
 * pseudonymous analytics id always starts with `anon_` and an event id
 * with `evt_`. Enforcing the shape at the trust boundary is a privacy
 * lever, not cosmetics: it rejects any non-pseudonymous identifier —
 * notably a Clerk user id (`user_...`) — from ever being stored as an
 * analytics id, upholding "analytics_id is never the Clerk user id".
 */
const ANALYTICS_ID_RE = /^anon_[a-z0-9]+_[a-z0-9]+$/;
const EVENT_ID_RE = /^evt_[a-z0-9]+_[a-z0-9]+$/;

export const analyticsEnvelopeSchema = z.object({
  eventId: z.string().min(8).max(128).regex(EVENT_ID_RE),
  eventType: analyticsEventTypeSchema,
  analytics_id: z.string().min(8).max(128).regex(ANALYTICS_ID_RE),
  occurredAt: z.string().min(1).max(40),
  schemaVersion: z.number().int().positive(),
  payload: z.record(z.unknown()).default({}),
});

export type AnalyticsEnvelopeInput = z.infer<typeof analyticsEnvelopeSchema>;

/** A flush is a bounded batch of envelopes. */
export const analyticsBatchSchema = z.object({
  events: z.array(analyticsEnvelopeSchema).min(1).max(100),
});

/** delete-my-data: the caller proves ownership by sending its own
 *  pseudonymous analytics_id (an unguessable random id). */
export const analyticsForgetSchema = z.object({
  analytics_id: z.string().min(8).max(128).regex(ANALYTICS_ID_RE),
});
