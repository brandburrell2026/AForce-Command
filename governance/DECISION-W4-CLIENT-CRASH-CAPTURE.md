# Decision Memo — Client Crash Capture (Wave-4 Part 5)

**Status:** AWAITING FOUNDER RULING · **Owner:** Brandon · **Prepared:** 2026-08-12
**Antecedent:** Wave-3 PR #743 STOP report (merged). Server-side error observability is
live (fatal handlers, error middleware, token-scrubbed logging, 40-site redaction sweep).
**Client crash *transmission* remains unwired by design** — both build options hit wave
STOP conditions (new observability vendor / new data collection), so this is a founder call.

## Current truth

- The client root ErrorBoundary no longer swallows render crashes; it logs
  **device-local only** (`console.error`). Nothing leaves the device.
- No crash/error vendor exists anywhere in the repo (audited in #743: zero
  Sentry/Bugsnag/Crashlytics/Rollbar/Datadog dependencies).
- The client has **no redaction primitive** — any transmission path must add one first.
- Native-layer crashes (not JS) are captured by Apple regardless and surface in
  App Store Connect / Xcode Organizer when the tester has opted in to sharing.

## Options

### A — Adopt a crash vendor (Sentry via `sentry-expo`)
- **Pros:** industry default; native + JS crashes; release health, breadcrumbs,
  symbolication; fastest path to real diagnostics at beta scale.
- **Cons:** new vendor (STOP condition — requires this ruling); DPA/privacy review
  before beta; crash payloads carry stack traces + device context (new collection →
  privacy-policy line + consent surface per the Wave-3 consent architecture);
  config must be gated so **no event ever transmits before consent**.
- **Cost:** free tier covers beta volume. Eng: ~1 PR (init + consent gate + scrub hook).

### B — First-party crash endpoint (`POST /api/client-crash`)
- **Pros:** no vendor, data stays in our Postgres/Railway boundary; reuses the
  server's existing `serializeError` redaction + rate limiting + metrics.
- **Cons:** JS-layer only (native crashes still Apple-only); we own storage,
  retention, and alerting; still **new collection** (privacy-policy line + consent
  gate required); client needs a redaction primitive built from scratch.
- **Cost:** ~2 PRs (server route + ledger table; client boundary hook + consent gate).

### C — Defer: TestFlight crash reports for the beta (RECOMMENDED)
- **Pros:** zero new vendor, zero new collection, zero consent surface; TestFlight
  testers who opt in already share native crash logs + tester feedback through
  App Store Connect; server-side observability (live) covers the API half; beta
  cohort is small enough for manual triage.
- **Cons:** JS-only crashes that don't kill the process are invisible unless a
  tester reports them; no aggregation/trends; diagnosis depends on tester opt-in.
- **Cost:** zero now. Revisit at GA gate with real beta crash data in hand.

## Recommendation

**C for the beta window, with B as the GA path.** Rationale: the beta cohort is
founder-curated and small; TestFlight native-crash coverage plus the now-live server
observability covers the highest-severity failures; and both A and B require a
privacy/consent build-out that would displace beta-runway work without evidence it
is needed. If beta shows JS-layer instability that TestFlight can't see, B keeps
crash data inside our trust boundary and reuses the Wave-3 redaction + consent
machinery rather than introducing a vendor.

## Ruling requested

- [ ] **A** — approve Sentry (unblocks DPA/privacy review)
- [ ] **B** — approve first-party endpoint (unblocks 2-PR build)
- [ ] **C** — defer to TestFlight for beta; revisit at GA gate  ← recommended

*Until a box is checked, client crash transmission stays OFF. This document is the
authoritative record of that state (supersedes the inline memo in #743).*
