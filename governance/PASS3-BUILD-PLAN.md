# PASS-3 Build Plan — RC-L11 → RC-L14 (one sequenced plan)

**Status:** PROPOSED — awaiting founder approval. **No code until approved.**
**Created:** 2026-07-26 · Source findings: [Register §23](SPECIFICATION-RECONCILIATION-REGISTER.md).
Principles: additive · reversible · flag-gated · one slice at a time · off-limits respected
(`scoringEngine.ts`, `theme/statusColor.ts`, domains, deployment, secrets) · score math untouched.

## Sequencing logic

Ordered by **risk-closed-per-effort**, with the founder-decision-gated item last so slices 1–3 can
build while RC-L14's commercial decisions are made. No hard technical dependencies between slices;
each is independently shippable and reversible.

---

## SLICE 1 — RC-L13: Provider surface honesty *(quick win · UI-only · closes a Score-Protection-adjacent hole)*

**1a. Wire the existing status vocabulary.** `resolveHealthProviderStatus()` +
`HEALTH_STATUS_LABEL` (built + tested, never rendered) replace the LIVE/DEMO/CONNECT pill logic in
`ProfileScreenV2.tsx`. "LIVE" only when a verified link exists AND tokens unexpired; expired →
`needs_attention` ("Action Required"). Surface `expiresAt`/last-sync where the API already returns it.
**1b. Kill the fake-LIVE mock path.** Oura/Strava/google_health mock toggle: either remove, or
relabel to the existing DEMO pattern — and **stop seeding demo ProviderSnapshots into score inputs**
(`setProviderBiometrics` from `buildDemoSnapshot`) unless behind the labeled
`health_demo_data_enabled` surface that never reaches score.
- **Migration:** none. **Flag:** reuse existing flags; no new ones needed.
- **Tests:** unit tests already exist for the resolver; add a component-level test asserting the
  rendered label for token-expired and no-link states; assert no `setProviderBiometrics` call from
  the demo toggle path.
- **Rollback:** revert the UI commit. **Release gate:** visual check on sim + tests green.
- **Est. scope:** 1 PR, small.

## SLICE 2 — RC-L11: Profile client hydration + encrypted cache *(closes data-loss-on-reinstall)*

**2a. Rehydrate on login.** On auth-ready (ClerkAuthBridge / app boot), `GET /api/aforce/profile`;
if server has a newer/any profile and local is empty (fresh install) → hydrate `ProfileIdentity` +
sync pointers. If BOTH exist and differ → deterministic rule: server wins on fresh-install, local
wins if it has an unsynced pending change (then re-POST with existing idempotency key). No silent
overwrite: log a labeled reconciliation event.
**2b. Encrypted cache (K-1).** Move `aforce.profileIdentity` + `aforce.profileSync` from
AsyncStorage to `expo-secure-store` (already a dependency, already used for tokens). One-time
migration: read old key → write secure → delete old. Size guard (SecureStore ~2KB limit) — if the
snapshot exceeds limits, encrypt-then-store payload in AsyncStorage with the key in SecureStore.
**2c. Reconnect flush.** Retry pending profile sync on app-foreground + network-regain, not just
next manual save (reuses existing idempotent retry).
- **Migration:** local-only, idempotent, reversible (old keys retained until success confirmed).
- **Tests:** unit tests for hydration decision table (fresh install / pending-local / both-present),
  cache migration round-trip, retry-on-reconnect.
- **Rollback:** flag `profile_server_hydration_enabled` (new, default false → flip on after
  device verification). **Release gate:** physical-device reinstall test proves profile survives.
- **Est. scope:** 1–2 PRs, medium. *(Defers: full multi-device merge; export/deletion controls —
  logged as their own backlog item RC-L11b, needs privacy-counsel input on deletion semantics.)*

## SLICE 3 — RC-L12: Honest consumption ladder + corrections *(minimal, not the full 9 states)*

**3a. Corrections/deletion route (additive, auditable).** New `POST /intake/correction`:
append-only correction row referencing the original `intakeLog` id (schema: nullable
`corrects_intake_id` + `correction_reason` on `aforce_intake_logs`, additive columns), which
reverses the counter deltas in the same transaction pattern intake uses. User-facing "Undo/Correct"
on recent intakes (journal/timeline). Append-only preserved — no UPDATE/DELETE on ledger rows.
**3b. Online-tap dedupe.** Always send `clientEventId` (not just the offline path): generate per
tap, keep the existing `(userId, clientEventId)` unique index + replay short-circuit. Kills
double-fire duplicates with zero UX change.
**3c. Minimal state honesty.** Record `entrySource` (tap / scan-then-log / voice / offline-replay)
and `confirmationLevel` (logged vs verified) on intake — additive columns, no behavior change —
so the full §10 ladder can be layered later without rewriting history.
- **Migration:** additive nullable columns via `drizzle-kit push` (dev first; prod with the same
  runbook pattern as D-08). Reversible: columns nullable, code flag-gated.
- **Tests:** correction reverses counters exactly; duplicate online tap = one row; §36 cases:
  duplicate, offline, delayed, deletion.
- **Rollback:** flag `intake_corrections_enabled` (default false). **Release gate:** counter math
  verified against fixtures; Score Protection shadow guard observes corrections correctly.
- **Est. scope:** 2 PRs (server + app), medium. *(Defers: full 9-state machine, Start-Drinking
  sessions, partial-amount flows — Specified, next phase.)*

## SLICE 4 — RC-L14: One pricing/tier universe *(founder decisions gate this — decide now, build last)*

**Decision D-1 (required): the canonical paid consumer tier.**
Option A — **Command $20/mo · $200/yr everywhere** (site already live with it; app renames
`athlete`→Command, price 1999→2000¢, adds annual plan in Stripe).
Option B — athlete $19.99 canonical (site Command re-priced; Shopify plans redone).
Option C — defer; slices 1–3 proceed regardless.
**Decision D-2 (required if web sales continue): the entitlement bridge.**
Web Command purchases (Shopify) currently grant **no app access**. Options: (a) Shopify webhook →
api-server grants entitlement (new bridge, ~1 route + customer linking); (b) stop selling Command
on the web, app/Stripe only (site CTA links into app purchase); (c) keep both rails but reconcile
manually until launch (documented stopgap).
**Build (after D-1/D-2):** single canonical pricing module (one workspace source consumed by app +
api-server; site reads generated values or is parity-tested against it — closes the
`storeCatalog.ts` TODO), cross-universe parity test, then the chosen bridge.
- **Rollback:** pricing config revert; bridge behind a server flag.
- **Release gate:** revenue-guardian review (money-path) + the RC-L10 displayed≠charged blocker
  resolved in the same window. **This slice must land before Command cutover sells real app access.**

## Order & gates summary

| Slice | Needs founder decision? | Blocked on | Risk |
|---|---|---|---|
| 1 RC-L13 | No | — | Low |
| 2 RC-L11 | No | — | Medium (local migration) |
| 3 RC-L12 | No (scope pre-trimmed) | dev-DB access for additive columns | Medium |
| 4 RC-L14 | **Yes — D-1 + D-2** | decisions; revenue-guardian gate | High (money path) |

RC-L15 (founder role-simulation): stays **Specified**; revisit with Guardian/enterprise work.
Also queued alongside slice 3 (same schema PR): restore Stage-2 graph tables + `sensors.ts`
migration from the runbook (pre-approved content, mechanical).

**APPROVED 2026-07-26.** Founder: build slices 1-3; **D-1 = Command $20/$200 everywhere** (app renames athlete→Command, adds annual); **D-2 = Shopify webhook → entitlement bridge**. Slice 4 unblocked after 1-3, revenue-guardian gate stands.
