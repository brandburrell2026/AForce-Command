/**
 * Golden WHOOP parity fixtures.
 *
 * These pin the CURRENT (2026-08-03) hand-rolled WHOOP integration's
 * observable contract — endpoints, PKCE/OAuth constants, wire payloads,
 * and the normalized values they must produce. The later kit-backed
 * migration (W3, replacing whoopSnapshot.ts / whoopPkce.ts /
 * whoopTokenManager.ts with `@workspace/health-core`'s provider-kit
 * plumbing) must replay these SAME fixtures through the new
 * implementation and get byte-identical results. If it doesn't, W3 has
 * a regression — not this file.
 *
 * Source of truth for every constant/shape below: read directly off
 * `../../lib/whoopSnapshot.ts`, `../../lib/whoopPkce.ts`,
 * `../../lib/whoopTokenManager.ts`, `../../lib/whoopAuthStateStore.ts`,
 * and `../../routes/whoopOAuth.ts` on 2026-08-03. Do not "fix" a
 * mismatch by editing this file — if a fixture disagrees with the
 * source module, the source module is authoritative; update the
 * fixture to match reality, then re-run the parity suite.
 */

// ─── OAuth / PKCE constants ──────────────────────────────────────────────────

export const WHOOP_AUTHORIZE_ENDPOINT_FIXTURE =
  "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN_ENDPOINT_FIXTURE =
  "https://api.prod.whoop.com/oauth/oauth2/token";
export const WHOOP_API_BASE_FIXTURE = "https://api.prod.whoop.com/developer/v2";

/** Exact scope string WHOOP authorize requests must carry. */
export const WHOOP_SCOPE_FIXTURE =
  "offline read:recovery read:cycles read:sleep read:workout read:profile";

/** WHOOP hard-fails the authorize step on any state length other than 8. */
export const WHOOP_STATE_LENGTH_FIXTURE = 8;
/** 32 random bytes, base64url-encoded, no padding. */
export const WHOOP_VERIFIER_LENGTH_FIXTURE = 43;

/** The exact param set (and only these) on the authorize URL — order not
 *  load-bearing, membership is. Adding/dropping one is an OAuth contract
 *  change WHOOP may reject. */
export const WHOOP_AUTHORIZE_PARAM_KEYS_FIXTURE = [
  "response_type",
  "client_id",
  "redirect_uri",
  "scope",
  "state",
  "code_challenge",
  "code_challenge_method",
].sort();

// ─── Token endpoint wire shapes ──────────────────────────────────────────────

/** A realistic WHOOP token-endpoint response (code exchange or refresh). */
export const WHOOP_TOKEN_RESPONSE_FIXTURE = {
  access_token: "wa_test_access_token_abc123",
  refresh_token: "wa_test_refresh_token_def456",
  expires_in: 3600,
  token_type: "bearer",
  scope: WHOOP_SCOPE_FIXTURE,
} as const;

/** Same, but WHOOP omitted `refresh_token` — the manager must keep the
 *  previously-stored one rather than nulling it out. */
export const WHOOP_TOKEN_RESPONSE_NO_ROTATE_FIXTURE = {
  access_token: "wa_test_access_token_rotated",
  expires_in: 3600,
  token_type: "bearer",
} as const;

// ─── /developer/v2 snapshot payloads ─────────────────────────────────────────
//
// Each collection carries TWO records: index 0 is today's in-progress
// (PENDING_SCORE, score null) record — the shape WHOOP returns while a
// cycle/recovery/sleep is still being computed — and index 1 is the most
// recent SCORED record. `scoreSourceOf` must skip the former and select
// the latter. These are the exact values the expected-snapshot fixture
// below was hand-computed from; do not change one without the other.

export const WHOOP_RECOVERY_FIXTURE = {
  records: [
    { score_state: "PENDING_SCORE", score: null },
    {
      score_state: "SCORED",
      score: {
        recovery_score: 67,
        hrv_rmssd_milli: 52.4,
        resting_heart_rate: 56,
      },
    },
  ],
};

export const WHOOP_CYCLE_FIXTURE = {
  records: [
    { score_state: "PENDING_SCORE", score: null },
    { score_state: "SCORED", score: { strain: 11.8 } },
  ],
};

/** 7h45m in bed, 25m awake -> 7h20m asleep (see WHOOP_EXPECTED_SNAPSHOT). */
export const WHOOP_SLEEP_FIXTURE = {
  records: [
    { score_state: "PENDING_SCORE", score: null },
    {
      score_state: "SCORED",
      score: {
        stage_summary: {
          total_in_bed_time_milli: (7 * 3600 + 45 * 60) * 1000,
          total_awake_time_milli: 25 * 60 * 1000,
        },
      },
    },
  ],
};

/**
 * FLATTENED variant of the same three collections — no `score` wrapper,
 * the metric fields sit directly on the record (score_state still
 * SCORED). `scoreSourceOf`'s `score ?? record` fallback must resolve
 * these identically to the nested shape above. This is the "flattened-
 * shape tolerance" the task calls out explicitly: a v2 response that
 * drops the wrapper object must not silently null every field.
 */
export const WHOOP_RECOVERY_FLATTENED_FIXTURE = {
  records: [
    {
      score_state: "SCORED",
      recovery_score: 67,
      hrv_rmssd_milli: 52.4,
      resting_heart_rate: 56,
    },
  ],
};

export const WHOOP_CYCLE_FLATTENED_FIXTURE = {
  records: [{ score_state: "SCORED", strain: 11.8 }],
};

export const WHOOP_SLEEP_FLATTENED_FIXTURE = {
  records: [
    {
      score_state: "SCORED",
      stage_summary: {
        total_in_bed_time_milli: (7 * 3600 + 45 * 60) * 1000,
        total_awake_time_milli: 25 * 60 * 1000,
      },
    },
  ],
};

/**
 * The normalized `WhoopSnapshot` the nested (and, separately, flattened)
 * fixtures above MUST produce. THE golden parity target for W3.
 *   sleepHoursLastNight = max(0, inBed - awake) / 3.6e6
 *     = ((7*3600+45*60) - 25*60) * 1000 / 3.6e6
 *     = 7 + 20/60 = 7.3333...
 */
export const WHOOP_EXPECTED_SNAPSHOT = {
  recoveryPct: 67,
  strain: 11.8,
  hrvSdnn: 52.4,
  restingHeartRate: 56,
  sleepHoursLastNight: 7 + 20 / 60,
};

// ─── Selection-predicate edge cases ──────────────────────────────────────────
//
// The REAL predicate (`scoreSourceOf` in whoopSnapshot.ts:91) is:
//   r.score_state === "SCORED" || r.score != null
// This is an OR — a non-null `score` object selects a record EVEN IF its
// `score_state` is not "SCORED". The NESTED/FLATTENED fixtures above happen
// to skip their PENDING_SCORE record only because that record's `score` is
// ALSO null there — not because "PENDING_SCORE" is special-cased anywhere in
// the source. Selection is ARRAY-FIRST: `scoreSourceOf` returns the first
// record (in whatever order the collection response lists them) that
// satisfies the predicate — there is no recency/timestamp comparison, despite
// whoopSnapshot.ts's top-of-file comment describing it as picking the
// "freshest" one. Do not read "freshest" as "most recently updated"; read it
// as "first array element that qualifies."

/** A PENDING_SCORE record that nonetheless carries a non-null `score` object
 *  — the OR-predicate selects it despite the PENDING_SCORE label. */
export const WHOOP_RECOVERY_PENDING_WITH_SCORE_FIXTURE = {
  records: [
    {
      score_state: "PENDING_SCORE",
      score: { recovery_score: 81, hrv_rmssd_milli: 40.1, resting_heart_rate: 50 },
    },
  ],
};

export const WHOOP_RECOVERY_PENDING_WITH_SCORE_EXPECTED = {
  recoveryPct: 81,
  hrvSdnn: 40.1,
  restingHeartRate: 50,
};

/** UNSCORABLE: score_state is neither "SCORED" nor is `score` non-null —
 *  must NOT be selected. WHOOP uses this state for a cycle/recovery/sleep
 *  that will never be scored (e.g. too short, or a skipped sleep). */
export const WHOOP_RECOVERY_UNSCORABLE_FIXTURE = {
  records: [{ score_state: "UNSCORABLE", score: null }],
};

/** Every record in every collection is unselectable (PENDING_SCORE and
 *  UNSCORABLE, `score` null in both) — no record anywhere satisfies the
 *  predicate, so the full snapshot must come back null across every field,
 *  matching EMPTY_WHOOP_SNAPSHOT exactly ("no SCORED-or-scored record in the
 *  window" case). */
export const WHOOP_RECOVERY_NO_SCORED_FIXTURE = {
  records: [
    { score_state: "PENDING_SCORE", score: null },
    { score_state: "UNSCORABLE", score: null },
  ],
};
export const WHOOP_CYCLE_NO_SCORED_FIXTURE = {
  records: [
    { score_state: "PENDING_SCORE", score: null },
    { score_state: "UNSCORABLE", score: null },
  ],
};
export const WHOOP_SLEEP_NO_SCORED_FIXTURE = {
  records: [
    { score_state: "PENDING_SCORE", score: null },
    { score_state: "UNSCORABLE", score: null },
  ],
};

// ─── Null/missing-field edge cases against `fetchWhoopSnapshot` ─────────────

/** SCORED sleep record missing `total_awake_time_milli` entirely — the
 *  `num(...) ?? 0` fallback must treat it as zero minutes awake, NOT null
 *  out the whole sleep computation. */
export const WHOOP_SLEEP_NO_AWAKE_FIELD_FIXTURE = {
  records: [
    {
      score_state: "SCORED",
      score: { stage_summary: { total_in_bed_time_milli: 8 * 3600 * 1000 } },
    },
  ],
};
export const WHOOP_SLEEP_NO_AWAKE_FIELD_EXPECTED_HOURS = 8;

/** Malformed record where awake time exceeds in-bed time (a WHOOP data
 *  glitch, not a documented case) — `Math.max(0, inBed - awake)` must clamp
 *  at zero, never go negative. */
export const WHOOP_SLEEP_AWAKE_EXCEEDS_INBED_FIXTURE = {
  records: [
    {
      score_state: "SCORED",
      score: {
        stage_summary: {
          total_in_bed_time_milli: 1 * 3600 * 1000,
          total_awake_time_milli: 2 * 3600 * 1000,
        },
      },
    },
  ],
};

/** `recovery_score` as a string — survives real JSON serialization intact
 *  (unlike NaN, below). `num()` must reject it on the `typeof` guard, never
 *  `Number("67")`-coerce it. */
export const WHOOP_RECOVERY_STRING_SCORE_FIXTURE = {
  records: [{ score_state: "SCORED", score: { recovery_score: "67" } }],
};

/** A `strain` of `NaN`. Real WHOOP JSON can never carry `NaN` (it isn't
 *  valid JSON — `JSON.stringify(NaN)` produces the text `null`), so this
 *  fixture is only meaningful when handed to `res.json()` WITHOUT going
 *  through real JSON-text serialization (see `rawJsonResponse` in the test
 *  file). It exercises `num()`'s `Number.isFinite` guard directly; it is not
 *  a claim that WHOOP's wire format can produce this payload. */
export const WHOOP_CYCLE_NAN_STRAIN_FIXTURE = {
  records: [{ score_state: "SCORED", score: { strain: Number.NaN } }],
};

/** A collection response with no `records` key at all (not even an empty
 *  array) — `scoreSourceOf(collection?.records)` must tolerate `undefined`
 *  rather than throw. */
export const WHOOP_COLLECTION_NO_RECORDS_KEY_FIXTURE = {};

// ─── Route contracts ─────────────────────────────────────────────────────────

/** Exact shape (key set) of GET /whoop/status's 200 JSON body. */
export const WHOOP_STATUS_SHAPE_KEYS_FIXTURE = [
  "credentialsConfigured",
  "connected",
  "expiresAt",
].sort();
