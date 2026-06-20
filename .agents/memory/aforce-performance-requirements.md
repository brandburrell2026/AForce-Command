---
name: AForce OS performance-requirements audit (intelligence location, territory, caches, launch timing)
description: Where the scoring engine actually runs, how territory recalcs, what's cached and how, and why three "performance requirements" are architectural gaps not quick fixes.
---

# AForce OS performance-requirements verification — what's true vs. the gaps

## Intelligence runs ON DEVICE (server is NOT the authority)
The scoring engine is mirrored, but the **client is effectively the authority**, not
the server. `calculateScore` (`utils/scoringEngine.ts`) + `computeEventImpact`
(`services/hydrationScoreService.ts`) run client-side in `store/app/actions.ts`
(`logIntake`, `confirmCommand`) and on a ~1-min heartbeat in `store/useAppStore.tsx`
(orb decay + command). The api-server `/intake` route **stores the client-provided
`scoreBefore`/`scoreAfter`** and `/state` just returns the persisted row — so the
backend is persistence/validation, NOT where the score is computed. Consequence: a
requirement like "all intelligence on backend only, never on device" is a full
rearchitecture, AND scores are not server-authoritative today (client could submit
arbitrary scores). **Why this matters:** the fast first-command / real-time orb
(see below) only feel instant *because* the engine is local — moving intelligence
fully server-side trades responsiveness for integrity; they're in tension.

## Territory / leaderboard is client-side & lazy (no 30-min job)
`territoryScore`/`rankRegions` (`services/territoryEngine.ts`), `mapAggregationService.ts`,
and `buildSnapshot` (`services/competitionEngine.ts`) are pure client computations
over local/mock data, recomputed on render / whenever the local score changes. There
is **no server-side 30-minute territory scheduler**. The only server schedulers are
the WHOOP fetch sweep (`whoopFetchSweep.ts`, setTimeout chain) and a 30s socket
heartbeat (`aforceHub.ts`) — neither touches territory.

## Both server caches are per-process in-memory Maps (not scale-safe)
- Weather: `api-server/src/lib/openWeather.ts` → `const cache = new Map()`, 10-min TTL,
  coords rounded to 2 decimals. Resets on restart, NOT shared across instances.
- ElevenLabs TTS: `api-server/src/lib/ttsCache.ts` → `TtsAudioCache` LRU+TTL (24h,
  max 64), allowlisted static phrase keys + 4 coach voice IDs only; dynamic per-user
  lines bypass; ElevenLabs invoked only server-side (key never leaves server). The
  *literal* "cache common phrases server-side" requirement IS met, but it's also
  process-local, so each horizontally-scaled instance warms its own.
**Why:** the in-memory caches are fine for a single instance but are a real
pre-horizontal-scaling gate — move to a shared/persistent store (Redis/Postgres).

## Launch timing (mechanism present, SLO not instrumented)
Opening cinematic: `OpeningMount` in `app/_layout.tsx` is `useState(true)` once on
AppShell mount and renders `<OpeningSequence>` immediately as a top-most overlay (no
routing, no artificial delay; stage-1 fade starts on mount). BUT `RootLayout` returns
null until fonts load and wraps AppShell in `ClerkLoaded`, so native splash + bundle
+ font + Clerk init gate the true wall-clock — the "within 2s" SLO is plausible but
**not measured/guaranteed** without instrumentation. First command: `initialEngineOutput
= calculateScore(defaultUserState)` is synchronous, so the command renders effectively
instantly with NO network round-trip required (well within "10s of onboarding").

## Disposition
3 hold (opening mechanism, fast first command, server-side TTS cache); 3 are gaps
(backend-only intelligence, 30-min backend territory job, persistent weather cache).
All three gaps are major architectural/infra work → REPORT and recommend, don't bolt
on inside a verification task.
