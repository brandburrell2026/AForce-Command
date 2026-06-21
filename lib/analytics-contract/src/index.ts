/**
 * @workspace/analytics-contract — the single source of truth for the
 * INTERNAL AForce analytics event pipeline.
 *
 * Shared by the mobile client (event dispatcher) and the api-server
 * (ingestion + admin read) so the event envelope, the Phase-1 event
 * catalog, the schema version, and the deferred-feature registry never
 * fork between the two. No React Native or server-only imports live
 * here — keep this module environment-agnostic so Metro and tsc both
 * resolve it cleanly. Zod schemas live in the `./zod` entry so the
 * mobile bundle never has to pull zod through this module.
 *
 * Governing principle (replit.md build lock): "Build architecture for
 * everything; expose features in phases." Analytics is INTERNAL ONLY —
 * there is no customer-facing analytics surface. Only restricted admins
 * read aggregated analytics.
 */

/**
 * Envelope schema version. Bump only when the envelope SHAPE changes in
 * a way consumers must branch on. Adding new event types or payload
 * fields does NOT require a bump.
 */
export const SCHEMA_VERSION = 1 as const;

export type AnalyticsEventOwner = "mobile" | "backend" | "ai";

/**
 * One canonical envelope for every analytics event, regardless of type.
 * `analytics_id` is a PSEUDONYMOUS id (not the Clerk user id) generated
 * client-side after consent — see the mobile privacy_manager.
 */
export interface AnalyticsEventEnvelope {
  /** Client-generated unique id. Idempotency key: each id is stored at
   *  most once end-to-end. */
  eventId: string;
  eventType: AnalyticsEventType;
  /** Pseudonymous analytics identity. Never the Clerk user id. */
  analytics_id: string;
  /** ISO-8601 timestamp of when the behavior occurred. */
  occurredAt: string;
  schemaVersion: number;
  /** Event-specific fields. Kept open so new fields are additive and
   *  never require a schema-version bump. */
  payload: Record<string, unknown>;
}

/**
 * Phase-1 launch events — the ONLY events emitted today. Each entry
 * documents its owner, its real trigger, and its required payload
 * fields. This array is the machine-readable mirror of
 * `artifacts/aforce-os/analytics/analytics_events.json`; keep the two
 * in sync. Events map only to REAL observed behavior — never fabricate.
 */
export const PHASE1_EVENTS = [
  { eventType: "consent_granted", owner: "mobile", trigger: "User accepts the analytics consent prompt", payloadFields: ["consentVersion"] },
  { eventType: "onboarding_completed", owner: "mobile", trigger: "User finishes the onboarding wizard", payloadFields: [] },
  { eventType: "app_opened", owner: "mobile", trigger: "App is launched or foregrounded", payloadFields: ["platform"] },
  { eventType: "session_started", owner: "mobile", trigger: "First app open of a calendar day", payloadFields: [] },
  { eventType: "ritual_started", owner: "mobile", trigger: "User begins a hydration ritual / protocol", payloadFields: ["ritualId"] },
  { eventType: "ritual_completed", owner: "mobile", trigger: "User completes a hydration ritual / protocol", payloadFields: ["ritualId"] },
  { eventType: "water_cycle_logged", owner: "mobile", trigger: "User logs a water / AForce intake", payloadFields: ["fluidType", "oz"] },
  { eventType: "water_goal_completed", owner: "mobile", trigger: "Daily hydration goal is reached", payloadFields: [] },
  { eventType: "hydration_score_updated", owner: "mobile", trigger: "Engine recomputes the hydration score band", payloadFields: ["score", "level"] },
  { eventType: "command_followed", owner: "mobile", trigger: "User follows the coach command / recommendation", payloadFields: ["commandId"] },
  { eventType: "impact_shown", owner: "mobile", trigger: "An impact / explainability surface is shown", payloadFields: ["impactKey"] },
  { eventType: "orb_state_changed", owner: "mobile", trigger: "The orb transitions performance state", payloadFields: ["from", "to"] },
  { eventType: "qr_scanned", owner: "mobile", trigger: "Acquisition QR / activation deep-link opened (printed on a can or in a marketing link); distinct from the in-app HydroScan receipt_scanned", payloadFields: ["sku", "retailLocationId", "geo", "campaign", "qrId"] },
  { eventType: "receipt_scanned", owner: "mobile", trigger: "A product barcode / receipt is scanned (HydroScan)", payloadFields: ["sourceKind"] },
  { eventType: "receipt_verified", owner: "backend", trigger: "Server verifies a scanned receipt / product", payloadFields: ["verdict"] },
  { eventType: "receipt_activated", owner: "backend", trigger: "A verified receipt is activated / credited", payloadFields: [] },
  { eventType: "survey_answered", owner: "mobile", trigger: "User answers an in-app survey / NPS question", payloadFields: ["surveyId", "value"] },
  { eventType: "notification_opened", owner: "mobile", trigger: "User opens / acts on a reminder notification", payloadFields: ["slot"] },
  { eventType: "subscription_started", owner: "mobile", trigger: "A paid subscription becomes active — emitted CLIENT-side on confirmed checkout (sole emitter), carrying descriptive non-PII revenue metadata", payloadFields: ["planTier", "amountCents", "currency", "billingInterval"] },
  { eventType: "day7_subscription_offer", owner: "mobile", trigger: "The Day-7 subscription offer is shown to the user", payloadFields: [] },
] as const satisfies ReadonlyArray<{
  eventType: string;
  owner: AnalyticsEventOwner;
  trigger: string;
  payloadFields: readonly string[];
}>;

export type AnalyticsEventType = (typeof PHASE1_EVENTS)[number]["eventType"];

export const PHASE1_EVENT_TYPES: readonly AnalyticsEventType[] =
  PHASE1_EVENTS.map((e) => e.eventType);

export function isPhase1EventType(x: unknown): x is AnalyticsEventType {
  return (
    typeof x === "string" &&
    (PHASE1_EVENT_TYPES as readonly string[]).includes(x)
  );
}

/**
 * Deferred analytics capabilities. The ARCHITECTURE accommodates them
 * (extensible payload, schema version, role gating, this registry) but
 * they are intentionally NOT built or exposed in Phase 1. Flipping
 * `active` is a deliberate, later decision — do not wire these yet.
 */
export const DEFERRED_EVENT_GROUPS = [
  { id: "cohort_reporting", active: false },
  { id: "attribution_models", active: false },
  { id: "investor_reporting_automation", active: false },
  { id: "referral_systems_advanced", active: false },
  { id: "ltv_cac_dashboards", active: false },
  { id: "subscription_analytics_advanced", active: false },
  { id: "paywall_optimization", active: false },
] as const satisfies ReadonlyArray<{ id: string; active: boolean }>;

export type DeferredEventGroupId = (typeof DEFERRED_EVENT_GROUPS)[number]["id"];

/**
 * Assemble a well-formed envelope. Pure given `occurredAt`; when it is
 * omitted the current wall-clock time is stamped. `eventId` and
 * `analyticsId` are produced by the caller (the mobile dispatcher /
 * privacy_manager) so id generation stays out of this shared module.
 */
export function assembleEnvelope(input: {
  eventId: string;
  eventType: AnalyticsEventType;
  analyticsId: string;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}): AnalyticsEventEnvelope {
  return {
    eventId: input.eventId,
    eventType: input.eventType,
    analytics_id: input.analyticsId,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    payload: input.payload ?? {},
  };
}
