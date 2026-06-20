---
name: AForce OS data-persistence guarantees & the offline gap
description: How close/reopen/force-close/update data survival actually works in aforce-os, the one real gap (no offline outbox), and the dev curl trick to prove it.
---

# AForce OS persistence model (what survives an app restart, and the one thing that doesn't)

**Server is the source of truth.** Profile, hydration logs, history, and the
current command live in Postgres via the api-server (`aforce_user_state` +
`aforce_intake_logs`). The client re-fetches `/aforce/state` on every launch and
subscribes to WS pushes + a 30s `fetchHome` poll. So "log → close/reopen",
"force-close", and "install update" survival all reduce to **server round-trip
works + Clerk session persists**. Do NOT go looking for local SQLite/MMKV or a
persisted store of logs — there isn't one. AsyncStorage holds ONLY UI prefs
(voice settings, notification settings, unit prefs, profile identity, onboarding
flag, subscription); see `store/app/constants.ts`.

**Session persistence:** Clerk `tokenCache` from `@clerk/expo/token-cache` is
wired into `<ClerkProvider tokenCache={...}>` (`app/_layout.tsx`); it stores the
JWT in expo-secure-store, so relaunch restores the session (no re-login).
Requires `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.

**Performance Age is DERIVED, not stored** (`usePerformanceAge` from history). It
survives as long as history survives, but can read *provisionally* different right
after force-close until the client-only `appleHealth`/`biometrics` overlays
refetch (those overlays are deliberately never persisted in the store).

## THE GAP — no offline mutation outbox (airplane-mode logs are lost)
`postIntakeLog` does `await postJson('/intake')`. On network failure, `logIntake`
(`store/app/actions.ts`) only warns + dispatches `CYCLE_FAILURE` to clear the
spinner — the optimistic intake is **never committed to state, never persisted,
never queued**. Reconnect (WS + poll) only PULLS server state, which never saw the
offline log, so the intake is silently dropped. The ONLY retry path is the journal
*snapshot* writer (`postJournalSnapshot` retries on next engine refresh), so SCORE
SNAPSHOTS eventually land but discrete INTAKE LOGS do not. There is no NetInfo and
no outbox anywhere (an "analytics" outbox exists but is unrelated). Fixing this is
a real feature (durable AsyncStorage/SecureStore outbox + NetInfo + idempotency
keys + replay-on-reconnect) — treat as a follow-up, don't bolt it on inside a
verification task.

## `state.history` reseeds from mock — it is NOT the durable record
The in-memory `state.history` reducer list is seeded from `mockHistory`
(`store/useAppStore.tsx`) and only mutated by `CYCLE_SUCCESS`; nothing hydrates it
from the server/journal timeline. The DURABLE intake record is Postgres
`aforce_intake_logs`, surfaced via `/journal/timeline` + `/journal/rollups`
(consumed by `JournalScreen`). So "in-app history list" ≠ "durable history" — when
asked whether history survives, the truthful answer is "yes, in the Journal
(server), but that particular reducer list reseeds from a baseline each launch."

## Dev trick: prove server persistence end-to-end with curl
`requireAuth` (`api-server/.../middlewares/requireAuth.ts`) falls back to
`DEFAULT_USER_ID` when `NODE_ENV !== 'production'` and no Clerk session is present.
So you can exercise real persistence through the shared proxy without auth:
`GET localhost:80/api/aforce/state` → `POST localhost:80/api/aforce/intake`
(`{fluidType,ozAmount,scoreBefore,scoreAfter}`, `event` optional) → re-`GET state`
and watch `unitsConsumedToday`/`ozConsumedToday`/`lastIntakeType` survive the fresh
fetch. Production fails closed (503/401), so this is dev-only.
