/**
 * Account deletion registry (SS-04, stage 1 of 5).
 *
 * One entry per table in `./schema`, saying what full account deletion does
 * to it. This file is DATA ONLY. Nothing reads it to delete anything yet:
 * the server endpoint that executes it is stage 2 and is not built.
 *
 * The companion test (`__tests__/accountDeletionRegistry.test.ts`) fails when
 * a table is added to the schema without an entry here, or when a table gains
 * a member-id column the entry does not name. That is the point of the file:
 * a new table cannot quietly fall outside account deletion.
 *
 * Founder decisions these dispositions encode (Brandon, 2026-11-18):
 *   1. Deletion is immediate. No grace period.
 *   2. Only billing records are kept.
 *   3. Items shared with other members are removed.
 *   4. Data export ships after deletion (stage 5).
 *
 * Open before stage 2 may run:
 *   - `docs/design/PHASE3-K-RISKS-DECISIONS.md` K-3 is marked [JB]: it needs
 *     Julius as well as Brandon.
 *   - Every key flagged `counselReview` deletes or keeps a row that may carry
 *     a legal retention duty (consent evidence, clinical notes, access audit).
 *     Counsel has not reviewed them.
 */

/** What deletion does to the rows a key selects. */
export type DeletionAction =
  /** Hard delete every row the key selects. */
  | "purge"
  /** Keep the row, set this column to NULL. */
  | "anonymise"
  /** Keep the row unchanged. Requires a `retainReason`. */
  | "retain";

/** The only reasons a row may survive account deletion. */
export type RetainReason =
  /** A billing record (founder decision 2). */
  | "billing"
  /**
   * The row is another member's record; the deleted member only authored or
   * actioned it. The column keeps an opaque id that no longer resolves to a
   * person once the sign-in account is gone.
   */
  | "other_member_record";

export interface DeletionKey {
  /** Column in this table that identifies the member. */
  readonly column: string;
  readonly action: DeletionAction;
  /**
   * How the column is matched.
   *  - `member_id`: column = the deleted member's id (the default).
   *  - `email`: column = the account email, read before `aforce_users` goes.
   *  - `indirect`: column references a parent row named in `via`.
   */
  readonly match?: "member_id" | "email" | "indirect";
  /** For `indirect`: `table.column` of the member-keyed parent. */
  readonly via?: string;
  readonly retainReason?: RetainReason;
  /** A row that may carry a legal retention duty. Not reviewed by counsel. */
  readonly counselReview?: true;
  readonly note?: string;
}

export interface DeletionTableEntry {
  /** Keys that select this member's rows. Empty only with `noMemberData`. */
  readonly keys: readonly DeletionKey[];
  /** Why the table holds nothing tied to a member. */
  readonly noMemberData?: string;
  /** Already handled by `runAccountDeletionCascade` (health-data purge). */
  readonly inHealthCascade?: true;
}

const purge = (column: string, extra: Partial<DeletionKey> = {}): DeletionKey => ({
  column,
  action: "purge",
  ...extra,
});

/** Staff/author column on a row that belongs to another member. */
const authorOf = (column: string): DeletionKey => ({
  column,
  action: "retain",
  retainReason: "other_member_record",
  counselReview: true,
});

const own = (extra: Partial<DeletionTableEntry> = {}): DeletionTableEntry => ({
  keys: [purge("user_id")],
  ...extra,
});

export const ACCOUNT_DELETION_REGISTRY: Readonly<Record<string, DeletionTableEntry>> = {
  // ── The account itself and billing ───────────────────────────────────────
  aforce_users: {
    keys: [
      purge("id", {
        note:
          "The account row. Removed last. Stripe remains the billing system of record; " +
          "stage 3 cancels the subscription and does not delete the Stripe customer.",
      }),
    ],
  },
  aforce_web_entitlements: {
    keys: [
      { column: "user_id", action: "retain", retainReason: "billing" },
      { column: "email", action: "retain", retainReason: "billing", match: "email" },
    ],
  },
  aforce_webhook_deliveries: {
    keys: [],
    noMemberData: "Idempotency record of provider webhook deliveries; no member id or email.",
  },
  aforce_referral_claims: {
    keys: [
      purge("referrer_user_id", { note: "Shared between two members; removed when either leaves." }),
      purge("referee_user_id"),
    ],
  },

  // ── Member state, profile and history ────────────────────────────────────
  // The health cascade only clears the `biometrics` column here; the row itself stays today.
  aforce_user_state: own(),
  aforce_user_profiles: own(),
  aforce_profile_versions: own(),
  aforce_profile_change_log: own(),
  aforce_baseline_versions: own(),
  aforce_privacy: own(),
  aforce_achievements: own(),
  aforce_confirmations: own(),
  aforce_intake_logs: own(),
  aforce_recorded_drinks: own(),
  aforce_score_snapshots: own(),
  aforce_demand_snapshots: own(),
  aforce_hydro_scans: own(),
  aforce_graph_nodes: own(),
  aforce_graph_edges: own(),
  aforce_battles: { keys: [purge("owner_user_id")] },

  // ── Health providers (already in the health-data cascade) ────────────────
  aforce_health_records: own({ inHealthCascade: true }),
  aforce_whoop_tokens: own({ inHealthCascade: true }),
  aforce_whoop_auth_states: own({ inHealthCascade: true }),
  aforce_garmin_tokens: own({ inHealthCascade: true }),
  aforce_garmin_auth_states: own({ inHealthCascade: true }),
  aforce_oura_tokens: own({ inHealthCascade: true }),
  aforce_oura_auth_states: own({ inHealthCascade: true }),
  aforce_strava_tokens: own({ inHealthCascade: true }),
  aforce_strava_auth_states: own({ inHealthCascade: true }),

  // ── Concierge and Spatial Studio (already in the health-data cascade) ────
  aforce_concierge_conversations: own({ inHealthCascade: true }),
  aforce_concierge_messages: own({ inHealthCascade: true }),
  aforce_concierge_preferences: own({ inHealthCascade: true }),
  aforce_spatial_studio_projects: own({ inHealthCascade: true }),

  // ── Analytics ────────────────────────────────────────────────────────────
  aforce_analytics_identities: own(),
  aforce_analytics_consent_state: own(),
  aforce_analytics_consent_events: {
    keys: [purge("user_id", { counselReview: true, note: "Consent evidence ledger." })],
  },
  aforce_analytics_events: {
    keys: [
      purge("analytics_id", {
        match: "indirect",
        via: "aforce_analytics_identities.analytics_id",
        note:
          "Pseudonymous; no member id on the row. Must be read before the identity row is " +
          "removed. Stage 2 has to reconcile this with the existing analytics forget path.",
      }),
    ],
  },

  // ── Travel ───────────────────────────────────────────────────────────────
  aforce_travel_accounts: own(),
  aforce_travel_devices: own(),
  aforce_travel_alerts: own(),

  // ── Circle (shared items are removed: founder decision 3) ────────────────
  aforce_circle_users: { keys: [purge("owner_user_id"), purge("member_user_id")] },
  aforce_circle_statuses: { keys: [purge("owner_user_id"), purge("member_user_id")] },
  aforce_circle_challenges: {
    keys: [purge("owner_user_id"), purge("from_user_id"), purge("to_user_id")],
  },
  aforce_circle_notifications: { keys: [purge("owner_user_id"), purge("from_user_id")] },
  aforce_circle_invitations: {
    keys: [
      purge("owner_user_id"),
      {
        column: "accepted_by_user_id",
        action: "anonymise",
        note: "The invitation belongs to the member who sent it; only the acceptor is cleared.",
      },
    ],
  },
  aforce_circle_sharing_grants: {
    keys: [purge("source_user_id"), purge("recipient_user_id")],
    inHealthCascade: true,
  },
  aforce_circle_moment_shares: {
    keys: [purge("source_user_id"), purge("recipient_user_id")],
    inHealthCascade: true,
  },

  // ── Trainer / athlete programme records ──────────────────────────────────
  aforce_programs: {
    keys: [],
    noMemberData: "Programme name and sport only; membership is in aforce_program_members.",
  },
  aforce_program_members: own(),
  aforce_athlete_consents: { keys: [purge("athlete_user_id")] },
  aforce_athlete_consent_events: {
    keys: [purge("athlete_user_id", { counselReview: true, note: "Consent evidence ledger." })],
  },
  aforce_athlete_availability: {
    keys: [purge("athlete_user_id"), authorOf("set_by_user_id")],
  },
  aforce_athlete_questionnaires: { keys: [purge("athlete_user_id")] },
  aforce_athlete_screenings: {
    keys: [purge("athlete_user_id"), authorOf("screened_by_user_id")],
  },
  aforce_athlete_sessions: {
    keys: [purge("athlete_user_id"), authorOf("entered_by_user_id")],
  },
  aforce_athlete_medical_notes: {
    keys: [
      purge("subject_user_id", { counselReview: true, note: "Clinical note about the member." }),
      authorOf("author_user_id"),
    ],
  },
  aforce_athlete_soap_notes: {
    keys: [
      purge("subject_user_id", { counselReview: true, note: "Clinical note about the member." }),
      authorOf("author_user_id"),
    ],
  },
  aforce_medical_access_log: {
    keys: [
      purge("subject_user_id", {
        counselReview: true,
        note: "Audit of who read this member's medical data.",
      }),
      authorOf("actor_user_id"),
    ],
  },
  aforce_rtp_protocols: { keys: [authorOf("created_by_user_id")] },
  aforce_rtp_progressions: {
    keys: [purge("athlete_user_id"), authorOf("started_by_user_id")],
  },
  aforce_rtp_signoffs: {
    keys: [
      purge("progression_id", {
        match: "indirect",
        via: "aforce_rtp_progressions.athlete_user_id",
        note: "Sign-offs on the deleted athlete's progressions go with the progression.",
      }),
      authorOf("signed_by_user_id"),
    ],
  },

  // ── Marketing (pre-account) ──────────────────────────────────────────────
  early_access_signups: {
    keys: [
      purge("email", {
        match: "email",
        note: "Waitlist row matched on the account email.",
      }),
    ],
  },
  aforce_signup_notifications: {
    keys: [],
    noMemberData:
      "Send queue for early_access_signups; no member id or email, and it cascades from its parent.",
  },
};

/** Column-name pattern that marks a member-id column in the schema. */
export const MEMBER_ID_COLUMN = /(^|_)user_id$/;
