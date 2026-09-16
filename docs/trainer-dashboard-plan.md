# Trainer Command Dashboard — Phase 0 plan

**Status:** recon complete, no feature code written.
**Branch:** `feat/trainer-dashboard-phase-0`
**Base:** `origin/main` @ `e55a1bcc`
**Brief:** [`docs/TRAINER-DASHBOARD-BRIEF.md`](./TRAINER-DASHBOARD-BRIEF.md) · **Rules:** [`docs/TRAINER-DASHBOARD-RULES.md`](./TRAINER-DASHBOARD-RULES.md)

This document answers the eight questions the brief's Phase 0 asks, then gives a
file-level change plan. It ends with every assumption and every blocking question.
Per §7 of the brief, ambiguity is surfaced here, not resolved in code.

---

## 0. The five findings that change the plan

1. **There is no roster.** Teams, athletes, coaches and memberships do not exist in the
   database. Not as tables, not as routes. They are TypeScript constants in
   `artifacts/aforce-os/data/mockData.ts` behind a client boolean any signed-in user can
   flip. The dashboard's subject matter has to be built before the dashboard.
2. **No code path exists where one person reads another person's data.** Every
   member-facing query is `eq(table.userId, req.userId)`. Redaction is usually
   "filter an existing read"; here the cross-subject read is itself new.
3. **The role model is the wrong shape, not merely absent.** `Role = "user" | "admin" |
   "super_admin"` with numeric `RANK` (`requireRole.ts:27-29`) is a linear tier. The
   brief's §2.3 matrix is a lattice: a coach sees a *different* projection than an
   admin, not a smaller one. Rank semantics cannot express it.
4. **The brief's Clutch tier bands contradict the protected engine.** Following §2.5
   would make the board disagree with the engine it consumes, in the dangerous
   direction. See Q1 — this blocks Phase 2.
5. **Two of the brief's own requirements are mutually unsatisfiable.** §2.4 locks
   CRITICAL to `#C1281B`; §6.5 requires 4.5:1 against `#0D0D0D`. That pair is 3.32:1.
   See Q3.

---

## 0a. Decisions — founder ruling, 2026-09-16

Recorded verbatim in effect, with the reading I applied. If any reading is wrong, say
so and I will correct it before Phase 1 rather than after.

| # | Conflict | Ruling | Applied as |
|---|---|---|---|
| 1 | Clutch bands: brief's five vs engine's four | **One band system** | The engine is canonical. `clutchTier()` — PLATINUM ≥90, STABLE ≥70, RECOVERY ≥50, DEPLETED <50 — is the only Clutch ladder. The brief's PRIMED / STEADY / WATCH are dropped, and §2.5 of the brief is superseded on this point. Nothing in `recommendations.ts` changes. |
| 2 | Signal Red fails the 4.5:1 gate | **Accepted at 3.32:1** | Signal Red `#C1281B` stays. The §6.5 contrast criterion no longer applies to it as an absolute bar. See the constraint below. |
| 3 | Tier colours the brief specifies exist nowhere | **Match the Figma file** | The Trainer Console file's Black Issue palette governs: ground `#0D0D0D`, card `#141414`, hairline `#2D2A25`, text `#EDEAE3`, muted `#A19C91`, dim `#6B6B66`, accent `#E13B2A`. Severity reads red → bone → muted → dim. `#E8A12B` and `#E2701F` are dropped. |
| 4 | "PULL FROM ROTATION. Medical eval." is stop-ship SS-09 | **Founder sign-off** | Treated as signed off by the founder for this surface. SS-09 also names counsel; that half is not satisfied by this ruling and is tracked below. |
| 5 | Brand v2.1.0 vs v2.2.0 | **Pick the correct one** | v2.2.0 is canonical — it is the later ruling and `CLAUDE.md` carries it. v2.2.0's light theme applies to the marketing site; this is a product surface, so it renders dark in the Black Issue system, consistent with decision 3. |
| 6 | Roster source for the first build | **Use dummy text** | Build against placeholder athletes behind `trainer_demo_seed_enabled`, default off, visually marked as simulated per §6.7. No real athlete data and no production code path reaches it. |

**Constraint that follows from decision 2.** At 3.32:1, `#C1281B` is below WCAG AA for
body text. It stays usable for large display numerals, the brand mark, and heavy
labels, which is exactly how the Figma file uses red. Small text stays bone `#EDEAE3`
at 16.18:1. I will not put Signal Red on small type on a sideline screen unless told
to, and §6.5 of the brief is restated as: bone and muted text meet 4.5:1; red is a
signal colour at display weight, not a text colour.

**Still open after this ruling.** Decision 4 covers the founder half of SS-09 only —
counsel review remains named in the stop-ship register. Decision 6 answers where data
comes from for the build but not Q8: whether a real athlete's readiness may appear to
a trainer before that athlete consents. That question still gates a live pilot, not
the build.

---

## 0b. Decisions — remaining four, 2026-09-16

Instructed to resolve all four. Q6 is an engineering call and is decided. Q8 and Q9 are
decided as **engineering posture built to the strictest plausible requirement**, which
is the safe direction: it can be relaxed by a later ruling without a rewrite, where the
reverse would mean rebuilding the record layer. Q10 is a verification, and is reported
as what it is.

### Q6 — where it mounts: **native first, in the existing mobile app**

`app/trainer/board.tsx` and `app/trainer/athlete/[id].tsx`, content gated by
`trainer_board_enabled`, entry from `app/modules.tsx` and `AccountPane.tsx`, following
the Clutch and Guardian precedent exactly.

Why native and not the web command center:
- All three of the brief's defining numbers (§0) are sideline moments. A desktop
  surface cannot answer "go or no-go in under 5 seconds from cold open".
- Offline is a hard requirement there, and the only proven offline write path in the
  repo is in the mobile app.
- The command center has **no feature-flag system** and **no test coverage** — it is in
  no vitest glob. Both would be new plumbing before the first line of trainer code.

This is not permanent. The redacted endpoints from Phase 1 are shared, so Phase 8's
coach report and the 17:00 documentation half can render on the command center later by
consuming the same API. Only the sideline half is native-only.

**Consequence:** the Phase 7 offline work is required, not optional. Budget it.

### Q8 — athlete consent: **required, fail closed**

No staff actor sees any health field for an athlete who has not granted access. Not
readiness, not hydration, not a tier. The athlete appears on the roster as a pending
row carrying name, position and consent state only, so staff can see the roster is
incomplete without learning anything about the person.

Implementation notes for Phase 1:
- New `aforce_athlete_consents`, modelled on the analytics consent pair: operative state
  separate from append-only evidence, server-issued monotonic `decision_seq`, and the
  compare-and-swap fence from `analyticsIdentityRepo.ts:277-286` so a stale device
  cannot reorder a revocation.
- **Do not reuse `aforce_privacy.scope = 'team_coach'`.** That field is a per-viewer
  display preference with nothing enforcing it, and its default is inverted
  (`scope: 'circle'`, every field true). Consent for a staff surface must be an
  explicit grant, default deny, granted per program and revocable.
- Revocation takes effect on the next read, and the audit log records the
  `decision_seq` in force at the time of every medical read.

This matches what `governance/AFORCE_OS_ENTERPRISE_ENTITLEMENT_MATRIX.md:37` lists as
blocking for Guardian, so Phase 1 closes that item rather than deferring it.

### Q9 — privacy regime: **build to the strictest, claim none**

Which regime governs is a counsel question and stays open. It does not need to be
answered to build, because the regimes differ in retention duration, breach workflow
and whether a business associate agreement is required — **not in the data model**. So
Phase 4 is built to the strictest common denominator and configured later:

- Trainer notes, screening records and questionnaire responses are classified **S3**
  in `governance/DATA-CLASSIFICATION-MATRIX.md` and handled accordingly.
- Encrypted at rest, following the `pgcrypto` pattern already used for provider tokens
  (`access_token_enc` / `refresh_token_enc`).
- Every read and write audited, actor and subject both recorded.
- Retention is per-program configuration with a conservative default, never unlimited.
- These records are included in the existing export and erasure paths
  (`routes/privacy.ts`, `accountDeletionCascade.ts`) from day one.
- Never used for analytics, advertising, or model training. No third-party processor
  touches them.

Two things this decision does **not** authorize, and they are the ones that need
counsel before a live pilot: operating in a HIPAA-covered arrangement without a signed
business associate agreement, and any cross-border transfer of these records.

**Action item for Phase 1:** `DATA-CLASSIFICATION-MATRIX.md` §5 enumerates five actors
and contains no coach, trainer, or clinician. Its own rule is that a system may not
ship a surface until every class it reads appears there. Adding the staff actors to
that matrix is part of Phase 1, not a documentation chore afterwards.

### Q10 — production database: **corroborated in-repo, not verified live**

`ep-still-bird-atrkomie` appears in two committed files that predate this brief —
`.claude/agents/backend-engineer.md:13` and `.claude/agents/sre.md:20` — both stating
the production instance is Replit-managed and absent from the personal Neon account.
`docs/health/rollout/INTERNAL-COHORT-DESIGN.md:1335` and
`governance/Section-62-Founder-Mode-Spec.md:134` describe the same two-database trap
without naming the instance.

I could not confirm it against the live deployment variable: no `DATABASE_URL` is set
in this environment, no env file exists locally, and the Railway and Vercel dashboards
are not reachable from here. Reading those values is also a secrets operation I do not
perform.

The operative protection is procedural and is already in the rules file: verify the
connection string against the deploy environment variable at the time of any schema
apply, never against the Replit panel. Phase 1's schema work must not run against any
database until someone with dashboard access confirms the target.

---

## 1. Auth and the role model

### What exists
| Piece | Location |
|---|---|
| Clerk wiring | `artifacts/api-server/src/app.ts:8,106`; proxy at `:56`, path-scoped remount `:85` |
| `requireAuth` | `src/middlewares/requireAuth.ts:33` — sets `req.userId`; **falls back to `DEFAULT_USER_ID` outside production** (`:44`, `:60-62`) |
| `requireRealAuth` | `src/middlewares/requireRealAuth.ts:65` — no env branch grants identity; the destructive-op gate |
| `requireMemberIdentity` | `src/middlewares/requireMemberIdentity.ts:27` — 403 on the sentinel |
| `requireRole` | `src/middlewares/requireRole.ts:139`, `resolveRole` `:87` |
| `requireFounder` | `src/middlewares/requireFounder.ts:56`; `FOUNDER_EMAILS` in `.replit:74` |
| `requireEntitlement` | `src/middlewares/requireEntitlement.ts:37` — fail-closed, **one call site** (`routes/aforce/social.ts:237`) |
| Plan/feature map | `src/lib/featureEntitlements.ts:37-138`, resolver `src/lib/entitlementResolver.ts:42` |

`resolveRole` resolves highest-wins from Clerk org role, Clerk metadata, then
`SUPER_ADMIN_EMAILS` / `ADMIN_EMAILS`.

### What is missing for §2.3
- No clinician, trainer, coach, athlete or parent role. No `Permission` type.
- No tenancy: no team, org or membership table anywhere in `lib/db/src/schema/`.
- No per-role serialization. Every response is a hand-rolled `res.json(row)`
  (e.g. `routes/aforce/state.ts:28-32`). There is no DTO or view-model layer.
- Two dev fail-open paths that would silently defeat a redaction gate in every
  non-production environment: `requireRole.ts:88-90` and `:147-148` return
  `super_admin` when `CLERK_SECRET_KEY` is unset.

### Already-useful precedent
- `featureEntitlements.ts:135-138` already reserves `medical_escal`, `body_map`,
  `critical_alert`, `risk_advanced` against `guardian_elite`. Entitlement answers
  *was this bought*; it cannot answer *which fields may this actor see about that
  subject*. Two middlewares, not one.
- `routes/commandCenterAdmin.ts:1-16` establishes the convention for privileged
  shapes: hand-written route plus a local Zod schema, deliberately kept **out** of
  `lib/api-spec/openapi.yaml`. The trainer API should follow it. The orval codegen
  path covers four endpoints today and does not type server responses.
- `aforce_analytics_consent_events` (`schema/aforce.ts:1672`) plus the compare-and-swap
  in `analyticsIdentityRepo.ts:231-297` is a proven append-only evidence model with a
  monotonic `decisionSeq` revocation fence. The medical-read audit table should copy
  its shape, but it is a **new table**: the existing one has no actor/subject split.

### Governance position
`governance/AFORCE_OS_ENTERPRISE_ENTITLEMENT_MATRIX.md:37` states the Guardian gap
verbatim: "**None** — no athlete consent, no coach/trainer/operator/athlete view split,
no audit log, no revocation." SS-02 in the stop-ship register is S1 and only
*partially* closed. Phase 1 of this build is the work that closes it.

---

## 2. The scoring layer

### Protected files — confirmed present
- `artifacts/aforce-os/utils/scoringEngine.ts` (129 lines)
- `artifacts/aforce-os/theme/statusColor.ts` (235 lines)

Neither is modified by this plan. `docs/AI_COMMAND_CENTER_README.md:36` independently
marks both as human-only.

### `scoringEngine.ts` exports
- `calculateScore(userState, now?, evidence?) → ScoreEngineOutput` (`:54`), returning
  `{ score, performanceState, pulseConfig, reasons, riskTimer, command, breakdown, prediction, social }`.
- Re-exports `minutesSince`, `getStateLabel`, `generateCycleIdentityMessage`,
  `generateNextCycleHint` (`:127`).
- `export * from './scoring/recommendations'` (`:129`) — **this is how the tier
  functions reach consumers.** They are defined in
  `artifacts/aforce-os/utils/scoring/recommendations.ts`, which is *not* protected by
  filename. See Q1b.

### `statusColor.ts` exports
`StatusBand`, `STATUS_BANDS`, `getStatusBand`, `getStatusBandIndex`, `getStatusColor`,
`StatusColor`, plus interpolation stop arrays. Bands: CRITICAL 0–29, RISK 30–49,
DECLINING 50–69, STABLE 70–84, OPTIMAL 85–100. Palette `#FF2800 / #FF8C1A / #FFDE00 /
#3DBE7A / #1FA35A`.

### Tier functions (`utils/scoring/recommendations.ts`)
`clutchTier` (`:16`), `guardianTier` (`:50`), `clutchRecommendation` (`:90`),
`guardianRecommendation` (`:145`), `guardianRiskScore` (`:28`), `clutchHydrationPlan` (`:8`).
Neither returns a color; the only Guardian tier→color map in the repo is in the screen
itself, `app/guardian.tsx:22-27`, routed through `theme/colors.ts:38-63`.

### Heat
`services/heatRiskEngine.ts` — `HEAT_BANDS` (`:23`), `bandForScore` (`:81`),
`computeHeatIndex` (`:90`), `evaluateHeatRisk` (`:304`). `HeatSignalInput` carries
`ambientTempMeasured`, and the engine suppresses the reason string when it is false.
Any temperature readout must render a provenance state.

### Drift inventory (matters for a board that shows many athletes at once)
- The 90/75/60 performance floors are duplicated in four places; only
  `config/hydroStateModel.ts:60-62` is the intended source. `utils/scoreBand.ts:24-29`
  and `utils/scoring/breakdown.ts:20-24` hardcode them.
- Two ladders run over the same 0–100 score: `statusColor.ts` (5 bands, 85/70/50/30)
  and `scoreBand.ts` (4 bands, 90/75/60). Score 87 is simultaneously OPTIMAL and
  BALANCED. A column labelled by one and coloured by the other will look wrong.
- `CRITICAL` means five different things across `statusColor`, `guardianTier`,
  `HEAT_BANDS`, `utils/heatBand.ts` and `recoveryCapacity.ts`, and the polarity flips.
  This is the most likely source of an inverted colour on a roster grid.

---

## 3. Data: athletes, teams, roster

### In the database (mature)
`aforce_users` (`schema/aforce.ts:297`), `aforce_user_state` (`:33`),
`aforce_score_snapshots` (`:224`, append-only, `hydrostate_model_version` stamped
centrally and **not** settable by callers — `lib/db/src/scoreSnapshotRepo.ts`),
`aforce_intake_logs` (`:174`, append-only with `client_event_id` idempotency),
`aforce_health_records` (`:1433`, one ingest door at `routes/aforce/healthRecords.ts`,
`userId` re-stamped from auth, dedup key recomputed server-side), provider token tables
for WHOOP (live) and Oura/Garmin/Strava (dormant behind env).

### Not in the database
| Thing | Reality |
|---|---|
| Teams, rosters, athletes, coaches, memberships | **No tables.** Client constants in `data/mockData.ts:160-199` |
| Wellness questionnaire, soreness/sleep/stress self-report | **Does not exist** anywhere |
| Screening record, SOAP note, document store | **Does not exist** |
| Roster import | **Does not exist.** The only CSV paths are the member's own sensor import and a marketing-signup *export* |
| Journal, streaks | Derived at read time; no tables |
| Session RPE, training load entry | **Does not exist** (blocks Phase 5 — see Q13) |

`aforce_privacy` (`:536`) already accepts scope `team_coach`
(`routes/privacy.ts:31`), stored but never read, because no coach exists.

### Migration constraint
No migration files. `drizzle-kit push` only (`lib/db/package.json`), no down
migrations. The `history_start_at` comment (`schema/aforce.ts:154-170`) states the rule:
every new column must be **additive and nullable**, because a `NOT NULL DEFAULT now()`
would stamp the push date across existing rows and fabricate history. The S1 analytics
tables were applied by hand-reviewed SQL in one transaction rather than push
(`docs/db/S1-3-CAS-REPAIR.md`); a new-table set of this size should follow that path.

---

## 4. Feature flags

Client flags are a flat `Record<string, boolean>`:
`types/index.ts:520` (interface, all keys non-optional), `featureFlags/flags.ts:12`
(`DEFAULT_FLAGS`) and `:447` (`DEMO_ALL_ON_FLAGS`), read through
`store/slices.tsx:186` (`useFlagsSlice`, re-exported as `useFeatureFlags`).
**Flags are session-only — nothing persists them.**

`INTERNAL_TIER_FLAGS` (`flags.ts:705`) force-clamps the Clutch/Guardian family to false
for anyone who is not `__DEV__` or internal TestFlight (`demoUnlockAllFlags`, `:752`).
`featureFlags/__tests__/productionRestrictedFlags.test.ts` iterates that list, so adding
a key there is covered with no test edit.

`components/FeatureGate.tsx:37-40` flips the flag **client-side with no server call**.
It is a demo gate, not an entitlement gate. The trainer surface must not rely on it.

**Adding `trainer_board_enabled`:** `types/index.ts:520` → `flags.ts` `DEFAULT_FLAGS`
→ `flags.ts` `DEMO_ALL_ON_FLAGS` → **add to `INTERNAL_TIER_FLAGS` (`flags.ts:705`)**
since the surface carries medical-adjacent copy → optional
`featureFlags/internalTestflightOverlay.ts` entry → optional `subscriptionGate.ts:18`
requirement → `components/profile/panes/DeveloperPane.tsx:184-193` toggle row → new
test directory glob in `vitest.config.ts`.

---

## 5. Tests and CI

Vitest 4.1.4, three configs: unit (`vitest.config.ts`), DB lane
(`vitest.db.config.ts`, explicit 15-file list, real Postgres, `DB_TESTS=1`),
integration (`vitest.integration.config.ts`, Testcontainers).

Server route tests build a real Express app and inject `req.userId` — the pattern to
copy is `artifacts/api-server/src/routes/aforce/__tests__/intake.test.ts:19-26`.

CI (`.github/workflows/ci.yml`): `typecheck`, `tests-baseline`, `focused-health`,
`db-lane`, `governance-drift`, plus `integration` in its own workflow.

**Two traps:**
1. `vitest.config.ts` include globs are per-directory (`:34-91`). A new
   `components/trainer/__tests__/` **will not run** until its glob is added. The
   config's own comments at `:61-70` record this silently happening twice.
2. `tests-baseline` tolerates a documented failure ceiling — currently 45 failed files
   / 18 failed tests (`governance/TEST-BASELINE.md:75,78`), read from the *target*
   branch. New failing tests push over the ceiling and block the merge; editing the
   baseline needs a `baseline-override` label that must already exist on the repo (Q12).

`db-lane` is **not** in the recommended required-checks table in
`docs/CI_BRANCH_PROTECTION.md:19-25`, which matters because the redaction suite is
exactly the kind of test that belongs in a blocking lane.

---

## 6. Where the surface mounts

Two candidates, and the brief asks the question without answering it.

**Native (Expo Router).** `app/clutch.tsx` and `app/guardian.tsx` are root-stack routes
whose *content*, not route, is gated by `FeatureGate`. A trainer board would mount as
`app/trainer/board.tsx`, entry from `app/modules.tsx:77-91` (developer-gated) and/or
`components/profile/panes/AccountPane.tsx:505-519`. `lib/__tests__/moduleRouteTargets.test.ts`
asserts every launcher `href:` resolves to a real route file.

**Web (`artifacts/aforce-command-center`).** Vite + React 19 + Tailwind + shadcn +
wouter + Clerk. A `/guardian` route already exists as a placeholder
(`src/App.tsx:188-232`). Adding a page is three small edits. But it has **no flag
system at all**, **no test coverage** (not in any vitest glob), and a desktop surface
does not serve the brief's §0 sideline moment.

The honest split: the sideline half (board, athlete record, status change) wants
native; the 17:00 documentation and 21:00 reporting half is cheaper and better on web.
That is a product decision, not an engineering one — Q6.

---

## 7. Offline and caching

- React Query is configured with **bare defaults** on mobile (`app/_layout.tsx:91`),
  one consumer file (`hooks/useServerHistory.ts`), no persister, no optimistic
  mutations, no `networkMode`.
- `AsyncStorage` only. No MMKV, no SQLite, **no NetInfo** — the app has no
  connectivity signal.
- One proven local-first pattern exists and is the template to reuse: the offline
  intake outbox — pure core `utils/intakeOutbox/outbox.ts` (caps, backoff, chronological
  replay), persistence `services/intakeOutbox.ts` (user-scoped AsyncStorage key,
  `useSyncExternalStore`), optimistic write `store/app/actions.ts:165-201`, flush
  `store/useAppStore.tsx:536-568`, indicator `components/ui/AFOfflineBanner.tsx`. It is
  flag-gated off (`offline_intake_outbox_enabled: false`).
- The banner's own header is explicit that it makes no connectivity claim. The brief's
  "Saved locally · 3 pending" (§ Phase 7) is achievable on queue state alone.

**Performance tooling does not exist.** No FlashList anywhere, exactly one `FlatList`
in the route tree (`app/(tabs)/protocol.tsx`), every other screen a `ScrollView`. No
startup measurement, no Detox/Maestro/Playwright, no bundle analyzer. The brief's
timing targets (120 athletes < 400ms; interactive < 2s on 3G) have **no harness in this
repo capable of measuring them**. That is new infrastructure, not a test to add.

---

## 8. Phase-by-phase change plan

Estimates are engineer-days for one experienced engineer, excluding review latency.
They assume the blocking questions in §10 are answered before the phase starts.

### Phase 1 — roles, redaction, audit (**8–13 d**)
New, server-only. No UI.

| Change | Files |
|---|---|
| Subject-relation model | new `lib/db/src/schema/roster.ts`: `aforce_programs`, `aforce_program_members` (actor, role, status), `aforce_athlete_consents` (subject, scope, `decision_seq`, granted/revoked), `aforce_medical_access_log` (actor, subject, resource, fields, redaction level, role at read, `decision_seq` at read) |
| Role axis | extend `middlewares/requireRole.ts` with an orthogonal `subjectRelation`, or add `middlewares/requireSubjectAccess.ts` — do **not** extend `RANK` |
| Redaction | new `src/lib/redaction/` — projection per role per resource, applied at the repo boundary so a field cannot reach a serializer |
| Close dev fail-open | `requireRole.ts:88-90`, `:147-148` |
| Audit write | modelled on `analyticsIdentityRepo.ts:231-297` |
| Tests | `src/__tests__/redaction.*.test.ts` (exact response shape per role, fail on unexpected key), `src/routes/**/__tests__` per route, DB-lane entries in `vitest.db.config.ts` |

Acceptance is provable without UI, which is why the brief puts it first. Note the
schema apply should follow the hand-reviewed-SQL path, not `push` (§3).

### Phase 2 — the morning board (**8–12 d**, +3–5 d if native list virtualization is new)
Depends on Q1 (tier bands), Q6 (surface), Q11 (where athletes come from).
Adds `trainer_board_enabled` per §4, a virtualized list (FlashList is a **new runtime
dependency** — needs the PR justification the brief's §3 requires), the exception-first
sort, and the roster-wide header.

### Phase 3 — athlete record (**5–8 d**)
Reuses the Phase 1 projections. "Renders from cache with no network" requires the
Phase 7 persistence decision made early — otherwise this phase is rebuilt later.

### Phase 4 — screening and documentation (**10–15 d**)
Entirely new domain: questionnaire schema and delivery, screening checklist, SOAP notes
with append-only versioning, PDF export with audit trail. The append-only discipline
already exists in the repo to copy (`aforce_profile_change_log`, intake corrections).
**Blocked by Q9** — a SOAP note is a medical record, and which regime applies decides
retention, export and breach obligations.

### Phase 5 — load and environment (**6–9 d**, +data entry)
ACWR and session RPE need inputs that do not exist (Q13). Heat is the cheap half:
`heatRiskEngine.ts` and `computeHeatIndex` already exist and already carry provenance.

### Phase 6 — return-to-play (**5–8 d**)
Stepwise progression with credentialed sign-off. The "no code path can auto-advance"
criterion is a source-guard test in the existing convention.

### Phase 7 — offline, speed, hardware (**10–16 d**)
Reuse the outbox pattern for status writes. Persisting the board and record is the
first React Query persister in the repo. The timing targets need a device lane
(Maestro or Detox) that does not exist — budget it separately or restate the criterion.

### Phase 8 — coach handoff and export (**4–6 d**)
Mostly a Phase 1 projection plus a renderer. The acceptance criterion — a reviewer
cannot infer a condition — is a review gate, not only a test.

**Phases 1–3 total ≈ 21–33 d.** The whole brief is a quarter of engineering, not a
sprint, and Phase 1 is the majority of its defensibility.

---

## 9. Assumptions

1. "Trainer" means a staff member of a program that has bought a team tier. Individual
   consumer users are unaffected.
2. The dashboard reads the same hydration/readiness numbers the athlete sees. No new
   score, no separate engine.
3. Athletes are existing AForce OS members with the app installed. Nothing here creates
   accounts for people who do not have one.
4. `utils/scoring/recommendations.ts` is protected **in spirit** even though the brief
   names only two files. I plan to consume it unchanged (see Q1b).
5. The brief's §2.6 Neon claim is correct in substance — the two-database trap is
   corroborated by `docs/health/rollout/INTERNAL-COHORT-DESIGN.md:1335` and
   `governance/Section-62-Founder-Mode-Spec.md:134`. I did not verify the instance id,
   because that means reading deployment secrets (Q10).
6. The web command center stays founder-facing unless Q6 says otherwise.
7. "Append-only" means new rows plus a version pointer, matching
   `aforce_profile_versions`, not an event-sourced rebuild.
8. Demo/seed data stays behind `trainer_demo_seed_enabled` and is visually marked, per
   §6.7. Existing `mockRosterClutch` is **not** reused, and note it currently sits
   outside the mock-import lock (`goldenInvariantLocks.test.ts` INVARIANT 14 covers
   `mocks/`, not `data/`).

---

## 10. Blocking questions

Numbered for reply. **All fourteen are now answered or dispositioned** — Q1–Q5 and the
build half of Q11 in §0a, Q6, Q8, Q9 and Q10 in §0b. The questions below are kept as
the record of what was asked and how each was closed. Two items remain genuinely
outside engineering: counsel review of the SS-09 language, and counsel naming the
privacy regime before a live pilot.

**Q1 — Clutch tier bands. RESOLVED: one band system, the engine's.** §2.5 specifies five bands (PLATINUM 90+, PRIMED 75–89,
STEADY 60–74, WATCH 40–59, DEPLETED 0–39). The engine has four
(`recommendations.ts:16-21`: PLATINUM ≥90, STABLE ≥70, RECOVERY ≥50, DEPLETED <50), and
three brief names exist nowhere in code. An athlete at 45 reads as a mid-tier WATCH
under the brief while the engine returns DEPLETED with `action: 'pull'`. Which governs?
If the brief does, the engine must change, which the brief itself forbids.

**Q1b — is `utils/scoring/recommendations.ts` protected?** The brief names
`scoringEngine.ts`, which only re-exports it. The tier logic and the command strings
actually live in `recommendations.ts`. Confirm it is off-limits too.

**Q2 — Guardian tier colours. RESOLVED: match the Figma file.** §2.4 fixes WATCH `#E8A12B` and MODERATE `#E2701F`.
Neither appears anywhere in the repo; the screen uses `#00E5C8` and `#FFA01E`. §2.4 also
says introduce no new colour. Adopting the brief introduces two, and CRITICAL
`#C1281B` collides with a deliberate brand separation pinned by a test
(`components/home/__tests__/homePresentation.test.ts:34`). Which set is canonical?

**Q3 — the contrast contradiction. RESOLVED: Signal Red accepted at 3.32:1, restated as a display-weight signal colour.** §6.5 requires every tier colour at 4.5:1 against
`#0D0D0D`. Measured: `#C1281B` 3.32:1 (fails), `#E13B2A` 4.50:1 (borderline),
`#1FA35A` 5.96:1, `#E8A12B` 8.85:1, `#E2701F` 6.08:1, engine `#FF2800` 5.14:1. Either
CRITICAL changes or the contrast bar moves. Which?

**Q4 — "PULL FROM ROTATION. Medical eval." RESOLVED for the founder half: signed off. Counsel review still named in SS-09.** §2.2 explicitly permits it as a
recommendation. `governance/AFORCE_OS_STOP_SHIP_REGISTER.md` SS-09 lists that exact
string as stop-ship pending founder plus counsel under DR-006, and the enterprise
matrix §2.1 names it too. The brief cannot override a governance stop-ship without a
ruling. Does the brief supersede SS-09, or does the trainer surface ship with governed
replacement language?

**Q5 — brand version. RESOLVED: v2.2.0 is canonical; this surface renders dark.** The brief says v2.1.0 locks; `CLAUDE.md` says v2.2.0 is
canonical as of 2026-07-06. They disagree about which surface is light or dark, and the
site's own OS page uses Inter for display rather than Archivo Black. Which applies to a
product surface built now?

**Q6 — where does this mount? RESOLVED: native first; web reuses the same endpoints later (§0b).** Native for the sideline, web command center for
documentation and reporting, or both? This changes the Phase 2 estimate by roughly a
week and decides whether the offline work in Phase 7 is required at all.

**Q7 — does admin or founder keep access?** §2.3 gives Admin/compliance "none" for
readiness and "audit metadata only, never content" for medical. Today `super_admin` and
founder reach everything. Confirm that founder access to medical content is removed,
which is the correct reading but is a real capability loss.

**Q8 — is athlete consent a precondition? RESOLVED: yes, fail closed (§0b).** The entitlement matrix lists athlete consent
as blocking for Guardian. The brief never mentions consent. Can a trainer see an
athlete's hydration and readiness before that athlete opts in, or is opt-in required
before any row appears? This decides whether Phase 2 can ship at all.

**Q9 — which regime applies? RESOLVED as posture: build to the strictest, claim none (§0b). Counsel still names the regime before a live pilot.** A SOAP note in a high-school program is likely FERPA;
in a pro club it is likely neither FERPA nor HIPAA; under a team physician it may be
HIPAA. Retention, export and breach duties differ. §2.2 says flag it, so: who answers,
and does Phase 4 wait for that answer?

**Q10 — confirm the production database. PARTIALLY RESOLVED: corroborated in two committed files; live confirmation still needs dashboard access (§0b).** I did not verify `ep-still-bird-atrkomie`
against a deployment variable, because that means reading secrets. Please confirm, or
authorize someone to.

**Q11 — where do athletes come from? RESOLVED for the build: dummy data behind `trainer_demo_seed_enabled`. The live-pilot provisioning path is still undecided.** No roster, no import, no
invite flow. Options: each athlete installs the app and joins a program code; staff
bulk-import a CSV and athletes claim their record; or staff create shells with no
device data. Each implies a different Phase 1 schema. Which?

**Q12 — confirm the `baseline-override` label exists** on the repo, or the first PR
that touches `governance/TEST-BASELINE.md` fails.

**Q13 — who enters session RPE and duration?** Phase 5's ACWR needs a load input that
does not exist in any table. Trainer-entered per session, athlete-entered, or derived
from wearable workout minutes with the uncertainty labelled?

**Q14 — is a new runtime dependency acceptable for list virtualization?** A 120-row
board on `ScrollView` will not hit the brief's numbers, and no virtualization library
is installed. FlashList is the obvious choice and is a new dependency, which §3 says
requires justification.

---

## 11. What I did not do

- No feature code, no schema, no flag, no route. Phase 0 is recon only.
- I did not modify `scoringEngine.ts` or `statusColor.ts`. I read both.
- I did not verify the production database instance id (Q10).
- I did not measure real device performance. The contrast numbers in Q3 are computed;
  the timing targets are unverified because no harness exists.
- I did not resolve any conflict between the brief and governance. All six are in §10.

### How I verified what is claimed here
- File existence and exports: read directly.
- Contrast ratios: computed with the WCAG relative-luminance formula against `#0D0D0D`.
- Governance positions: quoted from `AFORCE_OS_STOP_SHIP_REGISTER.md`,
  `AFORCE_OS_ENTERPRISE_ENTITLEMENT_MATRIX.md`, `DATA-CLASSIFICATION-MATRIX.md`.
- Absence claims ("no roster table", "no questionnaire", "no import path") come from
  repo-wide searches; they are the claims most worth a second pair of eyes.
