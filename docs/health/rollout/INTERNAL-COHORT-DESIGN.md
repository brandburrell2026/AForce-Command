# Internal Cohort — Server-Authoritative Internal-Preview Design

**Status:** Design. Not built. No code in this PR.
**Owner:** Principal Architect
**Authority:** extends `docs/AFORCE_OS_ARCHITECTURE_V1.md`; does not fork it.
**Governance:** fills the "Future server-side authorization" row that
`governance/AFORCE_OS_NIGHT_OUT_PROTOCOL_SPEC.md` §21 (NO-a.1 record) declared
*not yet implemented*. Consumes, does not replace, `governance/Architecture-Appendix.md`
§62 (Founder Mode & Four-Environment Architecture).
**Off-limits respected:** no design element here requires editing `scoringEngine.ts`,
`statusColor.ts`, `config/hydroStateModel.ts` thresholds, or the camera/HydroState
visual surface.

**Revision — 2026-08-03.** Resolves seven coherence notes from the independent
review of PR #503, plus four factual nits. Every seam cited below was re-verified
against `main` at `62cb59bc` at revision time; line numbers in this document refer
to that commit. The substantive changes:

| Note | Where |
|---|---|
| "Default-empty ⇒ byte-identical" overclaimed the polling delta | §7.1, §7.1.1 (guarantee restated as *flag resolution*; full cost envelope; cached-membership-bit alternative rejected with reasons) |
| Overlay must return `base` by reference | §6.1.1 (normative contract + the test that locks it) |
| TTL expiry had no trigger | §6.4.1 (timer at `expiresAtMs` + synchronous foreground re-check) |
| `providerStages` contract incoherence | §4.5.1 (single authoritative contract: server-side clamp; field removed from the member-facing wire) |
| Connectability formula omitted `integrationReady` | §4.5.2, §4.5.3 (full formula; a grant moves only `apple_health` and `garmin`) |
| §7 vs §10.2 contradiction on Night Out | §7, §10.2 (resolved in favour of §10.2 — Night Out is PR 7 only) |
| CI guard needed a baseline backfill | §9.1 (all 32 existing tables classified; scoped into PR 2) |

**Four decisions remain 🚫 BLOCKED and are deliberately *not* resolved here:**
audit-row retention duration (D-1, counsel), Night Out `internalPreview` widening
(D-2, founder), production `FOUNDER_EMAILS` (D-3), production
`CORS_ALLOWED_ORIGINS` (D-4). See §13.

---

## 1. What this is

A server-authoritative mechanism for granting a named set of internal users early
access to **presentation** of unreleased surfaces — starting with the seven health
providers — without shipping those surfaces to production users, and without
relying on a client toggle as an authorization boundary.

Today the codebase has three concepts, explicitly separated in NO-a.1, with the
third one empty:

| Concept | Mechanism today | Grants access? |
|---|---|---|
| Demo **presentation** capability | `DEMO_ALL_ON_FLAGS` / demo build | No — presentation only |
| Restricted internal-preview **authorization** | `services/nightOut/access.ts` → `isNightOutEnabled(flags, ctx)`; flag AND env-driven `DEMO_MODE` | Yes, only in an approved internal build |
| **Server-side** authorization | **does not exist** | — |

The env-driven tier requires cutting a build. That is why Night Out's Tier-3
native evidence is still blocked (NO-c, spec §27: *"No wired authorized enablement
path exists"*), and it is why health-provider rollout currently has exactly two
states per provider: off for everybody, or on for everybody in the next binary.

This design builds the third tier. It is deliberately the *smallest* thing that
closes that gap.

---

## 2. Seam analysis — how the client actually consumes state today

Everything below was first read on `main` at `48872ec4` and **re-verified against
`main` at `62cb59bc`** during the 2026-08-03 revision; all line numbers cited in
this document refer to `62cb59bc`. Three hazards govern the design.

### Hazard 1 — the drift-gated poll would swallow the overlay

`artifacts/aforce-os/store/useAppStore.tsx` runs a 30-second refresh
(`setInterval(refresh, 30 * 1000)`, line 427). It does **not** adopt the server
snapshot unconditionally. It computes a four-field `drift` predicate (line 404)
and only then swaps state:

```ts
const drift =
  userState.weatherFetchedAt !== current.weatherFetchedAt ||
  userState.unitsConsumedToday !== current.unitsConsumedToday ||
  userState.urineSignal !== current.urineSignal ||
  userState.language !== current.language;
if (drift) {
  applyServerUserState(userState, engineOutput);
} else {
  dispatch({ type: 'REFRESH_ENGINE', payload: { engineOutput } });
}
```

Any **new** field added to the `/state` payload — including an internal-preview
overlay — is invisible to this predicate. A cohort grant issued at 10:00 would
not land until the user happened to drink something, the weather refreshed, the
urine signal changed, or the language changed. A **revoke** would be worse: it
would persist indefinitely until an unrelated field drifted. There is no
"eventually consistent" here; there is "consistent when someone drinks water."

Extending the predicate is the obvious fix and it is the wrong one. The predicate
is a cheap-comparison optimisation over a hot 30-second path; growing it per new
field is how it silently loses the next field too.

The `language` term reads like a field that was added *after* someone noticed it
was missing: the comment above it (lines 408–411) argues for its presence by
describing the symptom of its absence ("without this, the Profile picker on
device A would never reach device B"). **That is an inference from how the comment
is written, not a recorded incident.** No changelog, issue, or commit message in
this repo was consulted to confirm a shipped `language` bug, and none is cited
here. The inference is offered only as a plausibility argument; the structural
point — that a whitelist predicate silently drops fields nobody remembered to add
— stands on the predicate's shape alone and does not depend on it.

**Decision: the overlay does not ride on `/state`.** It gets its own endpoint,
its own fetch cadence, and its own slice of client state. The drift gate is left
exactly as it is.

### Hazard 2 — the WebSocket path is excluded by design

`artifacts/api-server/src/lib/aforceHub.ts` holds the `WebSocketServer` in
`noServer` mode; the upgrade is wired from `src/index.ts`. Consequences:

- The upgrade **bypasses every Express middleware**. `destructiveGuards`'s origin
  allow-list, the rate limiters, `requireRealAuth`, `requireFounder` — none of
  them are on this path. `authenticateUpgrade` does its own Clerk `verifyToken`
  and nothing else.
- With no `CLERK_SECRET_KEY` and `NODE_ENV !== 'production'`, `authenticateUpgrade`
  returns `DEFAULT_USER_ID` for *any* upgrade.
- On the client, `subscribeToStateUpdates` (`services/realApi.ts:622`) feeds every
  push through `applyServerUserState`, whose overlay getter preserves exactly two
  client-only fields — `appleHealth` and `biometrics`. Everything else in the
  payload is treated as server-owned and replaced.

A state broadcast is a reasonable thing to carry over that path. An
**authorization artifact is not.** Delivering grants over WS would mean the one
artifact that decides what an internal user may see is the one artifact that
never passes through the guard stack.

**Decision: the WS path is excluded by design.** No overlay field is ever added
to the WS `state` message, and `applyServerUserState` is not touched. This is a
standing constraint, not an implementation detail — §11 pins it with a test.

The cost is explicit: overlay changes are not pushed. They are pulled, bounded by
the TTL in §6. Worst-case propagation for a revoke is one TTL (15 minutes).

### Hazard 3 — feature flags do not persist

`useAppStore.tsx:143` seeds `featureFlags: DEFAULT_FLAGS`. The only writer is
`SET_FLAGS` (`appStoreReducer.ts:176`), which replaces the whole object. There is
no `AsyncStorage` read or write for flags anywhere in the tree — verified by grep
across `services/` and `utils/`.

**One exception, named so "flags do not persist" is not overread.** Exactly one
flag has an existing server side-channel. `setFeatureFlags`
(`store/app/actions.ts:364-379`) mirrors `clutch_access_enabled` into
`userState.clutchActive` and POSTs it via `postClutchFlag`, with the stated reason
that the engine's decay function needs the ×1.3 multiplier without flags being
drilled into its API. So:

- The **flag object** still resets to `DEFAULT_FLAGS` on every cold start. That is
  unqualified and remains the basis of this design.
- What survives a reload is the **derived `clutchActive` field on `UserState`**,
  which arrives back through the normal `/state` path. It is a mirror of one
  flag's *effect*, not flag storage, and nothing reads it back into `featureFlags`.
- `clutch_access_enabled` is **not** on the overlay allow-list (§6.2) and will not
  be added, so the overlay never reads, writes, or races this channel. Any future
  proposal to allow-list a flag that has a `UserState` mirror must first explain
  how the mirror interacts with a TTL-bounded grant — it is the one shape where
  ON-only (§6.1) does not by itself guarantee a clean revoke, because the mirrored
  field outlives the flag.

Two implications:

1. **Every cold start is `DEFAULT_FLAGS`.** A tester who unlocks something loses
   it on relaunch. Any design that assumes "the flag stays on" is wrong today.
2. **This is a safety property, and the design keeps it.** The overlay is
   *derived*, never merged into the persisted base — because there is no persisted
   base. On cold start with no network, an internal user sees production. That is
   the correct failure direction.

**Decision: no flag persistence is introduced.** The overlay is a separate,
TTL-bounded, in-memory layer composed over `state.featureFlags` at read time.

---

## 3. What does not exist today (missing seams)

| Seam | Exists? | Evidence | Consequence for this design |
|---|---|---|---|
| Server endpoint returning per-user flag state | **No** | no route in `artifacts/api-server/src/routes/` returns flags; `/entitlement` returns plan/status only | must be built (PR 3) |
| Any table keyed on "internal user" / cohort | **No** | `lib/db/src/schema/aforce.ts` — 32 tables, none | must be built (PR 2) |
| Audit trail for an access-control decision | **No** | `aforceProfileChangeLog` is profile-field history, not authorization | must be built (PR 2/4) |
| Global per-provider rollout state | **No** | provider readiness is inferred at runtime per-provider in `utils/health/providerRowStatus.ts` (`credentials_missing`, `garminCredentialsMissing`, hardcoded `integrationReady = false` for oura/strava/google) | must be built (PR 2/5) |
| Founder-only gate on a mutating route | **Yes** | `middlewares/requireFounder.ts`, used 8× in `routes/commandCenterAdmin.ts` | reuse |
| CSRF/origin + limiter + real-auth stack for mutations | **Yes** | `middlewares/destructiveGuards.ts` — its own header: "Guard stack for DESTRUCTIVE endpoints (provider disconnect + account health-data deletion)". The `Lane F5` tag is **not** on this file; it is on `routes/accountDeletion.ts:2` and `lib/providerKit/disconnect.ts:2`, the consumers | reuse (§5.3) |
| Deletion cascade for user-scoped health rows | **Yes, health-scoped only** | `routes/accountDeletion.ts` — explicitly *"HEALTH data only… does NOT delete the user's AForce account itself"* | extend at the account layer, not here (§9) |
| Schema-drift guard that fails CI when a new user-scoped table skips the cascade | **Yes, for providers** | `routes/__tests__/providerDisconnectMounts.test.ts` | extend to cover cohort tables (§9) |
| Restricted-flag clamp on the client unlock | **Yes** | `featureFlags/flags.ts:545` `INTERNAL_PREVIEW_RESTRICTED_FLAGS` + `demoUnlockAllFlags()` | preserved unchanged (§7) |
| Migration files | **No** — `drizzle-kit push` only | `lib/db/package.json` scripts: `push` / `push-force`; zero `.sql` files in repo | see §10 two-database warning |

---

## 4. Data model

Five tables. Four are cohort-scoped; the fifth is global and deliberately not
per-user. Naming, id types (`text`), and `timestamp(..., { withTimezone: true })`
match the house style in `lib/db/src/schema/aforce.ts`.

### 4.1 `aforce_internal_cohorts`

A named group. Cheap to create, never deleted (deactivated instead) so audit rows
always resolve to a name.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | `nanoid`-style, generated app-side (matches house pattern) |
| `slug` | `text` NOT NULL | URL-safe, `^[a-z0-9-]{3,40}$`, **UNIQUE** |
| `name` | `text` NOT NULL | human label, e.g. "Health providers — internal" |
| `description` | `text` | why this cohort exists |
| `active` | `boolean` NOT NULL DEFAULT `true` | `false` ⇒ all grants inert, membership retained |
| `created_by` | `text` NOT NULL | founder Clerk userId |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

Indexes: `unique(slug)`.

### 4.2 `aforce_internal_cohort_members`

| Column | Type | Notes |
|---|---|---|
| `cohort_id` | `text` NOT NULL | → `aforce_internal_cohorts.id` |
| `user_id` | `text` NOT NULL | Clerk userId. **No email, no name.** |
| `added_by` | `text` NOT NULL | founder Clerk userId |
| `added_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `expires_at` | `timestamptz` | NULL = no scheduled expiry; enforced at read time |
| `revoked_at` | `timestamptz` | soft revoke; row survives for audit resolution |

Primary key: `(cohort_id, user_id)`.
Indexes:
- `aforce_internal_cohort_members_user_idx` on `(user_id)` — **the hot path.**
  The read endpoint resolves "which cohorts is *this caller* in" on every poll.
- partial `aforce_internal_cohort_members_live_idx` on `(user_id, cohort_id)`
  `where revoked_at is null` — mirrors the `liveOnlyIdx` pattern already used on
  `aforce_health_records` so the hot read never scans revoked rows.

### 4.3 `aforce_internal_cohort_flag_grants`

| Column | Type | Notes |
|---|---|---|
| `cohort_id` | `text` NOT NULL | → `aforce_internal_cohorts.id` |
| `flag_key` | `text` NOT NULL | must be in the server allow-list (§6.2); validated on write **and** on read |
| `granted_by` | `text` NOT NULL | founder Clerk userId |
| `granted_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `revoked_at` | `timestamptz` | soft revoke |

Primary key: `(cohort_id, flag_key)`.
Index: `aforce_internal_cohort_flag_grants_cohort_idx` on `(cohort_id)`
`where revoked_at is null`.

**There is no `value` column.** A grant is ON-only by construction — see §6.1.
This is not a space optimisation; it is the invariant made unrepresentable in the
schema. A future engineer cannot write `value = false` because the column does
not exist.

### 4.4 `aforce_internal_cohort_audit`

Append-only. No `UPDATE`, no `DELETE` from application code.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | |
| `at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `actor_user_id` | `text` NOT NULL | who performed it (founder) |
| `action` | `text` NOT NULL | `cohort_created` \| `cohort_updated` \| `cohort_deactivated` \| `member_added` \| `member_revoked` \| `member_purged` \| `flag_granted` \| `flag_revoked` \| `stage_changed` |
| `cohort_id` | `text` | NULL for `stage_changed` |
| `subject_user_id` | `text` | the member acted upon, when applicable |
| `flag_key` | `text` | when applicable |
| `provider_id` | `text` | when `action = 'stage_changed'` |
| `detail` | `jsonb` NOT NULL | `{}` default; before/after for stage + expiry changes |

Indexes: `(at desc)`, `(cohort_id, at desc)`, `(subject_user_id, at desc)`.

Retention and the deletion question: §9.

### 4.5 `aforce_provider_rollout_stages` — global, one row per provider

This is the table that keeps a cohort grant honest. Provider readiness is a
**product/legal fact about the world**, not a fact about a user: Garmin's Health
API requires partner approval; Oura, Strava and Google Health have server
adapters but no client OAuth wiring (`utils/health/providerRowStatus.ts:123-133`).
No cohort membership can change any of that.

| Column | Type | Notes |
|---|---|---|
| `provider_id` | `text` PK | one of the seven `HealthProviderId` values in `lib/health-core/src/contracts.ts:26` |
| `stage` | `text` NOT NULL | `blocked` \| `internal` \| `beta` \| `ga` |
| `reason` | `text` | e.g. "partner approval pending" — surfaced to founders, never to users |
| `updated_by` | `text` NOT NULL | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

Seeded with all seven providers at `stage = 'blocked'`, matching the current
`DEFAULT_FLAGS` reality (every `health_*_enabled` is `false`).

**Stage semantics — the clamp:**

| Stage | Base for everyone | Cohort grant honoured? |
|---|---|---|
| `blocked` | OFF | **No — ignored.** A grant cannot manufacture a connection that cannot exist. |
| `internal` | OFF | Yes |
| `beta` | OFF | Yes (reserved; no percentage mechanism is being built — see §12) |
| `ga` | ON | Moot |

#### 4.5.1 Where the clamp runs — the single authoritative contract

**The stage clamp is server-side, applied before serialisation. `providerStages`
is not shipped to the client at all.** This resolves an incoherence in an earlier
draft, which simultaneously described server-side clamping (§5.1) and client-side
stage computation (§4.5), and shipped a `providerStages` map that
`applyInternalPreviewOverlay`'s signature has no parameter to receive.

Three reasons, in order of weight:

1. **`'blocked'` is a value-carrying OFF channel.** §6.1 makes the overlay ON-only
   and §4.3 removes the `value` column so OFF is *unrepresentable in the schema*.
   Shipping a per-provider map whose most common value means "off" reintroduces,
   on the wire, exactly the capability the schema was shaped to forbid. The
   ON-only rule does not cover it, because the rule is about `grants` — and that
   gap is the bug. A future engineer reading `providerStages` on the client will
   eventually branch on `=== 'blocked'` to hide something, and at that moment the
   server can dark a surface. Close the channel instead of writing a rule about it.
2. **It is redundant.** If grants are stage-clamped before serialisation, a
   `blocked` provider's flag never appears in `grants`. The client cannot reach a
   different conclusion from the stage map than it already reaches from the
   absence of the grant. A second source for one decision is a divergence waiting
   to happen, and the divergence resolves in favour of whichever the client reads.
3. **`reason` was already founder-only.** §4.5 states `reason` is "surfaced to
   founders, never to users." Stage and reason are the same fact at two
   resolutions; shipping one to every caller while withholding the other was not
   a coherent boundary.

**Who reads `aforce_provider_rollout_stages`, exhaustively:**

| Reader | Path | Why |
|---|---|---|
| Overlay read endpoint | server-internal, in-process | applies the clamp to `grants` before serialising |
| Founder admin | `GET /api/admin/internal-preview/provider-stages` | operating the rollout; sees `stage` **and** `reason` |
| Audit | `stage_changed` rows | history of the product decision |

No client-facing consumer exists. If one is ever proposed, it must state the
decision it drives that the `grants` list cannot already drive, and it must
justify reopening the OFF channel.

The `ProviderStage` type stays exported from the shared contract module — the
founder admin surface and the server both need it. Only its presence on the
member-facing wire is removed.

#### 4.5.2 Effective connectability — the full formula

The stage/grant computation yields the `enabled` **input** to
`resolveHealthProviderStatus`, which is not the same thing as connectability.
Stating only the first half is what produced this design's misleading lead
example. Both halves:

```
enabledFlag(provider, user) =            // the `enabled` INPUT, nothing more
    stage(provider) == 'ga'
  ∨ (stage(provider) ∈ {'internal','beta'} ∧ userHasLiveGrant(healthFlagFor(provider)))

connectable(provider, user, device) =
    onPlatform(provider, device)
  ∧ link == 'none'
  ∧ enabledFlag(provider, user)
  ∧ integrationReady(provider, device)     ← omitted from the earlier draft
  ∧ approvalOk(provider)
```

Verified against source: `utils/health/healthProviderStatus.ts:155-158` gates the
`connect` return on `input.enabled && input.integrationReady && approvalOk`, where
`approvalOk = !cap.requiresExternalApproval || input.approvalGranted` (line 155).
Anything failing that conjunction falls to line 162 (`approval_pending`) or line
165 (`coming_soon`) — `connectable: false` in both.

`healthFlagFor` is the existing `HEALTH_FLAG_BY_PROVIDER` map
(`utils/health/providerRowStatus.ts:55`).

#### 4.5.3 What a cohort grant actually delivers today — read this before PR 6

**A cohort grant delivers no connectability for `oura`, `strava`, or
`google_health`, and will not until client OAuth wiring lands.**
`deriveProviderRowStatus` hardcodes `integrationReady = false` for all three
(`utils/health/providerRowStatus.ts:123-133`), with the comment: real server
adapters exist, but there is no client OAuth wiring, so "these can never be live
from this screen." Granting `health_oura_enabled` therefore yields
`enabled = true, integrationReady = false, approvalOk = true` → line 165 →
`coming_soon`, `connectable: false`. The row is flag-enabled and looks **exactly
as it does today**. That client OAuth wiring is separate work and is itself
activation-gated; nothing in this document schedules or authorises it.

Traced across all seven providers, a grant changes the resolved status for
**two**:

| Provider | `integrationReady` source | Effect of a grant |
|---|---|---|
| `apple_health` | `!!appleNativeReady` (line 136) | **Real.** On iOS with the native module ready → `connect`. |
| `garmin` | `!garminCredentialsMissing` (line 119), same value drives `approvalGranted` (line 120) | **Real, conditional.** With server credentials present → `connect`; without → `approval_pending` regardless of the grant. |
| `oura` | hardcoded `false` (line 127) | None — `coming_soon`. |
| `strava` | hardcoded `false` (line 127) | None — `coming_soon`. |
| `google_health` | hardcoded `false` (line 131) | None — `coming_soon`. |
| `samsung_health` | n/a | None — short-circuited at `healthProviderStatus.ts:121-126` before `enabled` is read. |
| `whoop` | `whoopState !== 'credentials_missing'` (line 115) | None — `enabled` is hardcoded `true` (line 153, carve-out). |

This recalibrates PR 6. Its user-visible blast radius is not "cohort members can
connect seven providers"; it is "cohort members on iOS may see a working Apple
Health connect path, and — if Garmin credentials are configured — a Garmin one."
Everything else is a no-op the grant cannot fix. **Do not use Oura or Strava as
the demonstration case for this mechanism**; they are the two that prove nothing.

The WHOOP carve-out at line 153 is **not** removed by this design; it is removed
by the provider-kit cutover the comment already references. Until then WHOOP's
stage row exists and is audited but does not gate the row status.

---

## 5. API contract

Base: `https://api.drinkaforce.com/api`. All JSON. All error bodies are
`{ "error": "<snake_case_code>" }`, optionally with `"scope"` — matching the
existing house convention (`{ error: "forbidden" }`, `{ error: "rate_limited", scope }`).

### 5.1 Member-facing read

#### `GET /api/internal-preview/overlay`

- **Auth:** `requireAuth` (Clerk). Attaches `req.userId`.
- **Rate limit:** new `internalPreviewLimiter` in `middlewares/rateLimits.ts`,
  `windowMs: 60_000, limit: 20`, keyed `userOrIpKey`. The client's steady-state
  rate is one request per 5 minutes = **0.2 req/min**; a 20/min ceiling is
  **100× headroom — two orders of magnitude**, not four. Foreground transitions
  and sign-in add bursts on top of the interval, which is part of why the ceiling
  is set well above the steady state rather than just above it; 20/min still
  shapes a runaway retry loop into something harmless.
- **Never 403.** A non-member gets a well-formed empty overlay. Membership must
  not be inferable from a status code, and "you are not in a cohort" is not an error.

**200 response:**

```json
{
  "contractVersion": 1,
  "issuedAt": "2026-08-03T17:02:11.482Z",
  "expiresAt": "2026-08-03T17:17:11.482Z",
  "cohorts": ["health-providers-internal"],
  "grants": ["health_apple_enabled", "health_garmin_enabled"]
}
```

The example deliberately uses `apple_health` and `garmin` — per §4.5.3 they are
the only two providers for which a grant currently changes anything. An example
built on `health_oura_enabled` would depict a grant that resolves to `coming_soon`.

Non-member / no live grants:

```json
{
  "contractVersion": 1,
  "issuedAt": "…",
  "expiresAt": "…",
  "cohorts": [],
  "grants": []
}
```

Field rules:
- `grants` is a **list of flag keys**, never key/value pairs. ON-only is a wire-format property.
- `grants` is filtered server-side against the allow-list (§6.2) *and* the stage
  clamp (§4.5.1) before serialisation. A grant for a `blocked` provider never
  appears on the wire.
- **`providerStages` is not part of this response.** The clamp runs server-side
  and the map is founder-only — see §4.5.1 for the full argument and the
  exhaustive reader list. It remains available at
  `GET /api/admin/internal-preview/provider-stages` behind `requireFounder`.
- This response carries **no OFF-valued field of any kind.** Every field is either
  identity-neutral metadata (`contractVersion`, `issuedAt`, `expiresAt`) or an
  additive list. There is no wire representation of "turn this off", which is what
  makes the ON-only property (§6.1) a property of the protocol and not merely of
  the client's interpretation of it.
- Key order is not guaranteed. Clients must not hash the response body.

**Errors:** `401 unauthorized` · `429 rate_limited` (`scope: "internal_preview"`) ·
`503 auth_unavailable` (Clerk misconfigured in prod) · `500 overlay_unavailable`
(DB read failed — the client treats this as network failure, §8.2).

### 5.2 Founder-facing administration

Mounted at `/api/admin/internal-preview` in `routes/index.ts`, alongside the
existing `commandCenterAdminRouter`. **Every** route below is gated by
`requireFounder`. Every **mutating** route additionally carries the full
`destructiveGuards({ scope: 'internal_preview_admin', limit: 20 })` stack.

| Method + path | Body | 2xx | Errors |
|---|---|---|---|
| `GET /cohorts` | — | `200 { cohorts: CohortSummary[] }` | 403 |
| `POST /cohorts` | `{ slug, name, description? }` | `201 { cohort }` | `409 slug_taken`, `422 invalid_slug` |
| `GET /cohorts/:slug` | — | `200 { cohort, members[], grants[] }` | `404 cohort_not_found` |
| `PATCH /cohorts/:slug` | `{ name?, description?, active? }` | `200 { cohort }` | 404 |
| `POST /cohorts/:slug/members` | `{ userId, expiresAt? }` | `201 { member }` | `404 cohort_not_found`, `409 already_member`, `422 invalid_expiry` |
| `DELETE /cohorts/:slug/members/:userId` | — | `200 { revoked: true }` | `404 member_not_found` |
| `PUT /cohorts/:slug/flags/:flagKey` | — | `200 { grant }` | `422 flag_not_overlayable`, 404 |
| `DELETE /cohorts/:slug/flags/:flagKey` | — | `200 { revoked: true }` | `404 grant_not_found` |
| `GET /provider-stages` | — | `200 { stages: ProviderStageRow[] }` | 403 |
| `PUT /provider-stages/:providerId` | `{ stage, reason? }` | `200 { stage }` | `422 unknown_provider`, `422 invalid_stage` |
| `GET /audit?cohort=&user=&limit=` | — | `200 { entries[], nextCursor }` | 403 |

Shared error codes on every route in this table:
`401 unauthorized` · `403 forbidden` · `403 cross_origin_forbidden` ·
`429 rate_limited` · `503 auth_unavailable` · `500 <operation>_failed`.

`DELETE` is a **soft revoke** everywhere (sets `revoked_at`). Nothing in this
surface hard-deletes. Hard deletion happens only through the account-deletion
cascade (§9).

Every mutation writes exactly one `aforce_internal_cohort_audit` row, in the same
transaction as the mutation. A mutation that cannot be audited must fail.

### 5.3 Why `destructiveGuards`, on routes that are not obviously destructive

`middlewares/destructiveGuards.ts` composes three gates and exports them as one
array specifically so a route cannot pick up two of three: origin allow-list →
per-route limiter → `requireRealAuth` (no dev fallback). Its own header explains
why route-level origin enforcement exists: `app.ts` reflects any origin when
`CORS_ALLOWED_ORIGINS` is unset and `NODE_ENV !== 'production'`, and CORS is a
browser-side gate on *reading the response*, not a server-side gate on
*executing the request*.

Granting a founder-only capability to an arbitrary userId is exactly that class
of request. A credentialed cross-origin `POST …/members` that the browser refuses
to show the attacker has still added the member. Reuse, do not re-derive.

**🚫 BLOCKED — operational preconditions. Both are unconfirmed. PR 4 does not
ship until each is verified in the production environment by someone who can read
it. Neither is resolved by this document, and neither is an engineering decision.**

1. **🚫 BLOCKED — `CORS_ALLOWED_ORIGINS` must be confirmed set in production
   (decision D-4, §13).** The unset-allow-list fallback compares `Origin` against
   `req.headers.host`, which is only trustworthy behind a proxy that pins `Host`.
   *Status: not verified from this design. Owner: whoever holds Railway
   environment access. Verification: confirm the variable is non-empty in the
   production api-server environment — confirming existence is sufficient and no
   value is to be printed or recorded here.*
2. **🚫 BLOCKED — `FOUNDER_EMAILS` must be confirmed set.** With an empty
   allow-list, `isFounderAllowed` admits *any* `super_admin`
   (`middlewares/requireFounder.ts` — "locked down but never hard-bricked"). For a
   capability-granting surface, "any super_admin" is not the intended blast
   radius. *Status: not verified from this design. This is also decision D-3
   (§13) — the roster contents are a founder call, separate from whether the
   variable is set at all.*

**Do not** change `enforceAllowedOrigin` to read `x-forwarded-host`. The
`x-forwarded-host` path is load-bearing for origin derivation in
`routes/checkout.ts` and `routes/stripePortal.ts` and must be preserved there —
but it is a client-supplied header unless the proxy strips it, and reading it in
a security gate converts that gate into a no-op. Different jobs, different headers.

---

## 6. Overlay contract

Four properties. Each exists to kill a specific failure.

### 6.1 ON-only

An overlay may flip a flag `false → true`. It may never flip `true → false`.

```ts
export function applyInternalPreviewOverlay(
  base: FeatureFlags,
  overlay: InternalPreviewOverlay | null,
  nowMs: number,
): FeatureFlags;
```

Implementation is a union, not a merge: for each key in `overlay.grants` that
survives allow-list and TTL checks, set `true`. Nothing else is written.

#### 6.1.1 Reference-identity contract — normative

> **Contract:** `applyInternalPreviewOverlay` MUST return the `base` argument
> **by reference** (`result === base`) whenever it would produce no change. It
> allocates a new object **only** when at least one key actually flips
> `false → true`. It never mutates `base`.

The no-change cases, exhaustively — each MUST return `base` itself:

| Case | Condition |
|---|---|
| No overlay | `overlay === null` |
| Expired | `nowMs >= overlay.expiresAtMs` |
| Contract mismatch | `overlay.contractVersion !== OVERLAY_CONTRACT_VERSION` |
| Empty after filtering | no granted key survives the allow-list |
| Already on | every surviving granted key is already `true` in `base` |

**This is a performance-correctness requirement, not a micro-optimisation, and it
is what makes the §7 guarantee true.** The `useMemo` deps are
`[state.featureFlags, internalPreview.overlay]`. A successful poll parses a fresh
JSON object, so `internalPreview.overlay` is a **new reference every 5 minutes
even when its contents are byte-identical**. The memo therefore recomputes on
every poll, for every signed-in user. If the function allocated `{ ...base }` on
each call, `effectiveFlags` would change identity every 5 minutes and every
consumer of the store's context value would re-render on a timer — including the
~100% of users who are not cohort members. Identity return makes the recomputation
yield the same reference, so React's referential bail-out holds and the re-render
never happens.

Two corollaries that are easy to get wrong and must be honoured:

1. **A non-member stores `overlay: null`, not an empty overlay object.** When the
   server returns `grants: []`, the client sets `status: 'none'` and
   `overlay: null`. The dep is then `null` on every poll, unchanged, so the memo
   does not even recompute. This is strictly stronger than relying on the identity
   return, and it is the path the overwhelming majority of users take.
2. **The context value itself must be memoized.** An identity-stable
   `effectiveFlags` buys nothing if it is spread into a fresh
   `value={{ ...others, effectiveFlags }}` on every render. Whatever memoization
   `useAppStore`'s context value already uses must include `effectiveFlags` as a
   dependency and must not be bypassed by adding it.

**The test that locks it** — assert identity with `toBe`, never `toEqual`, since
`toEqual` passes for a structurally-equal copy and would let the regression
through:

```ts
it('returns base BY REFERENCE when there is nothing to apply', () => {
  expect(applyInternalPreviewOverlay(base, null, now)).toBe(base);
  expect(applyInternalPreviewOverlay(base, expiredOverlay, now)).toBe(base);
  expect(applyInternalPreviewOverlay(base, wrongVersionOverlay, now)).toBe(base);
  expect(applyInternalPreviewOverlay(base, emptyGrantsOverlay, now)).toBe(base);
  expect(applyInternalPreviewOverlay(base, onlyUnknownKeysOverlay, now)).toBe(base);
  expect(applyInternalPreviewOverlay(alreadyOn, grantsSameKeyOverlay, now)).toBe(alreadyOn);
});

it('allocates a new object only on a real flip, and never mutates base', () => {
  const result = applyInternalPreviewOverlay(base, liveGrantOverlay, now);
  expect(result).not.toBe(base);
  expect(result.health_apple_enabled).toBe(true);
  expect(base.health_apple_enabled).toBe(false); // input untouched
});
```

A companion test at the hook level asserts that two consecutive successful polls
returning identical content produce an identity-stable `effectiveFlags`.

**The strongest argument against:** you want a kill switch. A bad internal build
is exactly when you want to remotely dark a surface.

**Why it loses:** a mechanism that can turn production flags off is a mechanism
that, if compromised or fat-fingered, can dark the shipped product for everyone
holding a grant — and the revoke path already gives you the kill you actually
need. Revoking the grant returns the surface to its production default within one
TTL, with an audit row, without ever giving the overlay authority over
`DEFAULT_FLAGS`. A true production kill switch is a different system with
different review requirements; conflating them buys a 15-minute latency
improvement for an unbounded blast radius.

### 6.2 Allow-listed

A new pure module, shared by client and server:

```ts
// artifacts/aforce-os/featureFlags/internalPreviewOverlay.ts
export const INTERNAL_PREVIEW_OVERLAYABLE_FLAGS = [
  'health_apple_enabled',
  'health_google_connect_enabled',
  'health_whoop_enabled',
  'health_oura_enabled',
  'health_strava_enabled',
  'health_garmin_enabled',
  'health_samsung_direct_enabled',
  'health_canonical_consumers', // 🚫 pending D-5 (§13) — ship PR 1 without this
                                //    key if the decision is outstanding; adding
                                //    it later is not a version bump (§6.3).
  'night_out_enabled',          // listed so PR 7 needs no contract change; it has
                                //    NO consumer until PR 7, which is 🚫 D-2.
] as const;
```

Enforced **three times**, on purpose:
1. On write (`PUT …/flags/:flagKey` → `422 flag_not_overlayable`).
2. On read, before serialisation — so a row written by a future direct-SQL edit
   still cannot reach a client.
3. On the client, inside `applyInternalPreviewOverlay` — so a compromised or
   rolled-forward server cannot set a flag this binary never intended to expose.

Anything not on the list is unreachable through this mechanism. Notably absent
and staying absent: `demo_mode_enabled`, `scoreFromLedgerHybrid`,
`spec_section20_calibration`, `native_tabs_enabled`, `native_screens_enabled`,
`secure_store_startup_guard`. The last three are crash-safety gates, not product
toggles; the first two carry Score-Protection or investor-representation
consequences and must not be remotely flippable.

**Relationship to `INTERNAL_PREVIEW_RESTRICTED_FLAGS`.** These lists are
different and both stay. `INTERNAL_PREVIEW_RESTRICTED_FLAGS = ['night_out_enabled']`
(`featureFlags/flags.ts:545`) and its clamp in `demoUnlockAllFlags()` are
**unchanged**. The relationship is:

- `demoUnlockAllFlags()` clamps restricted flags to `false` — the *client unlock*
  can never set them. Unchanged.
- The overlay is applied **after** that clamp, as a separate derived layer.
- Therefore the server overlay becomes the *only* writer that can set a restricted
  flag. That is precisely the authoritative boundary NO-a.1 anticipated.

A test must pin the invariant: for every `k ∈ INTERNAL_PREVIEW_RESTRICTED_FLAGS`,
`demoUnlockAllFlags()[k] === false`, and `k` is settable only via
`applyInternalPreviewOverlay`.

### 6.3 Versioned

`contractVersion: number` on every response. The client declares
`OVERLAY_CONTRACT_VERSION = 1` and:

- `server.contractVersion === client` → apply.
- `server.contractVersion > client` (server rolled forward, app is old) →
  **discard the entire overlay**, `status: 'contract_mismatch'`, fall back to base
  flags. Not "apply the parts I understand" — a semantic change to what a grant
  *means* is exactly what a version bump signals.
- `server.contractVersion < client` (unexpected) → discard, same path.

Version bumps are reserved for semantic changes to grant evaluation. Adding a new
key to `INTERNAL_PREVIEW_OVERLAYABLE_FLAGS` is **not** a version bump — an older
client already drops unknown keys (§8.2, partial).

### 6.4 15-minute TTL

`expiresAt = issuedAt + 15 min`, stamped server-side.

- A revoke reaches the affected user within 15 minutes with **zero** push
  infrastructure — which is what lets us exclude the WS path (§2, Hazard 2).
- A response captured off the wire is worthless after 15 minutes.
- Client polls every **5 minutes** while foregrounded, plus on foreground
  transition and on sign-in. Three refresh opportunities per TTL, so one dropped
  request never darkens a session.
- **The TTL is never extended on failure.** If refresh fails, the existing overlay
  runs out and the user falls back to production behaviour. Fail-closed is the
  whole point; "keep the last good overlay because we're offline" is how an
  expired grant survives a revocation.
- TTL is evaluated against elapsed time since receipt (`Date.now()` delta captured
  at parse), not against a comparison of `expiresAt` to the device wall clock.
  A device with a skewed clock must not get an infinite or zero-length grant.

#### 6.4.1 What makes expiry actually happen — the trigger

An earlier draft asserted that the overlay expires at `expiresAtMs` but specified
nothing that **recomputes** at that moment. `expiresAtMs` is inert data; the
`useMemo` in §7 recomputes only when `state.featureFlags` or
`internalPreview.overlay` changes identity, and neither changes merely because
time passed. Without a trigger, an expired overlay would keep rendering until the
next successful fetch happened to replace it — and if the device is offline, that
is unbounded. **That is precisely the revocation-survival failure §6.4 forbids and
§11 lists as a controlled threat**, reintroduced by omission.

**Design: a single timer scheduled at the expiry instant, plus a foreground
re-check.** Both are required; neither alone is sufficient.

**1. The timer.** Whenever an overlay is stored with `status: 'active'`, the hook
schedules exactly one timeout:

```ts
// inside useInternalPreviewOverlay, after a successful parse
clearTimeout(expiryTimerRef.current);
expiryTimerRef.current = setTimeout(
  () => dispatchOverlay({ status: 'expired', overlay: null }),
  Math.max(0, overlay.expiresAtMs - Date.now()),
);
```

Rules:
- **One timer, always cleared before rescheduling.** Cleared on every successful
  fetch, on sign-out, on `401`, and on unmount. A leaked timer that fires after
  unmount is a state update on a dead component; a duplicated timer double-fires
  a transition that must be idempotent anyway.
- **It sets `overlay: null`, not merely `status: 'expired'`.** This is what closes
  the loop with §6.1.1: nulling the overlay changes the `useMemo` dep, forcing one
  recomputation, which returns `base` **by reference** — restoring the exact
  production flag object, not a structural copy of it. Setting only `status` would
  leave the dep unchanged and the stale value on screen, which is the bug.
- **Exactly one re-render, at the moment semantics change.** No polling, no
  interval, no per-second tick.
- Delay is bounded by the 15-minute TTL, so there is no 32-bit `setTimeout`
  overflow concern; `Math.max(0, …)` covers a response that is already expired on
  arrival (clock skew or a slow network), which expires on the next tick rather
  than scheduling a negative delay.

**2. The foreground re-check — why the timer alone is not enough.** React Native
suspends and coalesces JS timers while the app is backgrounded; a `setTimeout`
scheduled for 12 minutes out will not reliably fire on time if the app spends
those 12 minutes in the background, and on iOS the JS thread may be fully halted.
The app could therefore foreground with a long-expired overlay and render one
frame from it before the timer catches up. So the `AppState` handler that already
exists for refresh (§7, modelled on `useEntitlement.ts:149`) additionally performs
a **synchronous** check *before* issuing the refetch:

```ts
// AppState -> 'active'
if (overlayRef.current && Date.now() >= overlayRef.current.expiresAtMs) {
  dispatchOverlay({ status: 'expired', overlay: null }); // synchronous, pre-paint
}
void refresh();
```

Expiring synchronously on the foreground transition — rather than waiting for the
refetch to resolve — means the first painted frame after foregrounding never shows
a lapsed grant. The refetch then restores the overlay if the grant is still live,
which costs a cohort member a brief flash of production state on resume. That
trade is correct and deliberate: fail-closed beats flicker-free.

**Division of responsibility, stated so neither half is later deleted as
redundant:** `applyInternalPreviewOverlay` remains fail-closed on its own — it
checks `nowMs >= overlay.expiresAtMs` and returns `base` by reference, so any
*fresh* computation is correct regardless of timers. The timer and the foreground
check exist to guarantee a fresh computation *occurs* at the right moment. The
pure function owns **correctness of the value**; the trigger owns **timeliness of
the render**. A missed trigger therefore degrades to "stale render until the next
poll" rather than "expired grant honoured" — but it still degrades, which is why
the trigger is specified and tested, not left implicit.

**Tests:** with fake timers, advance past `expiresAtMs` and assert the status
transitions to `expired`, `overlay` becomes `null`, and `effectiveFlags` is
reference-identical to `state.featureFlags`; assert a background→foreground
transition with a stale overlay expires it before any refetch resolves; assert the
timer is cleared on unmount and on sign-out.

---

## 7. Client state shape

New slice, **not** in `UserState`, **not** in the reducer's `featureFlags`:

```ts
// artifacts/aforce-os/featureFlags/internalPreviewOverlay.ts
export type OverlayableFlagKey = (typeof INTERNAL_PREVIEW_OVERLAYABLE_FLAGS)[number];
export type ProviderStage = 'blocked' | 'internal' | 'beta' | 'ga';

export interface InternalPreviewOverlay {
  contractVersion: number;
  /** ms epoch, captured from the response at parse time. */
  receivedAtMs: number;
  /** ms epoch derived from (receivedAtMs + serverTtlMs). Never raw expiresAt. */
  expiresAtMs: number;
  cohorts: readonly string[];
  grants: readonly OverlayableFlagKey[];
  // NO providerStages. The stage clamp is server-side and the map is
  // founder-only — §4.5.1. `ProviderStage` is still exported from this module
  // for the admin surface and the server; it just never lands here.
}

export interface InternalPreviewState {
  status:
    | 'idle'              // not signed in / never fetched
    | 'loading'
    | 'active'            // overlay held, not expired
    | 'none'              // fetched OK, caller is not in any cohort
    | 'expired'           // TTL elapsed, refresh not yet succeeded
    | 'contract_mismatch' // §6.3 — hard fallback to base
    | 'unavailable';      // network/server error, no usable overlay
  overlay: InternalPreviewOverlay | null;
  lastFetchAtMs: number | null;
  lastError: 'network' | 'unauthorized' | 'server' | 'contract' | null;
  /** Count of grant keys the server sent that this binary does not know. Telemetry only. */
  unknownGrantCount: number;
}
```

Effective flags are **derived at read time**, never written back:

```ts
const effectiveFlags = useMemo(
  () => applyInternalPreviewOverlay(state.featureFlags, internalPreview.overlay, Date.now()),
  [state.featureFlags, internalPreview.overlay],
);
```

Exposed from `useAppStore`'s context value as `effectiveFlags`. `state.featureFlags`
stays exactly what it is today, so `SET_FLAGS` (developer unlock, demo profile) and
the overlay can never clobber each other — they occupy different layers and are
composed, in a fixed order, in one place.

**Consumers migrate deliberately, not globally.** In the first pass **only
`utils/health/providerRowStatus.ts`'s callers** read `effectiveFlags`. Every other
`state.featureFlags` read is left alone. A repo-wide swap would silently put ~200
call sites behind a network-dependent value.

**The Night Out access resolver is explicitly NOT in the first pass.** An earlier
draft listed it here, contradicting §10.2, which states that PRs 1–6 do not touch
Night Out. **§10.2 governs.** `services/nightOut/access.ts` is touched only by
PR 7, which is founder-gated on decision D-2 (§13) because widening the
`internalPreview` context is an amendment to NO-a.1 / NO-10, not an implementation
detail. Nothing in PRs 1–6 may import from, modify, or change the behaviour of the
Night Out resolver, and `night_out_enabled` — although present on the §6.2
allow-list so that PR 7 needs no contract change — has no consumer of
`effectiveFlags` until PR 7 ships.

Fetch lives in a dedicated hook, `hooks/useInternalPreviewOverlay.ts`, modelled on
`hooks/useEntitlement.ts` — which already solves this exact shape correctly:
deferred until `isSignedIn` (line 110), interval + `AppState` foreground refresh
(lines 146-156), and a monotonic `requestIdRef` that drops out-of-order responses
(lines 107, 111, 118). Copy that structure; do not invent a second one.

### 7.1 The default-empty guarantee, stated honestly

An earlier draft claimed a non-member's experience is "byte-identical" to a build
without this feature. **That claim was false as written**, and the falsehood was
load-bearing rather than cosmetic: the hook polls for **every signed-in user**,
member or not — 5-minute interval, plus every foreground transition, plus sign-in.
A user in no cohort still issues those requests. That is real network traffic, real
battery, and real server QPS that a build without this feature does not spend. A
guarantee that quietly excludes the cost it imposes is not a guarantee.

**The corrected guarantee — this is the one that is defended and tested:**

> **Flag resolution is byte-identical.** For a signed-in user with no live grant,
> `effectiveFlags` is **reference-identical** to `state.featureFlags` (§6.1.1).
> No rendered surface, no persisted value, no engine input, no analytics event,
> and no scoring input differs by a single bit from a build without this feature.
> The overlay cannot turn anything off (§6.1), and for a non-member it turns
> nothing on.
>
> **Network behaviour is not identical, and here is the delta.** One additional
> HTTPS GET per 5-minute foreground interval, plus one per foreground transition
> and one per sign-in, for every signed-in user.

#### 7.1.1 Cost envelope — owning the delta

**Client / battery.**

- The interval is a JS `setInterval` that **runs only while foregrounded**. There
  is no background fetch, no `BGTaskScheduler` registration, no push wake, and no
  wake lock. A backgrounded app issues zero overlay requests.
- The request is a bare authenticated GET; the response is a small JSON object
  (~200 bytes for a non-member, ~400 bytes for a member — the object is 5 fields
  and two short arrays now that `providerStages` is gone, §4.5.1).
- **The decisive comparison:** `store/useAppStore.tsx:427` already runs
  `setInterval(refresh, 30 * 1000)` — a `/state` poll, on every signed-in
  foregrounded client, **today**, with a materially larger response. The overlay
  poll at 5 minutes is **one tenth that frequency**. The marginal radio cost is
  ~10% on top of an existing continuous poll, on a radio that is already awake
  because the screen is on and the 30-second poll is running. This is below the
  threshold at which battery instrumentation can distinguish it from noise.
- `hooks/useEntitlement.ts` independently polls at 60s (`REFETCH_INTERVAL_MS`,
  line 45) for every signed-in user. The overlay is **one fifth** of that, and
  that precedent is already accepted in production.

**Server.**

- Per user per day, assuming ~5 foreground sessions totalling ~15 foreground
  minutes for a hydration app: ~5 foreground-transition fetches + ~3 interval
  ticks + ~1 sign-in ≈ **9 requests/user/day**.
- At 10k DAU: ~90k req/day ≈ **1.0 req/s average**, peaking perhaps 10× at diurnal
  peak ≈ 10 req/s. Egress ≈ 90k × 300 B ≈ **27 MB/day**.
- **Per-request DB work for a non-member is one index probe returning zero rows**,
  against the partial index `aforce_internal_cohort_members_live_idx` on
  `(user_id, cohort_id) where revoked_at is null` (§4.2). No join is reached,
  because there are no membership rows to join grants against.
- The provider-stage table (7 rows, global, changes on founder action only) is
  read into a process-level cache with a short TTL, not queried per request. It
  never appears in the hot path.
- Net: a non-member request is auth-verify + one empty index probe + a ~200-byte
  serialise. It is cheaper than the `/state` request that the same client is
  already issuing ten times as often.

**Why not gate the poll on a cached membership bit** — the alternative the review
offered, and the one this design rejects:

1. **It cannot remove the poll, only slow it.** A newly-added cohort member has no
   cached bit by definition. Gating on the bit means the grant never arrives, so
   you must retain a slow-path poll for everyone anyway. The bit converts one
   cadence into two and buys a fraction of an already-negligible cost.
2. **It requires persisting a membership fact on device.** §2 Hazard 3 establishes
   that nothing about this mechanism persists, and treats that as a *safety*
   property — cold start with no network yields production behaviour. A persisted
   "I am a member" bit is durable state that survives reinstall-less relaunch,
   must be invalidated on sign-out and user switch, and becomes a new revocation
   surface with its own staleness bugs. It trades a measured, trivial cost for an
   unmeasured correctness risk in exactly the area (revocation) this design is
   built to get right.
3. **It creates an on-device inference surface.** §11 is deliberate that
   membership must not be inferable — non-members get `200`, never `403`. A
   persisted flag on disk saying "this user is internal" is precisely the artifact
   that boundary avoids.

**Recommendation: ship the ungated poll and own the delta above.** The strongest
argument against is that this design adds recurring cost for a feature ~100% of
users will never use, and that "it's small" is how systems accumulate a thousand
small polls. That argument is real and it is why the envelope is written down here
rather than waved at — but it loses on the specific numbers: the marginal cost is
10% of a poll this app already runs, the alternative does not eliminate the poll,
and the alternative's price is durable on-device membership state that weakens the
revocation and non-inferability properties that are the entire point of building a
server-authoritative tier. **If the poll's cost ever becomes non-trivial, the
correct fix is to lengthen the interval or fold the fetch into an existing
authenticated round trip — not to persist membership on the client.** Note that
"fold into `/state`" is *not* available: §2 Hazard 1 excludes it, and that
exclusion is not reopened by cost pressure.

A test pins the guarantee: for a user with no grants, `effectiveFlags` is `toBe`
(not `toEqual`) `state.featureFlags` across at least two poll cycles.

---

## 8. Failure modes

### 8.1 Offline

| Situation | Behaviour |
|---|---|
| Cold start, offline, internal user | `DEFAULT_FLAGS` only. Flags do not persist (§2 H3), so this is already true today. Internal user sees production. Correct. |
| Warm, goes offline with a live overlay | Overlay honoured until `expiresAtMs`, at which point **the expiry timer (§6.4.1) fires**, sets `overlay: null`, `status: 'expired'`, and surfaces drop to base. Never extended. Expiry does **not** wait for a successful fetch — that is the whole point of the timer. |
| Offline > 15 min inside a gated screen | The timer fires on schedule while the app is foregrounded, so the screen drops at `expiresAtMs`, not "at the next flag read". Gated screens must tolerate this — see §8.4. |
| Backgrounded across the expiry instant | RN suspends JS timers, so the timer may fire late. The synchronous foreground re-check (§6.4.1) expires the overlay **before the first painted frame** on resume. |
| Back online | Next poll (≤ 5 min) or the foreground transition restores it. |

### 8.2 Partial / malformed

| Situation | Behaviour |
|---|---|
| `grants` contains a key not in this binary's allow-list | Drop that key, keep the rest, increment `unknownGrantCount`. Never throw. Forward compatibility. |
| Every key in `grants` is unknown to this binary | Nothing survives filtering ⇒ `applyInternalPreviewOverlay` returns `base` by reference (§6.1.1). Store `overlay: null`, `status: 'none'`. |
| A `providerStages` field is present on the response | **Ignore it.** It is not part of the contract (§4.5.1). An older server, or a server rolled forward past a future re-addition, must not be able to reintroduce a client-read OFF channel by sending the field. The parser drops unknown top-level keys; this one is called out because it existed in an earlier draft and a stale server could still emit it. |
| `contractVersion` mismatch | Discard the whole overlay (§6.3). |
| Response is not valid JSON / shape check fails | `status: 'unavailable'`, `lastError: 'server'`, keep any existing non-expired overlay until its own TTL. A malformed response is not a revoke. |
| `500 overlay_unavailable` | Same as network failure. |
| `401` | Clear overlay immediately, `status: 'idle'`. Auth loss *is* a revoke. |

### 8.3 Races

| Race | Resolution |
|---|---|
| Two overlay fetches in flight (5-min tick vs. foreground wake) | Monotonic `requestIdRef`; a response whose id is stale is dropped. Same guard as `useEntitlement.ts:107`. |
| Overlay response lands after sign-out or user switch | Response carries no userId, so the guard is: capture the Clerk `userId` at request time, compare on resolve, discard on mismatch. |
| Grant revoked while a gated screen is mounted | Two independent paths reach the same end: the next poll (≤ 5 min) returns the grant absent, or — if no poll succeeds — the expiry timer (§6.4.1) fires at `expiresAtMs`. Worst case is one TTL, guaranteed by the timer rather than by a fetch happening to occur. **No in-flight destructive or money-path operation may be gated by an overlay flag** — see §12 non-goals. |
| Expiry timer fires while a refetch is in flight | Both are idempotent toward the same state. The timer sets `overlay: null`; the in-flight response, if it arrives and still passes the `requestIdRef` and userId guards, installs a fresh overlay with a new `expiresAtMs` and reschedules the timer. Ordering is safe in both directions: timer-then-response restores a live grant, response-then-timer is cancelled by the reschedule. |
| `SET_FLAGS` (developer unlock) fires while an overlay is held | No conflict by construction: separate layers, composed at read time, base first then overlay. |
| Founder revokes a member and grants a flag concurrently | Both are single-row writes in their own transactions with their own audit rows. The read endpoint resolves membership and grants in one query at a single snapshot, so a client never observes half of a two-step admin action within one response — it may observe them across two polls, which is acceptable and monotone. |
| Stage changed to `blocked` while grants exist | Read-time clamp (§4.5) means the grant simply stops appearing on the wire. No grant rows are touched; restoring the stage restores the grant. |
| Device clock jumps | TTL is elapsed-time based (§6.4), so a clock jump cannot extend a grant. |

### 8.4 Consequences for gated surfaces

Any surface gated on an overlay flag must satisfy:
1. It can unmount at any moment without data loss.
2. It performs no irreversible operation whose completion depends on the flag
   still being on.
3. Its absence renders as the normal production state, never as an error or an
   empty "something went wrong."

For the health-provider rows this is already satisfied: `deriveProviderRowStatus`
returns an honest status for `enabled === false` and the resolver's ordering rule
is that *a real existing link always wins* — so if a cohort member connects Oura
during a preview and the grant later lapses, the connected state is not erased by
the flag going off. Verify this per-surface before adding it to the allow-list.

---

## 9. Deletion cascade and audit retention

### 9.1 What must be deleted

`routes/accountDeletion.ts` is explicitly **health-scoped**: it deletes provider
tokens, in-flight OAuth auth-state rows, `aforce_user_state.biometrics`, and
canonical health records — and its own header states it *"does NOT delete the
user's AForce account itself."*

Cohort membership is not health data. It does not belong in
`POST /api/account/delete-health-data`, and adding it there would blur a scope
line that route defends deliberately.

**Recommendation:**

1. **Now (PR 2):** extend the schema-drift guard in
   `routes/__tests__/providerDisconnectMounts.test.ts` (or a sibling) so that any
   new table carrying a `user_id` column fails CI unless it is listed in an
   explicit `USER_SCOPED_TABLES` registry with a declared deletion disposition:
   `purge` | `retain_audit` | `health_cascade`. `aforce_internal_cohort_members`
   registers as `purge`; `aforce_internal_cohort_audit` registers as
   `retain_audit`. This is the structural fix — the existing guard already caught
   the equivalent class of bug for provider cursors (that file's header: the
   schema-drift assertion exists so that "adding a sync-cursor / sync-state table
   without extending the cascade turns this red").

   **A guard that fails on new tables is only meaningful if the existing tables
   are already classified.** Introduced against an empty registry, every one of
   today's tables is implicitly unclassified and the guard asserts nothing about
   them — it merely taxes the next table. **PR 2 must therefore include a
   baseline backfill of `lib/db/src/schema/aforce.ts`, and PR 2's description must
   scope it explicitly.** Verified against the current schema file:

   | Group | Count | Disposition | Notes |
   |---|---|---|---|
   | Literal `user_id` column | **24** | one of the three values, declared per table | `aforce_user_state`, `aforce_intake_logs`, `aforce_score_snapshots`, `aforce_confirmations`, `aforce_achievements`, `aforce_privacy`, `aforce_hydro_scans`, `aforce_demand_snapshots`, `aforce_{whoop,garmin,oura,strava}_tokens`, `aforce_{whoop,garmin,oura,strava}_auth_states`, `aforce_user_profiles`, `aforce_profile_versions`, `aforce_baseline_versions`, `aforce_profile_change_log`, `aforce_graph_nodes`, `aforce_graph_edges`, `aforce_web_entitlements`, `aforce_health_records` |
   | **Aliased** user columns | **6** | must be classified, and the detector must see them | `aforce_referral_claims` (`referrer_user_id`, `referee_user_id`), `aforce_battles` (`owner_user_id`), `aforce_circle_users`, `aforce_circle_statuses`, `aforce_circle_challenges`, `aforce_circle_notifications` (`owner_user_id` / `member_user_id` / `from_user_id` / `to_user_id`) |
   | Neither | **2** | explicit exemption with a stated reason | `aforce_users` (PK `id` **is** the user), `aforce_analytics_events` (pseudonymous `analytics_id`, no `user_id`) |

   Total 32 tables, matching §3. Three requirements fall out of that table and
   each must be in PR 2:

   - **The detector must match `%_user_id` and `user_id`, not just `user_id`.**
     A guard keyed on the exact string `user_id` is blind to all six circle and
     referral tables — the largest cluster of user-scoped rows outside health —
     and would ship a green suite that proves nothing about them. This is the
     same failure mode the guard exists to prevent, one level up.
   - **Exemptions are entries, not absences.** `aforce_users` and
     `aforce_analytics_events` are listed with an `exempt` disposition and a
     reason string. A table that is simply missing from the registry fails CI;
     there is no silent pass.
   - **Backfilling a disposition is not the same as implementing it.** PR 2
     records what *should* happen to each table on account deletion. It wires no
     new deletion behaviour — the full-account-delete endpoint (step 2 below)
     consumes the registry. Declaring `purge` for a table that nothing yet purges
     is the intended intermediate state, and the registry is the specification
     that endpoint will be built against. **PR 2's description must say this
     plainly**, or a reviewer will reasonably read the registry as a claim that
     deletion already works.
2. **When the full-account-delete endpoint is built:** it hard-deletes all
   `aforce_internal_cohort_members` rows for the user (`purge`), writes one
   `member_purged` audit row per affected cohort, and calls the existing
   health-data cascade as a subset — exactly as `accountDeletion.ts` already
   anticipates ("a full-account-delete endpoint (if/when built) is a superset").

Idempotency: purging membership for a user with no rows is a no-op returning
`purged: 0`, matching the existing cascade's contract.

### 9.2 Audit retention — the recommendation and the argument against it

> ## 🚫 BLOCKED — decision D-1, counsel. Blocks PR 2.
>
> **The retention *duration* is not resolved by this document and is not an
> engineering decision.** What follows is a recommendation with its counterargument,
> written to be ruled on — not a decision, and not to be treated as one by an
> implementer. **PR 2 does not ship until counsel rules and the ruling is recorded
> in `docs/COMPLIANCE_FRAMEWORK.md`.** Neither this section nor any downstream
> section may be read as authorising a retention period. Do not resolve this in a
> code review; do not infer approval from the recommendation's confidence.

**Recommendation (for counsel to rule on): retain `aforce_internal_cohort_audit`
rows through account deletion, with `subject_user_id` intact, for 24 months, then
purge by scheduled job.**

**Strongest argument against:** a Clerk userId is personal data. A GDPR/CCPA
erasure request is a request to erase personal data. Keeping a row that says
"user X was granted early access to unreleased health features on date Y" after
that user asked to be forgotten is, on its face, non-compliance — and this is
health-adjacent, the most sensitive category we touch.

**Why it loses:** these rows are the *only* record of an access-control decision
about pre-release health functionality. Erasing them means that if we later need
to answer "who could see unreleased provider data, and who authorised it," the
answer is permanently unavailable — including in the scenario where the person
asking is a regulator or an auditor. Authorization/security audit logs are a
recognised retention basis distinct from product analytics, and the correct
control is minimisation plus a hard cap, not erasure:

- Store **only** the Clerk userId. Never email, name, or device identifiers. The
  `detail` jsonb is restricted to flag keys, cohort slugs, stage values, and
  timestamps — enforced by a schema check on write.
- Hard cap at **24 months**, enforced by a scheduled purge, not by intention.
- The audit table is never joined to a marketing or analytics surface.
- On erasure, write a terminal `member_purged` row rather than deleting history —
  the erasure itself becomes part of the record.

**This is a policy call, not an engineering one — 🚫 BLOCKED pending counsel
(D-1).** It must be confirmed by counsel before PR 2 ships, and recorded in
`docs/COMPLIANCE_FRAMEWORK.md`. If counsel
rules the other way, the fallback is pseudonymisation-on-erasure: replace
`subject_user_id` with a one-way HMAC under a key held outside the app database,
preserving "one distinct person" semantics for audit while removing linkability.
Design for that now by never using `subject_user_id` as a foreign key.

---

## 10. Migration path from current state

Current state: nothing exists. There is no data to migrate, no compatibility
window, and no dual-write period. What follows is a build order chosen so that
**every PR is independently revertible and the first five change no user-visible
behaviour.**

### 10.1 Two-database warning — read before PR 2

`lib/db` has **no migration files**. Its only scripts are
`drizzle-kit push` and `drizzle-kit push-force` against
`lib/db/drizzle.config.ts`. Schema changes are applied by pushing against
whatever `DATABASE_URL` is loaded at that moment.

Production Postgres is the **Replit-managed Neon instance**, which is a different
database from the personal Neon account. Before any push:

1. Print the target host (never the credential) and confirm it is the
   Replit-managed instance.
2. `drizzle-kit push` (never `push-force`) — all five tables are additive, so a
   non-forced push must succeed with zero destructive statements. If `push`
   proposes a `DROP`, stop: you are pointed at the wrong database or the schema
   file has drifted.
3. All five tables are new. Rollback is `DROP TABLE` on five tables, none of which
   any other table references.

### 10.2 The seven PRs

| PR | Scope | Behaviour change | Revert cost |
|---|---|---|---|
| **1** | Pure contract module `featureFlags/internalPreviewOverlay.ts`: types, `INTERNAL_PREVIEW_OVERLAYABLE_FLAGS`, `applyInternalPreviewOverlay`, TTL + version semantics, stage clamp. Unit tests including the `INTERNAL_PREVIEW_RESTRICTED_FLAGS` interaction pin (§6.2). **No imports from it anywhere.** | None. Dead code by design. | Delete one file |
| **2** | Schema: five tables in `lib/db/src/schema/aforce.ts` + repo module + `USER_SCOPED_TABLES` registry, its CI guard, **and the baseline backfill of all 32 existing tables** — 24 literal `user_id`, 6 aliased, 2 exempt (§9.1). Detector must match `%_user_id`. Seed all seven providers at `blocked`. **🚫 Gated on D-1 (§9.2).** | None. Tables unread; registry declares dispositions without implementing them. | `DROP TABLE` ×5 + drop registry |
| **3** | `GET /api/internal-preview/overlay` + `internalPreviewLimiter` + route tests. No cohorts exist, so it returns the empty overlay for everyone. | None (nothing calls it). | Unmount router |
| **4** | Founder admin router: cohorts, members, flag grants, audit read. `requireFounder` + `destructiveGuards`. Adversarial tests: non-founder 403, cross-origin 403, limiter 429, non-overlayable flag 422, audit-write-fails ⇒ mutation-fails. | None for users. Founders can now create cohorts that nothing reads. | Unmount router |
| **5** | `aforce_provider_rollout_stages` read/write + stage clamp wired into the read endpoint, **server-side only** (§4.5.1). Stages still all `blocked`, so `grants` is still always empty on the wire. `providerStages` is not added to the member-facing response in this PR or any later one. | None. | Revert clamp; stages unread |
| **6** | Client wiring: `hooks/useInternalPreviewOverlay.ts`, `InternalPreviewState`, `effectiveFlags` exposed from `useAppStore`, **only** `providerRowStatus.ts` callers migrated. Expiry timer + foreground re-check (§6.4.1). Reference-identity tests (§6.1.1). Profile readout showing cohort + expiry countdown for members. Dedicated fetch path — the 30s drift-gated poll and the WS subscription are untouched, pinned by test. **Does not touch Night Out.** | **First user-visible change.** Scope it honestly (§4.5.3): for cohort members at stage `internal`/`beta`, a real connect path appears for **`apple_health`** (iOS, native ready) and **`garmin`** (only if server credentials are configured). Oura, Strava, Google Health, Samsung, and WHOOP are unchanged — `integrationReady`, a short-circuit, or a carve-out blocks each. Plus the polling delta of §7.1.1 for all signed-in users. | Revert one hook + one selector; base flags unchanged |
| **7** | `services/nightOut/access.ts`: `internalPreview = DEMO_MODE \|\| overlayGrantsNightOut`. Unblocks Night Out Tier-3 without cutting a build. Governance record updated in `governance/AFORCE_OS_NIGHT_OUT_PROTOCOL_SPEC.md` §21 (third row filled). **🚫 BLOCKED — D-2, founder sign-off.** | Night Out reachable for cohort members in a normal build. | Revert one predicate |

> ## 🚫 BLOCKED — decision D-2, founder. Blocks PR 7 only.
>
> **PR 7 requires founder sign-off before it is opened.** NO-a.1 and NO-10 are
> founder decisions; widening the `internalPreview` context to include a server
> grant is an **amendment to them**, not an implementation detail. This document
> does not resolve it, does not recommend a resolution, and confers no approval.
>
> **PRs 1–6 do not touch Night Out.** This is normative and it governs §7 — an
> earlier draft listed the Night Out access resolver among the first-pass
> `effectiveFlags` consumers, which contradicted this row. §10.2 wins;
> §7 has been corrected. No PR before 7 may import from, modify, or change the
> behaviour of `services/nightOut/access.ts`.

### 10.3 What migrating away costs

Stated up front, because the schema is meant to outlive whoever built it:

- **Drop the client layer:** delete one hook and one `useMemo`; `effectiveFlags`
  becomes `state.featureFlags`. Every consumer keeps compiling. **~1 hour.**
- **Drop the server layer:** unmount two routers, `DROP TABLE` ×5. No other table
  holds a foreign key into any of them — deliberately; `cohort_id` and `user_id`
  are unconstrained `text`, matching the house pattern. **~1 hour.**
- **Move to a vendor flag service (LaunchDarkly/Statsig):** the overlay contract
  (§6) is the seam. Replace the fetch inside `useInternalPreviewOverlay` with the
  vendor SDK, map the vendor payload into `InternalPreviewOverlay`, keep
  `applyInternalPreviewOverlay` and the allow-list unchanged. The ON-only,
  allow-list, and version clamps stay ours — they are exactly the properties a
  vendor will not enforce for us. **~1 day**, and the audit table stays as the
  local record. This is the migration this design is *shaped for*: the vendor
  becomes a grant source, not an authority.
- **What you cannot cheaply undo:** the audit table's retention decision (§9.2).
  Once you have retained authorization history under one policy, changing the
  policy retroactively is a legal exercise, not a code change. Get the ruling
  before PR 2.

---

## 11. Security analysis

**Trust boundary, stated plainly: the overlay authorises *presentation*, not
*data*.** A jailbroken or instrumented client can always set its own flags in
memory. Therefore:

> **Invariant:** every api-server route that returns unreleased health data must
> gate itself on cohort membership **server-side**, independently. An overlay
> grant must never be the only thing standing between a caller and a payload.

This is the same three-concept separation NO-a.1 established, with the server tier
finally populated — and it means the tier being added is a *safety* improvement
over the status quo (a build-time env var), not merely a convenience one.

| Threat | Control | Residual |
|---|---|---|
| Production user grants themselves a flag | Only write path is `requireFounder` + `destructiveGuards`; the client never constructs an overlay locally, it only parses one | A modified client can set its own in-memory flags — hence the invariant above |
| Overlay endpoint used as a membership oracle for *other* users | No `userId` parameter exists on the read route; it resolves `req.userId` only | None |
| Non-membership inferable from status code | Non-members get `200` with an empty overlay, never `403` | None |
| CSRF on a founder mutation | `enforceAllowedOrigin` rejects server-side (not just browser-side) before the handler runs | **🚫 Requires `CORS_ALLOWED_ORIGINS` set in prod — UNCONFIRMED, decision D-4 (§5.3, §13)** |
| Plain `admin` escalating to grant capabilities | `requireFounder` requires exactly `super_admin`, not `requireRole`'s minimum-rank semantics | **🚫 Requires `FOUNDER_EMAILS` set, else any `super_admin` qualifies — UNCONFIRMED, decision D-3 (§5.3, §13)** |
| Dev auth fallback reachable in prod | `requireAuth`, `requireFounder`, and `requireRealAuth` all `503` in production when `CLERK_SECRET_KEY` is missing | None |
| Captured overlay response replayed | 15-min TTL; the response carries no secret and grants no data | ≤ 15 min of stale presentation |
| Grant survives revocation | Read-time resolution + TTL; no client-side persistence (§2 H3); **expiry actively triggered by a timer scheduled at `expiresAtMs` plus a synchronous foreground re-check (§6.4.1)** — not left to the next fetch, which is unbounded when offline | ≤ 15 min |
| Server dark-switches a shipped surface | No OFF value exists on the wire: no `value` column (§4.3), `grants` is an additive key list (§6.1), and `providerStages` — the one value-carrying field that could encode OFF — is not shipped to the client (§4.5.1) | None |
| Overlay delivered over the unguarded WS upgrade | Excluded by design (§2 H2), pinned by a test asserting no overlay key appears in the WS `state` message and that `applyServerUserState` is unchanged | None |
| Silent widening of the allow-list | Triple enforcement (§6.2): write, read, client. A server-side widening cannot reach an older client | An app update is required to expose a new flag — intended |
| A `blocked` provider enabled by grant | Read-time stage clamp, **server-side before serialisation** (§4.5.1); grant never reaches the wire | None |
| Mutation without an audit trail | Audit row written in the same transaction; failure to audit fails the mutation | None |
| Log leakage | Audit stores flag keys, cohort slugs, stage values, Clerk userIds. Never JWTs, emails, or health values. `req.log` (pino) already used by `destructiveGuards`'s reject path | None |
| Rate-limit evasion across replicas | `express-rate-limit`'s in-memory store is per-process; effective limit is `limit × replicas`, as documented in `destructiveGuards.ts` | Accepted — same posture as the existing destructive routes; bind a shared store before horizontal scale-out |

---

## 12. Non-goals

Named so nobody builds them by accident:

1. **Not a general feature-flag service.** No percentage rollouts, no targeting
   rules, no segment expressions, no experiments. `beta` exists as a stage value
   and is deliberately inert.
2. **Not a kill switch.** ON-only (§6.1).
3. **Not entitlement.** Money-path access stays with `/api/entitlement`,
   RevenueCat, and Stripe. **No overlay flag may ever gate a price, a purchase, a
   subscription state, or anything the revenue-guardian owns.** Enforce by keeping
   every such flag off the allow-list.
4. **Not a data-authorization mechanism** (§11 invariant).
5. **Not Founder Mode.** `governance/Architecture-Appendix.md` §62 describes a
   Founder Control Center with sandbox isolation, time travel, a scenario engine,
   and a persistent watermark. This is a narrow primitive §62 can later consume —
   it is not an implementation of §62 and must not be described as one.
6. **Not flag persistence.** §2 H3 stays true.
7. **Not a change to the drift-gated poll, `applyServerUserState`, or the WS
   contract.** Standing constraint.
8. **Not a change to `scoringEngine.ts` or `statusColor.ts`.** No overlay flag
   affects scoring math, band definitions, or status-colour mapping. The health
   providers behind the initial allow-list feed Readiness surfaces under the
   existing ±10 recovery clamp; nothing here changes that.
9. **Not the camera/HydroState visual surface**, which stays design-only pending
   legal.
10. **Not a WHOOP gating change.** The WHOOP carve-out in
    `providerRowStatus.ts:152` is removed by the provider-kit cutover, not here.

---

## 13. Open decisions — 🚫 ALL BLOCKED

**None of the following is resolved by this document.** Each requires a named
human decision or an environment verification that cannot be performed from a
design doc. They are listed here as the single index; the detailed treatment is
cross-referenced. **No implementer may resolve one of these by inference, by code
review, or by reading a recommendation as an approval.**

| # | 🚫 Blocked decision | Owner | Blocks | Detail |
|---|---|---|---|---|
| **D-1** | **Audit-row retention duration.** Retain 24 months with `subject_user_id` intact (recommended) vs. pseudonymise on erasure. A policy call, not an engineering one. | **Counsel** | PR 2 | §9.2 |
| **D-2** | **Night Out `internalPreview` widening.** An amendment to founder decisions NO-a.1 / NO-10. Not recommended here in either direction. | **Founder** | PR 7 only | §10.2 |
| **D-3** | **Production `FOUNDER_EMAILS`.** Two parts: (a) *confirm the variable is set in production* — unset means any `super_admin` can grant capabilities; (b) the roster contents. | **Founder** + whoever holds Railway env access | PR 4 | §5.3 |
| **D-4** | **Production `CORS_ALLOWED_ORIGINS` confirmation.** Unconfirmed. Unset in production degrades `enforceAllowedOrigin` to a `Host`-header comparison, which is only trustworthy behind a `Host`-pinning proxy. | Whoever holds Railway env access | PR 4 | §5.3 |
| **D-5** | Whether `health_canonical_consumers` belongs on the allow-list — it changes which signals downstream surfaces read, so it is closer to a behaviour flag than a presentation flag. | **Founder** | PR 1 | §6.2 |

**Verification note for D-3(a) and D-4:** these are *observations that have not
been made*, not opinions. Nothing in this document verified either variable, and
no value is to be printed, logged, copied, or recorded here or in any PR —
confirming that a variable is non-empty is sufficient and is the only thing asked
for.

Nothing in PRs 1, 3, 5, or 6 is blocked on a founder decision. PR 1 ships
regardless of D-5 by omitting `health_canonical_consumers` from the initial
allow-list; adding it later is not a contract-version bump (§6.3).
