# AForce Concierge — build handoff (2026-10-05)

Branch `feat/aforce-concierge` (off `origin/main` @ 391d6279). Governance proposal with the open
founder decisions: `governance/proposals/PR-003-aforce-concierge.md`.

## What was implemented

**Server** (`artifacts/api-server/src/routes/concierge.ts`, `src/lib/concierge/*`, `lib/db/src/conciergeRepo.ts`,
`lib/db/src/schema/concierge.ts`)
- Authenticated routes under `/api/concierge`: messages, on-demand briefing, status, conversation
  history (list / read / delete one / delete all), consent-gated preferences (read / save / forget one /
  forget all).
- Model: the existing OpenAI integration (Smart Capture's provider, `gpt-5.4`), structured JSON output,
  30 s timeout, 900-token cap, bounded 12-turn history, 6 000-char context budget.
- Gates on every reply, fail closed, never rewritten: §42 claims vocabulary, §59/§64 stems and
  population comparison, DR-013 quantity grounding (no oz / ml / minute / % figure unless it already
  exists in the member's message or the app context), action grounding, source grounding. One
  regeneration with the violation named, then an honest `unavailable` or `gated` turn.
- Urgent language → fixed governed reply, no model call.
- Failed turns are never persisted; a retry with the same `clientTurnId` re-runs the model and the
  member's message is stored once. Duplicate taps replay the stored real reply.
- Per-user limits: 20/min, 150/day (process-local). Storage behind `ConciergeStore` (Drizzle or
  `CONCIERGE_STORE_DRIVER=memory`), wired into the account-deletion cascade.

**Client** (`artifacts/aforce-os`)
- Routes `/concierge`, `/concierge/memory` (stack cards, Redirect Home when the flag is off). No new tab.
- Entry points: Home card (editorial Home and Home V2), "Ask Concierge" top-bar action on Hydration,
  Performance Signal (built in `app/performance-signal.tsx`; the screen stays router-free) and Weekly
  Report; "Concierge memory" row in Profile → PRIVACY; Developer-tab flag toggle.
- Screen: opening line, on-demand briefing card, optional 3-question intro (save switch OFF by default),
  six suggested questions, transcript with answer → next step → action card → "Why this?" → sources
  (provenance + freshness), composer with Send/Stop, history sheet with delete one / all, read-aloud
  through the existing TTS gate (only when coach mode is `spoken` and voice is enabled).
- Context builder (`services/concierge/conciergeContext.ts`): same evidence gate and store slices as
  Home; Decision-Guarded command passed through unchanged; provenance labels measured / logged /
  estimated / demo; freshness from `FRESHNESS_WINDOWS`; demo profiles collapse to `demo` and the
  server tells the model they are not the member's numbers.
- Actions (`services/concierge/conciergeActions.ts`): log water via the store's idempotent intake
  action (`entrySource: 'concierge'`), open an allow-listed existing screen, start the urine-signal
  check-in, set a local reminder (quiet hours 22:00–07:00 shared with Moments, 3/day cap, undo).
  Duplicate taps blocked by a ledger; invalid edits refused before anything runs; failures reported.

## How users access it (internal preview)

1. Enable the flag: Profile → DEVELOPER tab → "AForce Concierge" toggle (available in local dev,
   `EXPO_PUBLIC_DEMO_MODE=true` builds and `EXPO_PUBLIC_INTERNAL_TESTFLIGHT=true` builds). Demo
   builds have it ON already (`DEMO_ALL_ON_FLAGS`).
2. Home → "AForce Concierge — Your day. Your next move." card, or the chat icon in the Hydration,
   Performance Signal and Weekly Report top bars.
3. Production stays OFF (`DEFAULT_FLAGS.ai_concierge_enabled: false`). Internal TestFlight builds have it
   ON via the overlay (PR-003 D-05, decided 2026-10-05).

## What actually works, and what is config-dependent

| Capability | State |
|---|---|
| Text chat, structured gated answers, briefing | Works end to end against the api-server **when the OpenAI integration env is valid**. Verified live locally only up to the provider call: the local `start-local.sh` carries a placeholder key, so every model call returned the honest `unavailable` turn (`upstream_error`, HTTP 200). The model path itself is covered by the fake-client suites. Railway production has real `AI_INTEGRATIONS_OPENAI_*` (Smart Capture runs there). |
| Urgent boundary, duplicate replay, retry-after-failure, history, deletion, preferences consent / edit / forget | Verified live against the local server (memory store) and in route tests. |
| Log water from an action card | Reuses the production intake path; verified in unit + render tests. Not exercised on a device from this session (no local simulator build; the app's API base points at production, which does not have these routes until merge + deploy). |
| Open screen / start check-in | Route allow-list verified against real `app/` files. |
| Local reminders | Planner verified (quiet hours, cap, past, idempotent). Native scheduling path mocked in tests; needs a device run. |
| Read-aloud | Existing TTS gate; not re-verified on device. |
| Voice input | **Not offered** — speech recognition is a stub in the app. |
| Weather | Only from the server's stored OpenWeather reading; withheld when expired. |
| Streaming | **Not implemented**, by design: the gates must see the whole reply first. |
| Server facts from `aforce_user_state` | Works when the DB is reachable; falls back to client context otherwise (observed locally with the placeholder DB URL). |

## What was tested, and results

- `npx vitest run` (full suite): 703 files, 10 678 tests. Final run: **1 unrelated file flaked under
  load** (`trainerRtp.test.ts`, 4 tests at the 5 s per-test budget) and **passes in isolation**, same
  pathology `apiErrorContract.test.ts` documents in its header. All concierge suites and every lock
  suite touched by this work pass (editorial Home law, tabs manifest, TestFlight overlay ruling,
  storage classification, claims lint across 11 locales, a11y, brand tokens, intake-source contract,
  hydration tab routing, hidden-route guards, module route targets).
- New suites: api-server 78 tests (gates, urgent, pipeline, server facts + freshness parity, routes);
  aforce-os 71 tests (context, actions, reminders, contract, presentation, law, render harness).
- Typecheck: `pnpm run typecheck:libs`, api-server and aforce-os all clean (the app typecheck needs
  the regenerated expo typed-routes file locally; CI generates it).
- Governance drift check and secrets guard pass.

Scenarios covered: new member without a wearable; real / stale / missing / demo data; evidence gate
pending → no HydroState; daily planning and score explanation prompts; successful action; failed
action + retry; duplicate-tap protection (ledger, UI, server replay); preference consent, edit,
forget one / all; conversation deletion; cross-account isolation (404, never 403); AI unavailable
and storage unavailable; prompt-injection text inside member-stated context framed as data.

## Remaining configuration dependencies

1. ~~Schema push~~ — DONE 2026-10-05: the three tables + three indexes were created in production by
   applying `lib/db/migrations/20261005_concierge.sql` through `railway run -e production` (founder
   authorized; no dev database exists — Railway has only `production`).
2. **OpenAI env on the deployment** — `AI_INTEGRATIONS_OPENAI_API_KEY` / `_BASE_URL` (already present
   on Railway for Smart Capture). `GET /api/concierge/status` reports presence only.
3. **Privacy policy** disclosure of the chat processor — counsel drafting from `COUNSEL-BRIEF-2026-10-05.md` (DR-018 D-02).
4. ~~Terminology ruling~~ — ruled: "AForce Concierge" member-facing, AI Coach architectural (DR-018 D-01; Julius pending).
5. **Emergency copy** — counsel + clinical review in progress (DR-018 D-04).
6. **Device run** of the action cards (intake, reminders, read-aloud) on an internal build pointed at a
   server that has the routes.

## How to enable internal preview

- Build with `EXPO_PUBLIC_DEMO_MODE=true` (flag ON), or toggle it in Profile → DEVELOPER.
- Server: no flag; routes are always mounted and auth-gated. Set `CONCIERGE_STORE_DRIVER=memory`
  for a local run before the schema is pushed.
- Internal TestFlight: `ai_concierge_enabled` is in the overlay (`CONCIERGE_INTERNAL_PREVIEW_OVERLAY_FLAGS`,
  founder ruling 2026-10-05, PR-003 D-05), so any build with `EXPO_PUBLIC_INTERNAL_TESTFLIGHT=true`
  (the `internal` EAS profile) turns it on. Production builds stay OFF.

## Not claimed

Internal preview only (DR-018 D-08). Live end-to-end verified in build 104 on 2026-10-05 after the
production OpenAI key (placeholder) and billing (no credits) were fixed. Not yet reviewed by counsel
(privacy disclosure, urgent copy) or by the CR-1 reviewer; production flag stays OFF until those clear.
