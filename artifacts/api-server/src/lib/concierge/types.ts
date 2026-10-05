/**
 * AForce Concierge — wire contracts (zod).
 *
 * The client assembles the grounding context from the store it already holds
 * (HydroState, Today's Command, intake, provider snapshots, freshness) and
 * labels every value with its PROVENANCE. The server never invents a value:
 * it may only add facts it owns (persisted intake, weather, provider sync
 * times) and it treats everything in `context` as DATA, never as instruction.
 *
 * `demoMode: true` means the member is on a demo/seeded profile — the server
 * then instructs the model to answer generically and NEVER as if the numbers
 * were this person's real health context.
 */
import { z } from "zod";
import {
  CONCIERGE_ANSWER_MAX_CHARS,
  CONCIERGE_MAX_MESSAGE_CHARS,
  CONCIERGE_NEXT_STEP_MAX_CHARS,
  CONCIERGE_PREF_NOTES_MAX,
  CONCIERGE_PREF_VALUE_MAX_CHARS,
  CONCIERGE_WHY_MAX_CHARS,
} from "./config";

/* ─── Provenance vocabulary ────────────────────────────────────────────────── */

export const PROVENANCE = ["measured", "logged", "estimated", "demo"] as const;
export type Provenance = (typeof PROVENANCE)[number];

export const FRESHNESS = ["fresh", "aging", "stale", "expired", "missing"] as const;
export type Freshness = (typeof FRESHNESS)[number];

const shortStr = (max: number) => z.string().trim().max(max);

/* ─── Actions the concierge may OFFER (the client executes them) ───────────── */

/** Screens the concierge may open. Must match a real expo-router route. */
export const CONCIERGE_SCREENS = [
  "home",
  "hydration",
  "protocol",
  "circle",
  "profile",
  "urine_check",
  "weekly_report",
  "performance_signal",
  "scan",
  "notifications",
  "health_connected",
  "moments",
  "sweat",
  "concierge_memory",
] as const;
export type ConciergeScreenId = (typeof CONCIERGE_SCREENS)[number];

export const CAPABILITIES = [
  "log_hydration",
  "open_screen",
  "start_checkin",
  "set_reminder",
] as const;
export type ConciergeCapability = (typeof CAPABILITIES)[number];

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("log_hydration"),
    /** Only plain water may be proposed; AForce products are never pushed. */
    fluidType: z.literal("water"),
    oz: z.number().int().min(1).max(64),
    label: shortStr(80),
  }),
  z.object({
    type: z.literal("open_screen"),
    screen: z.enum(CONCIERGE_SCREENS),
    label: shortStr(80),
  }),
  z.object({
    type: z.literal("start_checkin"),
    label: shortStr(80),
  }),
  z.object({
    type: z.literal("set_reminder"),
    title: shortStr(80),
    /** Local wall-clock time, HH:MM (24h), in the member's own zone. */
    timeLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    /** Local date YYYY-MM-DD. */
    dateLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    recurrence: z.enum(["once", "daily"]),
    label: shortStr(80),
  }),
]);
export type ConciergeAction = z.infer<typeof ActionSchema>;

/* ─── Client grounding context ────────────────────────────────────────────── */

export const SignalSchema = z.object({
  id: shortStr(40),
  label: shortStr(60),
  value: z.union([z.number(), z.string().max(40)]),
  unit: shortStr(16).optional(),
  provider: shortStr(40).optional(),
  provenance: z.enum(PROVENANCE),
  freshness: z.enum(FRESHNESS),
  observedAtIso: z.string().datetime().optional(),
});

export const ProviderStatusSchema = z.object({
  id: shortStr(40),
  connected: z.boolean(),
  lastSyncIso: z.string().datetime().nullable(),
  freshness: z.enum(FRESHNESS),
});

export const DaySummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  avgScore: z.number().min(0).max(100).nullable(),
  logs: z.number().int().min(0),
  oz: z.number().min(0).nullable(),
});

export const ClientContextSchema = z.object({
  schemaVersion: z.literal(1),
  localTime: z.object({
    iso: z.string().datetime({ offset: true }),
    timeZone: shortStr(64),
    hour: z.number().int().min(0).max(23),
  }),
  locale: shortStr(12),
  demoMode: z.boolean(),
  hydroState: z
    .object({
      score: z.number().min(0).max(100),
      level: z.enum(["PEAK", "BALANCED", "RECOVERING", "DEPLETED"]),
      urgency: z.enum(["calm", "moderate", "high", "critical"]),
      confidence: z.enum(["high", "medium", "low"]).optional(),
      evidence: z.enum(["pending", "building", "ready"]),
      reasons: z.array(shortStr(140)).max(8).optional(),
    })
    .nullable(),
  command: z
    .object({
      action: shortStr(240),
      explanation: shortStr(400),
      urgencyLevel: z.enum(["low", "medium", "high", "critical"]),
      confidence: z.enum(["high", "medium", "low"]).optional(),
      guard: z.enum(["approved", "blocked"]),
    })
    .nullable(),
  intake: z.object({
    ozToday: z.number().min(0),
    ozTarget: z.number().min(0),
    unitsToday: z.number().int().min(0),
    unitsTarget: z.number().int().min(0),
    lastIntakeMinutesAgo: z.number().int().min(0).nullable(),
    provenance: z.enum(PROVENANCE),
  }),
  signals: z.array(SignalSchema).max(24),
  providers: z.array(ProviderStatusSchema).max(10),
  recentDays: z.array(DaySummarySchema).max(14),
  capabilities: z.array(z.enum(CAPABILITIES)).max(CAPABILITIES.length),
  screens: z.array(z.enum(CONCIERGE_SCREENS)).max(CONCIERGE_SCREENS.length),
  /** Member-stated travel/schedule facts for this session (never inferred). */
  stated: z
    .object({
      destination: shortStr(80).optional(),
      destinationTimeZone: shortStr(64).optional(),
      schedule: shortStr(240).optional(),
      constraints: shortStr(240).optional(),
    })
    .optional(),
});
export type ClientContext = z.infer<typeof ClientContextSchema>;

/* ─── Server-owned facts merged into the grounding ─────────────────────────── */

export interface ServerFacts {
  intake: { ozToday: number; ozTarget: number; unitsToday: number; unitsTarget: number } | null;
  weather: {
    tempC: number;
    humidity: number | null;
    city: string | null;
    fetchedAtIso: string;
    freshness: Freshness;
  } | null;
  providerSyncs: Array<{ id: string; fetchedAtIso: string; freshness: Freshness }>;
}

/* ─── Preferences (consent-gated memory) ──────────────────────────────────── */

export const PreferencesSchema = z.object({
  primaryGoal: shortStr(CONCIERGE_PREF_VALUE_MAX_CHARS).nullable().optional(),
  routine: shortStr(CONCIERGE_PREF_VALUE_MAX_CHARS).nullable().optional(),
  tone: z.enum(["rock", "bb", "surge", "sage"]).nullable().optional(),
  notes: z.array(shortStr(CONCIERGE_PREF_VALUE_MAX_CHARS)).max(CONCIERGE_PREF_NOTES_MAX).optional(),
});
export type ConciergePreferences = z.infer<typeof PreferencesSchema>;

export const PutPreferencesBody = z.object({
  /** Explicit consent is REQUIRED to store anything. */
  consent: z.literal(true),
  prefs: PreferencesSchema,
});

/* ─── Request bodies ──────────────────────────────────────────────────────── */

export const MessageRequestBody = z.object({
  conversationId: z.string().uuid().optional(),
  /** Client-generated id; same id twice = same turn (duplicate-tap protection). */
  clientTurnId: z.string().uuid(),
  message: z.string().trim().min(1).max(CONCIERGE_MAX_MESSAGE_CHARS),
  context: ClientContextSchema,
});
export type MessageRequest = z.infer<typeof MessageRequestBody>;

export const BriefingRequestBody = z.object({
  context: ClientContextSchema,
});

/* ─── Model output (JSON schema enforced) ─────────────────────────────────── */

export const RememberSuggestionSchema = z.object({
  key: z.enum(["primaryGoal", "routine", "tone", "note"]),
  value: shortStr(CONCIERGE_PREF_VALUE_MAX_CHARS),
});

export const ModelReplySchema = z
  .object({
    kind: z.enum(["answer", "clarify"]),
    answer: z.string().trim().min(1).max(CONCIERGE_ANSWER_MAX_CHARS),
    nextStep: z.string().trim().max(CONCIERGE_NEXT_STEP_MAX_CHARS).nullable(),
    why: z.string().trim().max(CONCIERGE_WHY_MAX_CHARS).nullable(),
    action: ActionSchema.nullable(),
    remember: RememberSuggestionSchema.nullable(),
    /** Ids from the provided SOURCES list only. */
    sources: z.array(z.string().max(40)).max(8),
  })
  .strict();
export type ModelReply = z.infer<typeof ModelReplySchema>;

/** JSON schema handed to the model (OpenAI structured outputs). */
export const MODEL_REPLY_JSON_SCHEMA = {
  name: "aforce_concierge_reply",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      kind: { type: "string", enum: ["answer", "clarify"] },
      answer: { type: "string" },
      nextStep: { type: ["string", "null"] },
      why: { type: ["string", "null"] },
      action: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["log_hydration"] },
              fluidType: { type: "string", enum: ["water"] },
              oz: { type: "integer" },
              label: { type: "string" },
            },
            required: ["type", "fluidType", "oz", "label"],
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["open_screen"] },
              screen: { type: "string", enum: [...CONCIERGE_SCREENS] },
              label: { type: "string" },
            },
            required: ["type", "screen", "label"],
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["start_checkin"] },
              label: { type: "string" },
            },
            required: ["type", "label"],
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["set_reminder"] },
              title: { type: "string" },
              timeLocal: { type: "string" },
              dateLocal: { type: "string" },
              recurrence: { type: "string", enum: ["once", "daily"] },
              label: { type: "string" },
            },
            required: ["type", "title", "timeLocal", "dateLocal", "recurrence", "label"],
          },
        ],
      },
      remember: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              key: { type: "string", enum: ["primaryGoal", "routine", "tone", "note"] },
              value: { type: "string" },
            },
            required: ["key", "value"],
          },
        ],
      },
      sources: { type: "array", items: { type: "string" } },
    },
    required: ["kind", "answer", "nextStep", "why", "action", "remember", "sources"],
  },
} as const;

/* ─── Assistant turn as stored + returned to the client ───────────────────── */

export interface SourceDescriptor {
  id: string;
  label: string;
  provenance: Provenance | "server";
  freshness: Freshness;
  observedAtIso?: string;
}

export type AssistantTurnStatus = "ok" | "urgent" | "unavailable" | "gated";

export interface AssistantTurn {
  status: AssistantTurnStatus;
  kind: "answer" | "clarify" | "notice";
  answer: string;
  nextStep: string | null;
  why: string | null;
  action: ConciergeAction | null;
  remember: z.infer<typeof RememberSuggestionSchema> | null;
  sources: SourceDescriptor[];
  /** Machine code for the client to map to copy; never shown raw. */
  code?: string;
  /** Model + gate policy stamps for audit (never shown). */
  audit: { model: string | null; gatePolicy: string; attempts: number };
}
