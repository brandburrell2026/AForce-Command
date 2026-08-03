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

Everything below was read on `main` at `48872ec4`. Three hazards govern the design.

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
field is how it silently loses the next field too. It already lost `language`
once — the comment on line 408 records the bug.

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
| CSRF/origin + limiter + real-auth stack for mutations | **Yes** | `middlewares/destructiveGuards.ts` (Lane F5) | reuse (§5.3) |
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

Effective per-provider connectability:

```
enabled(provider, user) =
    stage(provider) == 'ga'
  ∨ (stage(provider) ∈ {'internal','beta'} ∧ userHasLiveGrant(healthFlagFor(provider)))
```

`healthFlagFor` is the existing `HEALTH_FLAG_BY_PROVIDER` map
(`utils/health/providerRowStatus.ts:55`). Note the WHOOP carve-out at line 152:
WHOOP's gating is still the server credential probe, not `health_whoop_enabled`.
That carve-out is **not** removed by this design; it is removed by the
provider-kit cutover it already references. Until then WHOOP's stage row exists
and is audited but does not gate the row status.

---

## 5. API contract

Base: `https://api.drinkaforce.com/api`. All JSON. All error bodies are
`{ "error": "<snake_case_code>" }`, optionally with `"scope"` — matching the
existing house convention (`{ error: "forbidden" }`, `{ error: "rate_limited", scope }`).

### 5.1 Member-facing read

#### `GET /api/internal-preview/overlay`

- **Auth:** `requireAuth` (Clerk). Attaches `req.userId`.
- **Rate limit:** new `internalPreviewLimiter` in `middlewares/rateLimits.ts`,
  `windowMs: 60_000, limit: 20`, keyed `userOrIpKey`. Client polls at 5 min; 20/min
  is four orders of headroom and still shapes a loop bug.
- **Never 403.** A non-member gets a well-formed empty overlay. Membership must
  not be inferable from a status code, and "you are not in a cohort" is not an error.

**200 response:**

```json
{
  "contractVersion": 1,
  "issuedAt": "2026-08-03T17:02:11.482Z",
  "expiresAt": "2026-08-03T17:17:11.482Z",
  "cohorts": ["health-providers-internal"],
  "grants": ["health_oura_enabled", "health_strava_enabled"],
  "providerStages": {
    "apple_health": "blocked",
    "oura": "internal",
    "samsung_health": "blocked",
    "google_health": "blocked",
    "garmin": "blocked",
    "whoop": "internal",
    "strava": "internal"
  }
}
```

Non-member / no live grants:

```json
{
  "contractVersion": 1,
  "issuedAt": "…",
  "expiresAt": "…",
  "cohorts": [],
  "grants": [],
  "providerStages": { "…": "blocked" }
}
```

Field rules:
- `grants` is a **list of flag keys**, never key/value pairs. ON-only is a wire-format property.
- `grants` is filtered server-side against the allow-list (§6.2) *and* the stage
  clamp (§4.5) before serialisation. A grant for a `blocked` provider never
  appears on the wire.
- `providerStages` is global, identical for every caller, and safe to serve to
  everyone — it says what AForce has shipped, not who the caller is.
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

**Operational preconditions — both are required before this ships:**

1. **`CORS_ALLOWED_ORIGINS` must be set in production.** The unset-allow-list
   fallback compares `Origin` against `req.headers.host`, which is only
   trustworthy behind a proxy that pins `Host`.
2. **`FOUNDER_EMAILS` must be set.** With an empty allow-list, `isFounderAllowed`
   admits *any* `super_admin` (`middlewares/requireFounder.ts` — "locked down but
   never hard-bricked"). For a capability-granting surface, "any super_admin" is
   not the intended blast radius.

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
  'health_canonical_consumers',
  'night_out_enabled',
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
  providerStages: Readonly<Record<HealthProviderId, ProviderStage>>;
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

**Consumers migrate deliberately, not globally.** In the first pass only
`utils/health/providerRowStatus.ts`'s callers and the Night Out access resolver
read `effectiveFlags`. Every other `state.featureFlags` read is left alone. A
repo-wide swap would silently put ~200 call sites behind a network-dependent value.

Fetch lives in a dedicated hook, `hooks/useInternalPreviewOverlay.ts`, modelled on
`hooks/useEntitlement.ts` — which already solves this exact shape correctly:
deferred until `isSignedIn`, interval + `AppState` foreground refresh, and a
monotonic `requestIdRef` that drops out-of-order responses. Copy that structure;
do not invent a second one.

---

## 8. Failure modes

### 8.1 Offline

| Situation | Behaviour |
|---|---|
| Cold start, offline, internal user | `DEFAULT_FLAGS` only. Flags do not persist (§2 H3), so this is already true today. Internal user sees production. Correct. |
| Warm, goes offline with a live overlay | Overlay honoured until `expiresAtMs`, then `status: 'expired'` and surfaces drop to base. Never extended. |
| Offline > 15 min inside a gated screen | Screen unmounts at the next flag read. Gated screens must tolerate this — see §8.4. |
| Back online | Next poll (≤ 5 min) or the foreground transition restores it. |

### 8.2 Partial / malformed

| Situation | Behaviour |
|---|---|
| `grants` contains a key not in this binary's allow-list | Drop that key, keep the rest, increment `unknownGrantCount`. Never throw. Forward compatibility. |
| `providerStages` missing a provider | Treat the missing provider as `blocked`. Absence is never permission. |
| `providerStages` has an unrecognised stage string | Treat as `blocked`. |
| `contractVersion` mismatch | Discard the whole overlay (§6.3). |
| Response is not valid JSON / shape check fails | `status: 'unavailable'`, `lastError: 'server'`, keep any existing non-expired overlay until its own TTL. A malformed response is not a revoke. |
| `500 overlay_unavailable` | Same as network failure. |
| `401` | Clear overlay immediately, `status: 'idle'`. Auth loss *is* a revoke. |

### 8.3 Races

| Race | Resolution |
|---|---|
| Two overlay fetches in flight (5-min tick vs. foreground wake) | Monotonic `requestIdRef`; a response whose id is stale is dropped. Same guard as `useEntitlement.ts:107`. |
| Overlay response lands after sign-out or user switch | Response carries no userId, so the guard is: capture the Clerk `userId` at request time, compare on resolve, discard on mismatch. |
| Grant revoked while a gated screen is mounted | Screen unmounts on the next flag read, up to one TTL later. **No in-flight destructive or money-path operation may be gated by an overlay flag** — see §12 non-goals. |
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
   the equivalent class of bug for provider cursors.
2. **When the full-account-delete endpoint is built:** it hard-deletes all
   `aforce_internal_cohort_members` rows for the user (`purge`), writes one
   `member_purged` audit row per affected cohort, and calls the existing
   health-data cascade as a subset — exactly as `accountDeletion.ts` already
   anticipates ("a full-account-delete endpoint (if/when built) is a superset").

Idempotency: purging membership for a user with no rows is a no-op returning
`purged: 0`, matching the existing cascade's contract.

### 9.2 Audit retention — the recommendation and the argument against it

**Recommendation: retain `aforce_internal_cohort_audit` rows through account
deletion, with `subject_user_id` intact, for 24 months, then purge by scheduled
job.**

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

**This is a policy call, not an engineering one.** It must be confirmed by counsel
before PR 2 ships, and recorded in `docs/COMPLIANCE_FRAMEWORK.md`. If counsel
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
| **2** | Schema: five tables in `lib/db/src/schema/aforce.ts` + repo module + `USER_SCOPED_TABLES` registry and its CI guard (§9.1). Seed all seven providers at `blocked`. | None. Tables unread. | `DROP TABLE` ×5 |
| **3** | `GET /api/internal-preview/overlay` + `internalPreviewLimiter` + route tests. No cohorts exist, so it returns the empty overlay for everyone. | None (nothing calls it). | Unmount router |
| **4** | Founder admin router: cohorts, members, flag grants, audit read. `requireFounder` + `destructiveGuards`. Adversarial tests: non-founder 403, cross-origin 403, limiter 429, non-overlayable flag 422, audit-write-fails ⇒ mutation-fails. | None for users. Founders can now create cohorts that nothing reads. | Unmount router |
| **5** | `aforce_provider_rollout_stages` read/write + stage clamp wired into the read endpoint. Stages still all `blocked`, so `grants` is still always empty on the wire. | None. | Revert clamp; stages unread |
| **6** | Client wiring: `hooks/useInternalPreviewOverlay.ts`, `InternalPreviewState`, `effectiveFlags` exposed from `useAppStore`, **only** `providerRowStatus.ts` callers migrated. Profile readout showing cohort + expiry countdown for members. Dedicated fetch path — the 30s drift-gated poll and the WS subscription are untouched, pinned by test. | **First user-visible change**, and only for cohort members whose provider stage is `internal`/`beta`. | Revert one hook + one selector; base flags unchanged |
| **7** | `services/nightOut/access.ts`: `internalPreview = DEMO_MODE \|\| overlayGrantsNightOut`. Unblocks Night Out Tier-3 without cutting a build. Governance record updated in `governance/AFORCE_OS_NIGHT_OUT_PROTOCOL_SPEC.md` §21 (third row filled). | Night Out reachable for cohort members in a normal build. | Revert one predicate |

**PR 7 requires founder sign-off before it is opened.** NO-a.1 and NO-10 are
founder decisions; widening the `internalPreview` context is an amendment to
them, not an implementation detail. PRs 1–6 do not touch Night Out.

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
| CSRF on a founder mutation | `enforceAllowedOrigin` rejects server-side (not just browser-side) before the handler runs | Requires `CORS_ALLOWED_ORIGINS` set in prod (§5.3) |
| Plain `admin` escalating to grant capabilities | `requireFounder` requires exactly `super_admin`, not `requireRole`'s minimum-rank semantics | Requires `FOUNDER_EMAILS` set, else any `super_admin` qualifies (§5.3) |
| Dev auth fallback reachable in prod | `requireAuth`, `requireFounder`, and `requireRealAuth` all `503` in production when `CLERK_SECRET_KEY` is missing | None |
| Captured overlay response replayed | 15-min TTL; the response carries no secret and grants no data | ≤ 15 min of stale presentation |
| Grant survives revocation | Read-time resolution + TTL; no client-side persistence (§2 H3) | ≤ 15 min |
| Overlay delivered over the unguarded WS upgrade | Excluded by design (§2 H2), pinned by a test asserting no overlay key appears in the WS `state` message and that `applyServerUserState` is unchanged | None |
| Silent widening of the allow-list | Triple enforcement (§6.2): write, read, client. A server-side widening cannot reach an older client | An app update is required to expose a new flag — intended |
| A `blocked` provider enabled by grant | Read-time stage clamp (§4.5); grant never serialised | None |
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

## 13. Open decisions requiring the founder

| # | Decision | Blocking |
|---|---|---|
| D-1 | Audit retention: retain 24 months with `subject_user_id` intact (recommended, §9.2) vs. pseudonymise on erasure | PR 2 |
| D-2 | Widening Night Out's `internalPreview` context to include a server grant — an amendment to NO-a.1 / NO-10 | PR 7 only |
| D-3 | `FOUNDER_EMAILS` roster (who can grant) | PR 4 |
| D-4 | Whether `health_canonical_consumers` belongs on the allow-list — it changes which signals downstream surfaces read, so it is closer to a behaviour flag than a presentation flag | PR 1 |

Nothing in PRs 1, 3, 5, or 6 is blocked on a founder decision.
