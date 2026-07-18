# Section 62 — Founder Mode & Four-Environment Architecture

**Status:** Spec only. Post-launch. Build begins when the founder greenlights it — no
implementation exists or is authorized by this document.

**Source of truth:** `governance/Architecture-Appendix.md` §62 (the requirements block).
This spec extends that block; it does not fork it. `docs/AFORCE_OS_ARCHITECTURE_V1.md`
currently ends at Section 57 and does not yet carry a §62 body — when §62 is greenlit,
the consolidated doc should link to this file rather than duplicate it.

**Owner:** Principal Architect. **Reviewers before build:** CTO (structure),
cybersecurity-engineer (Production-isolation guarantees), devops-engineer (DB role +
schema provisioning), revenue-guardian (any Founder Mode surface that renders price or
entitlement).

---

## 1. Overview & Goals

Founder Mode gives Julius, Brandon, and named internal team members a single build in
which they can operate the *entire* product — every feature, every phase, features
mid-build with no phase number yet — without that access ever leaking into a real user's
app and without any of it writing real user data.

It formalizes four operating environments the codebase half-has today (Production is
live; Demo Mode already exists as `demo_mode_enabled` + `data/demoProfile.ts` +
`services/demoMode.ts`; Founder Mode and an Engineering Sandbox do not yet exist) into
one explicit, enforced model.

**Goals**

1. **One internal build, total access.** Founder Mode bypasses all phase gating and all
   subscription entitlement gating for internal users only.
2. **Zero Production write risk.** Nothing done in Founder Mode can mutate a real user's
   row. This is guaranteed *below the app* (at the Postgres grant layer), not only by
   app code, so an app bug cannot defeat it.
3. **Never in the public binary.** The Founder Control Center, the environment switcher,
   and the Sandbox connection are excluded from the production build the same way
   `DEMO_MODE` is guarded today — a production build that somehow carries them refuses to
   expose them.
4. **Always-visible truth.** Whenever the app is not in Production, an unmissable
   `FOUNDER MODE` / `SANDBOX` watermark is present and cannot be dismissed.
5. **Reuses the real stack.** Built on the existing store (`useAppStore.tsx` reducer +
   context), the existing flag system (`featureFlags/flags.ts`), and the existing Drizzle
   / node-postgres layer (`lib/db/`). No parallel framework.

**Non-goals:** replacing the flag system, a general-purpose admin CMS, a QA test-data
manager beyond the Sandbox, or any change to scoring behavior (see §7 off-limits).

---

## 2. The Four-Environment Model

`AppEnvironment = 'production' | 'founder' | 'sandbox' | 'demo'`

| Environment | Who | Reads from | Writes to | Feature access | Watermark | In public build? |
|---|---|---|---|---|---|---|
| **Production** | Real users | Production (`public` schema) | Production (`public` schema) | Phase- and entitlement-gated via `featureFlags/flags.ts` + `subscriptionGate.ts` | None | Yes (the only one) |
| **Founder Mode** | Julius, Brandon, named internal allowlist | Sandbox **or** Production (read toggle) | **Sandbox only** (`sandbox` schema) | **All** features, all phases, incl. unnumbered mid-build | `FOUNDER MODE` | No |
| **Engineering Sandbox** | Engineers / automated internal clients | Sandbox (`sandbox` schema) | **Sandbox only** (`sandbox` schema) | All, but this is the infrastructure layer, not the founder-facing UI | `SANDBOX` | No |
| **Demo Mode** | Investors, scripted pitch | Seeded demo data (`data/demoProfile.ts`) only | **Nothing** (in-memory, Score-Protected) | `DEMO_ALL_ON_FLAGS` profile | `DEMO` (existing overlay context) | Overlay code ships but is gated OFF by `demo_mode_enabled=false` |

**Relationship between Founder Mode and Engineering Sandbox.** They are two faces of one
data plane. Engineering Sandbox is the *infrastructure* (the `sandbox` Postgres schema +
the sandbox DB role + the backend routing). Founder Mode is the *founder-facing interface*
(the Control Center) that operates on top of that infrastructure. Both write only to
Sandbox; the separation is responsibility, not a second database.

**Demo Mode is deliberately the weakest-privilege environment.** It never touches the
backend at all (it reads seeded constants and writes nothing), which is why it is the only
non-Production environment whose *code* is allowed in the public binary — its overlay
cannot do harm even if the gate were flipped, and `shouldShowInvestorDemo()` already
fails closed. Founder Mode and Sandbox are the opposite: they *can* reach a database, so
their code must be excluded from the public build entirely (§5).

---

## 3. Architecture

### 3.1 Environment selection

The active environment lives in the store as a single field and has exactly one writer.

```ts
// appStoreTypes.ts — additive
interface AppState {
  // ...existing...
  environment: AppEnvironment;          // defaults to 'production'
  founderReadSource?: 'sandbox' | 'production'; // Founder Mode read toggle; ignored otherwise
}
type Action =
  // ...existing...
  | { type: 'SET_ENVIRONMENT'; payload: { environment: AppEnvironment } }
  | { type: 'SET_FOUNDER_READ_SOURCE'; payload: { source: 'sandbox' | 'production' } };
```

**Build-time gate (the primary guarantee).** Environment switching is compiled out of the
public build. A single module — call it `founder/founderBuild.ts` — exports a constant
`FOUNDER_BUILD: boolean`, set from an EAS build-profile env var (e.g.
`EXPO_PUBLIC_FOUNDER_BUILD`), defaulting `false`. It carries the same hard runtime guard
`demoMode.ts` already uses:

```ts
export const FOUNDER_BUILD = process.env.EXPO_PUBLIC_FOUNDER_BUILD === 'true';
// Mirror the existing DEMO_MODE production guard:
if (typeof __DEV__ !== 'undefined' && !__DEV__ && FOUNDER_BUILD) {
  // A store/TestFlight *public* build must never be a founder build.
  throw new Error('FOUNDER_BUILD must not be set in a public production build.');
}
```

When `FOUNDER_BUILD` is false, `SET_ENVIRONMENT` can only ever hold `'production'`
(the reducer clamps it), the Control Center module is never imported, and the environment
switcher does not render. This is the same pattern proven by `DEMO_MODE` and by
`shouldShowInvestorDemo` failing closed.

**Server-side gate (defense in depth).** The client stamps every api-server request with
a header, `x-aforce-env: founder|sandbox|demo|production`. This header is **orthogonal to
origin derivation** — the api-server continues to derive its origin from
`x-forwarded-host` exactly as `routes/checkout.ts` and `routes/stripePortal.ts` do today;
`x-aforce-env` is a separate, additive header and does not touch `EXPO_PUBLIC_DOMAIN`, the
api-server URL, or any domain config (off-limits — §7). The backend trusts the header only
if **both**: (a) a server env flag `FOUNDER_MODE_ENABLED=true` is set on that deployment,
and (b) the Clerk-authenticated caller is on a server-side founder allowlist
(`FOUNDER_USER_IDS`, checked against Clerk `sub`). If either fails, the header is ignored
and the request is treated as `production`. No client assertion alone can select a
non-Production data path.

### 3.2 Sandbox isolation at the DB layer (without touching Production)

**Decision: one Neon database, a dedicated `sandbox` Postgres schema, enforced by a
restricted DB role.** Not a second database.

Rationale — this is where the *two-database trap* bites. Production Neon is the
Replit-managed instance, separate from the personal Neon account. Introducing a second
`DATABASE_URL` for Sandbox multiplies the number of connection strings that can be
mis-pointed, and the failure mode of a mis-pointed string is "Founder Mode wrote to
Production." Keeping Sandbox as a *schema namespace inside the same instance* means there
is still exactly one `DATABASE_URL` and one source of truth for "which database," and the
Production/Sandbox boundary becomes a Postgres object boundary rather than a config
boundary.

The blast-radius counter-argument (a bad migration in one schema shares the instance) is
answered by role grants, below, plus normal migration review.

**Schema.** Drizzle already declares Production tables with `pgTable(...)` in
`lib/db/src/schema/aforce.ts` (default `public` schema). Mirror the identical table set
under a named schema:

```ts
import { pgSchema } from 'drizzle-orm/pg-core';
export const sandbox = pgSchema('sandbox');
// sandbox.table('aforce_user_state', { ...identical columns... })
```

To avoid maintaining two hand-written copies, the table *shape* is authored once and
instantiated into both `public` and `sandbox` (a factory that takes the schema builder).
The Production `public` definitions in `aforce.ts` are the source of shape; the sandbox
mirror is generated from the same column spec so they cannot drift.

**Enforcement (the guarantee that survives app bugs).** Two Postgres roles:

- `aforce_app` (existing) — full DML on `public`. Used only by Production requests.
- `aforce_sandbox` (new) — full DML on `sandbox`; **`SELECT`-only on `public`; no
  `INSERT/UPDATE/DELETE` on `public`**. Used by every Founder Mode and Engineering
  Sandbox request.

Founder Mode "reads Production" is served by the `SELECT`-only grant on `public`. Founder
Mode "writes Sandbox only" is enforced by the *absence* of write grants on `public`: even
if application code contained a bug that aimed an `UPDATE aforce_user_state` at the
Production table while in Founder Mode, Postgres refuses it. The isolation does not depend
on the app being correct.

Connection routing in `lib/db/src/index.ts` becomes environment-aware: the request's
validated environment (§3.1) selects the pool/role and, for Sandbox reads/writes, sets
`search_path=sandbox`. Production requests keep the exact current pool and `public`
path — a byte-identical no-op for real users.

**Provisioning owner:** devops-engineer. Roles, grants, `search_path`, and the sandbox
schema DDL are infra, provisioned once and out of band; no destructive operation ever runs
against `public`, and no Production data is copied into Sandbox (off-limits — CLAUDE.md
"Database data").

### 3.3 Watermark guarantee

Requirement: a persistent visual watermark whenever a non-Production environment is
active, that cannot be missed or dismissed.

Design so the watermark **cannot diverge from the environment value**:

- One component, `FounderWatermark`, mounts at the navigation root above every screen (a
  sibling of the router outlet), rendered by the same root layout that owns the store
  provider.
- It reads `environment` from the store — the *same single source* that gates data
  routing. It renders a fixed, non-interactive band (`pointerEvents="none"`, top-most
  `zIndex`, safe-area aware) reading `FOUNDER MODE` or `SANDBOX` (or defers to the
  existing Demo overlay chrome for `demo`) whenever `environment !== 'production'`, and
  renders nothing when it is `'production'`.
- **Coupling invariant:** watermark visibility and non-Production data access are both
  derived from `environment`. They are wired so that turning one on turns the other on —
  there is no code path that reaches Sandbox data without `environment` being set to a
  non-Production value, and setting that value is exactly what makes the watermark render.
- **Test guard** (mirrors the `streakCopy` / `investorDemoGate` guard pattern already in
  the repo): a unit test asserts that for every `environment !== 'production'` the
  watermark element is present in the tree, and that in a `FOUNDER_BUILD=false` build the
  environment can only be `'production'` (so the watermark is provably absent for real
  users). A positive control proves the assertion fires if the watermark is removed.

Failure mode covered: a synchronous store update means an environment switch repaints the
watermark in the same commit as the data-source change — no window where Sandbox data is
visible without the band.

---

## 4. Founder Control Center — Feature Breakdown

The Control Center is a Founder-Build-only surface (a screen reachable only when
`FOUNDER_BUILD`). Each sub-feature below lists **what it does**, **data it needs**, and
**proposed module boundary**. Everything it renders is Score-Protected: it never calls
into `scoringEngine.ts` except through the existing black-box exports (§7).

### 4.1 Instant per-feature toggle
- **Does:** flip any flag in `FeatureFlags` on/off live, without a rebuild.
- **Data:** the current `FeatureFlags` object from the store; the full key list already
  exists in `featureFlags/flags.ts`. Writes via the existing `SET_FLAGS` action — no new
  dispatch needed.
- **Module:** `founder/controls/FeatureTogglePanel.tsx`. Presents flags grouped by the
  comment sections already in `flags.ts` (Clutch, Guardian, Cruise, spec_*, etc.). In
  Founder Mode the toggle is unrestricted; it does not touch `subscriptionGate.ts`
  entitlement logic — it sets flags directly, which is why Founder Mode sees phase- and
  tier-gated features regardless of entitlement.

### 4.2 View as Phase 1 / 2 / 3 / 4
- **Does:** render the app as a user in a chosen phase would see it, by applying that
  phase's flag set.
- **Data:** a phase→flagset map derived from `governance/Phase-Roadmap.md` (Phase 1 core;
  Phase 2 subscription tiers; Phase 3 Phantom + Enterprise; Phase 4 long-horizon). This
  map is new and must be authored to match the roadmap; it is the single place phase
  membership is encoded.
- **Module:** `founder/viewAs/phaseProfiles.ts` (the map) + a `ViewAsPhase` control that
  dispatches `SET_FLAGS` with the selected phase's profile. Distinct from §4.1: §4.1 is
  per-flag; this is a named preset.

### 4.3 Time Travel — simulate new user / 30 days / 90 days / 1 year
- **Does:** show what the app looks like for a user with 0 / 30 / 90 / 365 days of
  history, so the founder can see how Performance Memory, Response Timeline (§60, data-
  gated ~60–90 days), Living Performance Model, and streak surfaces mature over time.
- **Data:** synthetic `HistoryEntry[]` + `UserState` snapshots generated for the chosen
  horizon, written to **Sandbox** (or held in an ephemeral Founder session — see
  Open Question Q3). Critically, the synthetic inputs are fed *through* the existing
  scoring engine's public exports; Time Travel does **not** reimplement or fabricate
  scores (off-limits — §7). It produces plausible *inputs* (intake logs, biometrics,
  confirmations) and lets the real engine derive outputs.
- **Module:** `founder/timeTravel/` — a scenario generator (`generateHistory(horizon)`) +
  a loader that dispatches the resulting state via the existing `SET_USER_STATE` /
  `ADD_HISTORY_ENTRY` actions. The generator's realism is a science question routed to the
  performance-scientist agent, not asserted here.

### 4.4 Simulate different user types
- **Does:** load a persona — beta user, coach, parent, enterprise customer — with the
  flag set, entitlement shape, and seed data that persona implies.
- **Data:** a persona registry: `{ personaId, flags, subscriptionShape, seedProfile }`.
  Reuses `data/demoProfile.ts` conventions and `providerDemoSnapshots.ts` for biometrics.
  `subscriptionShape` mirrors `types/subscription` so the persona exercises real
  entitlement rendering without a real RevenueCat/Stripe entitlement.
- **Module:** `founder/personas/personaRegistry.ts` + a `SimulateUserType` control.

### 4.5 Side-by-side version compare
- **Does:** render two configurations (e.g. current flags vs a candidate flag set, or
  Phase 2 vs Phase 3) next to each other so a release decision can be made on what
  actually changes on screen.
- **Data:** two independent store snapshots rendered in two isolated provider subtrees.
  Requires the store provider to be instantiable twice with independent state (it is a
  context provider today; confirm it holds no module-level singletons — flagged as
  Open Question Q4).
- **Module:** `founder/compare/SideBySide.tsx` hosting two `AppStoreProvider` instances
  with distinct initial states. Read-only comparison; neither pane writes Production.

### 4.6 Scenario Engine
- **Does:** run pre-built, realistic end-to-end usage scenarios — not idealized personas —
  including at least one sourced from a **documented competitor failure**.
- **Data:** a scenario registry: `{ scenarioId, description, sourceCitation, seedState,
  scriptedInputs[], expectedObservation }`. Each scenario seeds Sandbox state and plays a
  scripted sequence of inputs through the real engines.
- **Module:** `founder/scenarios/scenarioRegistry.ts` + a runner that replays
  `scriptedInputs` via existing store actions.

**Required competitor-failure scenario (documented).** The §62 requirement names
"recurring cramping where sodium-only replacement failed." Encoded as a scenario:

- *Setup:* an athlete on a high-sodium-only electrolyte replacement product who continues
  to experience recurring exercise-associated muscle cramping across repeated sessions.
- *Scripted inputs:* repeated high-sweat sessions, sodium-forward intake logged, cramping
  symptom flags persisting.
- *Expected AForce observation:* the app's observation-only surfaces reflect that a
  sodium-only model did not resolve the pattern, and the Adaptive Response / Personal
  Response Library (§59) surfaces the cause-and-effect *from the user's own history* —
  never a population claim, never a diagnosis (Constitution: observation never diagnosis).

**Edge-of-competence flag:** the *physiological claim* underpinning this scenario (that
exercise-associated cramping is multifactorial and not resolved by sodium alone) is a
science and evidence matter, not an architecture matter. Before this scenario ships, its
framing and any citation must be validated by the **performance-scientist agent** and its
observation-only copy cleared against `docs/COMPLIANCE_FRAMEWORK.md`. This spec defines the
scenario's *structure and data contract*; it does not assert the underlying physiology.

---

## 5. Security & Safety Constraints

1. **Never in the public build.** `FOUNDER_BUILD=false` in every public EAS profile; the
   runtime guard throws if a non-`__DEV__` build is somehow a founder build. The Control
   Center, environment switcher, and Sandbox connection code are behind `FOUNDER_BUILD`
   imports so they can be tree-shaken from the public bundle.
2. **No Production writes from Founder Mode.** Guaranteed at the Postgres grant layer via
   the `aforce_sandbox` role (§3.2), not only in app code. This is the load-bearing
   control.
3. **Server-side allowlist.** The `x-aforce-env` header is honored only for Clerk
   identities on `FOUNDER_USER_IDS` and only when `FOUNDER_MODE_ENABLED=true` on the
   deployment. Fails closed to `production`.
4. **Secrets untouched.** No secret value is read, printed, logged, moved, or added by this
   design. New server env vars (`FOUNDER_MODE_ENABLED`, `FOUNDER_USER_IDS`) are booleans/
   id-lists, not secrets; the sandbox DB role credential is provisioned by devops via the
   same mechanism as the existing app role and never appears in the repo.
5. **Scoring untouched.** `scoringEngine.ts` and `statusColor.ts` are consumed only through
   their existing stable exports (§7).
6. **No Production data copied to Sandbox.** Sandbox is seeded from synthetic generators
   and `data/demoProfile.ts`, never from a Production dump (CLAUDE.md "Database data").
7. **Watermark cannot be suppressed** while non-Production (§3.3), enforced by test.
8. **Origin path preserved.** `x-forwarded-host` origin derivation is unchanged; the new
   env header is additive and orthogonal.

---

## 6. Phased Build Plan

Each milestone is independently shippable to the **internal build only** and independently
testable. None changes the public production binary until M0 proves the guard.

- **M0 — Environment scaffold + build guard (no behavior change).** Add `AppEnvironment`,
  the `environment` store field defaulting to `'production'`, `founderBuild.ts` with the
  production guard, and the reducer clamp. *Test:* public build resolves to `'production'`
  and cannot leave it; internal build can hold other values. Ships as a byte-identical
  no-op for real users.
- **M1 — Watermark + coupling invariant.** `FounderWatermark` at the nav root + the
  presence/absence test guard. Verifiable before any Sandbox exists (drive it off the
  store field manually in an internal build).
- **M2 — Sandbox DB plane (infra).** devops provisions the `sandbox` schema, the mirrored
  tables, and the `aforce_sandbox` role (SELECT-only on `public`). Backend adds
  environment-aware connection routing keyed off the validated `x-aforce-env`. *Test:* a
  simulated Founder write to a `public` table is refused by Postgres; a Sandbox write
  succeeds; a Production request is unchanged.
- **M3 — Server-side env gating.** `FOUNDER_MODE_ENABLED` + `FOUNDER_USER_IDS` allowlist;
  header ignored otherwise. *Test:* non-allowlisted caller with a `founder` header is
  served Production and blocked from Sandbox writes.
- **M4 — Founder Control Center shell + §4.1 toggles + §4.2 View-as-Phase.** First
  founder-facing UI; reuses `SET_FLAGS`. Requires `phaseProfiles.ts`.
- **M5 — §4.4 Personas + §4.3 Time Travel.** Persona registry and synthetic-history
  generator, both feeding the real engine. Performance-scientist review gate on generator
  realism.
- **M6 — §4.5 Side-by-side compare.** Depends on confirming the store provider is
  double-instantiable (Q4).
- **M7 — §4.6 Scenario Engine + the documented competitor-failure scenario.** Ships only
  after performance-scientist validation and compliance clearance of the scenario copy.

**Migration path from current state.** Today: Production is live; Demo Mode exists as
`demo_mode_enabled` + `data/demoProfile.ts` + `services/demoMode.ts`; no Founder Mode or
Sandbox. The migration folds existing Demo Mode into the `AppEnvironment` enum as the
`'demo'` value (its overlay gate `shouldShowInvestorDemo` and `DEMO_MODE` guard are kept
as-is; they already fail closed), and adds `'founder'`/`'sandbox'` as new values available
only in `FOUNDER_BUILD`. Real users stay on `'production'` throughout; every milestone is a
no-op for the public binary until explicitly greenlit. Rollback at any milestone is
setting `FOUNDER_BUILD=false` and, for M2+, leaving the sandbox schema/role unused (they
are inert to Production).

**Failure modes addressed.** *Offline:* Founder Mode reads fall back to cached store state
as today; Sandbox writes are non-critical and may be dropped or queued (Q3). *Partial /
stripped header:* if `x-aforce-env` is lost in transit, the backend defaults to Production
*reads* and the sandbox role's missing `public` write grant still blocks any errant write —
fail closed. *Race:* multiple founders share one Sandbox schema, so Time Travel / Scenario
runs must be per-session ephemeral rather than shared mutable writes (Q3), and side-by-side
panes hold independent store instances (Q4).

---

## 7. Off-Limits Touchpoints — Founder Must See Before Any Build

Per CLAUDE.md, these are flagged, not assumed-approved:

- **`scoringEngine.ts` / `statusColor.ts` — NOT modified.** Time Travel (§4.3), the
  Scenario Engine (§4.6), and every Control Center surface consume these as black boxes via
  their existing stable exports only. If any milestone appears to require editing scoring
  math, band definitions, or status-color mapping, **stop and flag** — the design is wrong,
  not the rule.
- **Domain / deploy config — NOT modified.** `EXPO_PUBLIC_DOMAIN`, the api-server URL, and
  the `replit.app` domain are untouched. Environment selection rides a new additive header
  (`x-aforce-env`) on the same origin; `x-forwarded-host` derivation is preserved.
- **Secrets — NOT read/moved/printed.** New config is boolean flags and an id allowlist;
  the sandbox DB role credential is provisioned by devops out of band.
- **Database — no destructive ops, no prod→sandbox copy.** The `sandbox` schema and role
  are additive DDL against a namespace that does not exist yet; nothing runs against
  `public` beyond a `SELECT` grant.
- **Store / flag system — extended, not forked.** New `AppState` fields, new actions, and
  new flags are additive to `appStoreTypes.ts` and `featureFlags/flags.ts`, following the
  existing patterns.

---

## 8. Open Questions / Risks (Founder to Decide)

- **Q1 — Sandbox = schema, not second DB. Confirm.** This spec chooses a `sandbox` schema
  in the one Neon instance over a second `DATABASE_URL`, specifically to avoid the
  documented two-database trap (Replit-managed prod Neon vs personal Neon). Accept, or
  require a fully separate Sandbox database (which reintroduces that trap and needs a
  second connection string)?
- **Q2 — Founder allowlist source.** `FOUNDER_USER_IDS` as a static server env list, or
  driven from a Clerk organization/role? Static is simpler and has no runtime dependency;
  Clerk-role is self-serve but adds a lookup on the hot path.
- **Q3 — Sandbox write persistence & multi-founder sharing.** Should Time Travel / Scenario
  runs persist in the shared `sandbox` schema (visible across founders, needs cleanup/reset
  tooling) or be per-session ephemeral (isolated, discarded on exit)? Ephemeral is safer
  and race-free; persistent is better for collaborative review. Recommendation: ephemeral
  by default with an explicit "save to Sandbox" action.
- **Q4 — Store double-instantiation for §4.5.** Side-by-side compare needs two independent
  store subtrees. Confirm `useAppStore.tsx` holds no module-level singletons that would
  make two providers share state. If it does, §4.5 needs a small refactor (flagged as a
  shared-file change requiring approval per the working agreement).
- **Q5 — Competitor-failure scenario physiology.** The sodium-only-cramping scenario's
  scientific claim must be validated and cited by the performance-scientist agent and its
  copy cleared against `docs/COMPLIANCE_FRAMEWORK.md` before M7. Architecture defines the
  scenario's structure; it does not ratify the physiology.
- **Q6 — Demo Mode reconciliation.** Fold the existing `demo_mode_enabled` /
  `investorDemo` surface fully under `AppEnvironment='demo'` now, or leave it standalone and
  only model Founder/Sandbox in §62? Recommendation: fold it, so there is one environment
  concept, but keep its existing fail-closed gate untouched.

---

## 9. Explicitly Out of Scope

- Any change to scoring, band, or status-color behavior.
- A general admin CMS, user-management console, or support-impersonation tool for real
  Production users (Founder Mode never impersonates a real user's *writable* row).
- Copying, migrating, or masking Production data into Sandbox.
- Multi-tenant or per-engineer isolated sandboxes (Engineering Sandbox is one shared
  schema; per-engineer isolation is a later question if a demonstrated need arises — the
  appendix explicitly warns against overlapping safeguards absent a demonstrated problem).
- Domain, deploy, or EAS publishing configuration changes beyond adding an
  `EXPO_PUBLIC_FOUNDER_BUILD` build-profile variable to internal profiles only.
- The Demo Mode cinematic overlay content itself (owned by the existing investor-demo
  surface; §62 only classifies it as the `'demo'` environment).

---

*Doctrine candidate (per operating standard #6): "Isolation that depends on the app being
correct is not isolation. Put the Production-write boundary at the database grant layer, so
an app bug cannot cross it." — proposed for the Learning Journal on §62 build kickoff.*
