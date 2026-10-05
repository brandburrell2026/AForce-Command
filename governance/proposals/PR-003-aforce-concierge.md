# PR-003 — AForce Concierge (DRAFT — pending founder decisions)

**Status:** BUILT DARK · internal preview only. Flag `ai_concierge_enabled` is OFF in
`DEFAULT_FLAGS`, ON in `DEMO_ALL_ON_FLAGS`, toggleable from the Profile DEVELOPER tab
(`developerControlsAvailable()` builds). It is deliberately **not** in the ruling-locked
internal TestFlight overlay (`internalTestflightOverlay.ts`) — adding it there is decision D-05 below.
**Deciders:** Brandon (founder) + Julius — items marked [JB] require both.
**Author:** Claude Code (drafted at founder direction, 2026-10-05).
**Template precedent:** PR-002 (proposal → decision record → constrained build).
**Branch:** `feat/aforce-concierge` (commits `a74ddd20`, `62191150`, and follow-ups).

---

## 1. What AForce Concierge is

> Your day. Your next move.

A conversational surface inside AForce OS, governed by Architecture-Appendix **Section 64**
(Conversational Intelligence Architecture™, Status: Build Now). It helps a member understand
their current situation, choose one useful next step, and take it inside the app. It is built
to the §64 rules — full context loaded, one exchange, observation-only language, the member's
own data, never a population — and **not** as a standard question-and-answer chatbot.

It is a reading-and-explaining layer over the systems that already exist. It never computes a
score, a target, a dose or a clock of its own.

## 2. What is built (this branch)

### 2.1 Server (`artifacts/api-server/src/routes/concierge.ts`, `lib/concierge/*`)

| Route | Purpose |
|---|---|
| `POST /api/concierge/messages` | one turn; creates the conversation when needed |
| `POST /api/concierge/briefing` | on-demand daily briefing (never stored, never pushed) |
| `GET /api/concierge/status` | `{ available }` — AI integration env present |
| `GET/DELETE /api/concierge/conversations[/:id]` | history, delete one, delete all |
| `GET/PUT/DELETE /api/concierge/preferences[/:key]` | consent-gated memory; forget one / all |

Provider: the existing OpenAI integration (`@workspace/integrations-openai-ai-server`, the
Smart Capture provider, model `gpt-5.4`). Credentials never reach the client.

**Gates (fail closed, no rewriting):** §42 server claims gate (`lib/claimsGate.ts`, parity-
locked to the app policy) → §59/§64 stems + population comparison → **DR-013 quantity
grounding** (every unit-bearing figure in a reply must already exist in the member's message,
the app-supplied context, or server facts) → action grounding (capability offered, screen
offered, oz grounded, reminder not in the past) → cited sources ⊆ provided sources. One
regeneration naming the violation, then an honest `unavailable`/`gated` turn. **No streaming**,
because the gate must see the whole reply before anything is shown.

**Urgent boundary:** lexical detection on the member's message → a fixed governed reply (no
model) pointing to local emergency services / a clinician and stating that AForce OS does not
monitor for or detect emergencies.

**Storage:** three new tables (`aforce_concierge_conversations`, `_messages`, `_preferences`)
behind a `ConciergeStore` interface; a memory driver (`CONCIERGE_STORE_DRIVER=memory`) for
tests and pre-push local runs; wired into `runAccountDeletionCascade`. `drizzle-kit push` is
**owed** by the founder before production use; until then the routes answer
`503 concierge_storage_unavailable` rather than 500.

**Limits:** 20 turns/min and 150/day per user (process-local), 600-char messages, bounded
history (12 turns), 30 s upstream timeout, 900 completion tokens.

### 2.2 Client (`artifacts/aforce-os`)

- Routes `/concierge` and `/concierge/memory` (stack cards; Redirect Home when the flag is off).
  **No new tab** (Build Rule 14, V-8).
- Home entry card on both Home surfaces (editorial + V2); contextual **Ask Concierge** top-bar
  actions on Hydration, Performance Signal (built in its route — the screen stays router-free)
  and Weekly Report; **Concierge memory** row in Profile's PRIVACY group; Developer-tab toggle.
- Grounding context built from the same store slices Home renders from
  (`services/concierge/conciergeContext.ts`): HydroState only when Home's evidence gate says
  the score is real; the **Decision-Guarded** engine command passed through unchanged;
  intake with `logged` provenance; provider signals with `measured` provenance and freshness
  from the shared `FRESHNESS_WINDOWS`; **demo profiles collapse every provenance to `demo`**
  and the server tells the model these are not the member's numbers.
- Action cards reuse working paths only: the idempotent intake action (`entrySource:
  'concierge'`), expo-router navigation to an allow-list of existing routes, the live
  `/urine-check` check-in, and local reminders through expo-notifications with the Moments
  quiet hours (22:00–07:00) and a 3/day cap. A ledger blocks duplicate taps. Undo only where
  the capability supports it (reminders). Intake amendments go through the audited correction
  path, not the concierge.
- Honest states: loading, offline, unavailable, gated, rate-limited, daily-limit, AI not
  configured. Read-aloud through the existing TTS gate (coach mode `spoken` + voice enabled).
  **No voice input** — speech recognition is a stub.
- Memory: optional intro (goal / routine / tone) with a **save switch OFF by default**;
  model "remember" suggestions require a tap; see / edit / forget one / forget all in
  `/concierge/memory`; conversations deletable one by one or all.

### 2.3 Tests

api-server: 78 (gates, urgent copy, pipeline incl. injection framing and demo framing,
server facts + freshness parity with the app config, routes incl. 401, cross-account 404s,
duplicate replay, retry-after-failure, consent, deletion, storage fault). aforce-os: 71
(context builder, actions + duplicate protection, reminder planner, client↔server contract,
presentation, law lock, happy-dom render harness). All existing locks pass (editorial Home law,
tabs manifest, overlay ruling, storage classification, claims lint across 11 locales, a11y,
brand tokens, intake-source contract).

## 3. Decisions required before the flag moves

| # | Decision | Why it is the founder's | Recommendation |
|---|---|---|---|
| D-01 [JB] | **Name.** "AForce Concierge" is a new branded term; TERMINOLOGY-REGISTRY names "AI Coach" as canonical for §64, and DR-003 D-01 says "do not create additional branded systems". | Terminology is registry-governed. | Register "AForce Concierge" as the member-facing name of the §64 surface (AI Coach stays the architectural term), or rename the surface before any external preview. |
| D-02 [JB] | **Privacy disclosure.** `legal/privacy-policy.md` discloses one AI processor (Smart Capture photos). Sending member context + chat text to the same processor is a new disclosure. | Counsel-drafted copy. | Counsel adds the concierge to the AI-processor disclosure before anything beyond internal accounts. |
| D-03 | **Data class.** Conversation transcripts + assistant preferences are a new class (DATA-CLASSIFICATION-MATRIX). Proposed row: Appendix A below. | Privacy review (INTELLIGENCE-CHANGE-CONTROL §4). | Approve the row; S2 (member-authored text, may contain health statements). |
| D-04 | **Emergency copy.** `lib/concierge/urgent.ts` is the engineering placeholder; NO-9 is design-only pending counsel + clinical review. | Counsel. | Review the two sentences; replace verbatim if required (the test locks them against every gate). |
| D-05 | **Internal TestFlight overlay.** Adding `ai_concierge_enabled` to the overlay changes the next internal build. | Overlay lists are founder rulings (locked by test). | Add a `CONCIERGE_INTERNAL_PREVIEW_OVERLAY_FLAGS` group after D-01–D-04 start. |
| D-06 | **CR-1 copy review.** The concierge's own copy keys (`concierge.*`, 11 locales, English only) and the governed urgent reply. | CR-1 is the §64 enable gate (Risk-Register RD-1). | Fold into CR-1. |
| D-07 | **Schema push.** Three additive tables + three indexes. | Founder runs `drizzle-kit push` (docs/SCHEMA_DRIFT.md). | Push to the dev database first; prod with the production Clerk migration. |

## 4. Standing constraints the build honours (no decision needed)

- Build Rules 11, 13, 14; Constitution P5/P6/P10/P11/P15; §59/§64 language; DR-013 mirror-exact.
- Score-Protection: the concierge never dispatches into the score; its only writes are the
  existing intake action, navigation, local notifications, and its own tables.
- No calendar, location, booking, order, pricing, inventory or support-availability claims
  (prompt rule + no data path).
- Weather only from the server's own stored OpenWeather reading, withheld when expired.
- English-only validation (LOCALE-POLICY-REGISTRY): other locales carry English copies, logged
  as untranslated.

## 5. Known limitations (honest)

- Rate limits and the daily cap are per process; a multi-pod deployment multiplies them.
- `GET /status` reports env presence, not key validity; a bad key still yields an honest
  `unavailable` turn at request time (observed locally with the placeholder key).
- Client reminders are local notifications; there is no remote push in the app.
- `recentDays.oz` is always null — daily oz is not carried on `HistoryEntry`; the model is told
  it is missing rather than given a derived figure.

---

## Appendix A — proposed DATA-CLASSIFICATION-MATRIX rows

| Data | Class | Source | Where it lives | Readers | Deletion |
|---|---|---|---|---|---|
| Concierge conversation text (member turns) | S2 | member-authored | `aforce_concierge_messages` (Postgres), keyed by Clerk userId | the member; the AI processor at inference time (not retained by AForce as training data) | per-conversation, all-conversations, account cascade |
| Concierge assistant turns (gated replies) | S2 | model output after §42/§59/§64/DR-013 gates | same table | the member | same |
| Concierge preferences (goal, routine, tone, notes) | S1 | member-stated, explicit consent | `aforce_concierge_preferences` | the member; the model at inference time | per-field, all, account cascade |
| Grounding context sent per turn | transient | app store + server facts | request body only; not stored | the AI processor at inference time | n/a (not persisted) |
