# Wave 4 — Activation, Reliability, Test Hardening & Beta-Runway Proof

**Status:** Delivered · **Date:** 2026-08-12 · **Authorized by:** Founder (Wave-4 directive)
**Vocabulary rule (carried from Wave 3):** nothing is called VERIFIED on tests alone. VERIFIED
means observed against a running system; VALIDATED means proven by behavioral test; BUILT means
the code exists and typechecks. Anything not observed says so.

---

## 1 · Activation gate (Part 1)

| Gate item | State | Evidence |
|---|---|---|
| #738 Stripe decoupling merged | **DONE** | merged to main |
| #744 metrics merged | **DONE** | rebased through a 5-file conflict, merged |
| Server deployed with Wave-3+4 code | **VERIFIED** | Railway auto-deploys main; live probes below |
| `/api/healthz` | **VERIFIED 200** | probe 2026-08-12 |
| `/api/healthz/deep` | **VERIFIED `ok`** | database ok 30 ms (critical), critical-config ok, cache honestly reports `memory mode (REDIS_URL not configured)` |
| `/api/entitlement` fail-closed | **VERIFIED 401** | unauthenticated request refused |
| `/api/admin/metrics` live + gated | **VERIFIED 403** | was 401 before #744 merged — the endpoint now exists and `requireFounder` rejects |
| Stripe webhook | **VERIFIED 400** on unsigned | fail-closed |
| Shopify webhook | **VERIFIED 401 `invalid_hmac`** | proves `SHOPIFY_WEBHOOK_SECRET` is configured |
| New client binary | **BUILT + SUBMITTED** | EAS build 59 (`760f5641`), submission `e9968c4a` → App Store Connect → TestFlight |

**Still open (founder-held):** Railway `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` /
`PUBLIC_BASE_URL`; `pnpm --filter @workspace/db push` (creates `aforce_webhook_deliveries`);
`railway.toml` healthcheckPath one-liner; assigning build 59 to the TestFlight group.

**Activation is NOT complete.** The server is deployed and the binary is uploaded, but the
money path cannot be exercised end-to-end until the env vars and the ledger table exist.

## 2 · Commerce chain proof (Part 2) — **BLOCKED, with a hard finding**

> **The Shopify store has ZERO webhook subscriptions.** Verified through the Admin API:
> `webhookSubscriptions` returns an empty set. The entire web-purchase entitlement rail —
> `orders/paid` → entitlement grant, `refunds/create` → revoke — **cannot fire at all today.**

This must be registered **in the Shopify admin UI** (Settings → Notifications → Webhooks), not
through the API: an API-created subscription is signed with the connecting app's secret, which
will never match Railway's `SHOPIFY_WEBHOOK_SECRET`, so every delivery would 401 forever. Register
`orders/paid`, `orders/refunded`, `refunds/create`, `orders/cancelled` → JSON →
`https://aforce-command-production.up.railway.app/api/shopify/webhook`, and confirm the signing
secret shown on that screen equals the Railway value.

Live Stripe/Shopify test transactions were **not** performed — they need the founder-held
credentials and the env vars above. The full duplicate / refund / cancellation / restart /
delayed / failed-delivery matrix **is** covered synthetically by the merged Testcontainers E2E
lane (#748), which is validation, not production verification.

## 3 · Baseline burn-down (Part 3) — **the ceiling is now ZERO**

The standing "45 failed files / 18 failed tests" was never 45 defects. It was **two environment
faults** crashing suites at import — and hiding **332 tests that had never executed**.

| Original cause | Files | Class | Resolution |
|---|---|---|---|
| `__DEV__ is not defined` | 12 | MISSING ENVIRONMENT | `vitest.setup.ts` defines it; audited zero `typeof __DEV__ === 'undefined' \|\|` patterns, so all 8 guards evaluate identically |
| `DATABASE_URL must be set` | 33 | TEST INFRASTRUCTURE DEFECT | unreachable placeholder set only when absent; real-query suites moved to a gated DB lane |

Of the **22 failures the fix unmasked**: 11 TEST INFRASTRUCTURE (client suites crashing at import
on RN/Expo native edges — fixed with per-suite `vi.mock` of only the offending edge), 9 MISSING
ENVIRONMENT (moved to the DB lane), 1 STALE TEST (`whoopOAuth` asserted a 32-char OAuth state
against WHOOP's deliberate 8-char contract), 1 INVALID ASSERTION (`orbReasons` expected a
frame-boundary value contradicted by its own sibling assertions).

**No assertion was weakened, skipped, or deleted. No product code changed.**

Result: **432 files / 6573 tests pass, 0 failures**, 9 files / 71 tests skipped (the DB lane).
A new `db-lane` CI job runs those 9 against `postgres:16` — **9/9 green** after #753 provisioned
the `pgcrypto` extension the WHOOP token store encrypts with.

> **Founder action required:** `governance/TEST-BASELINE.md` still documents the 45/18 ceiling.
> Until it is updated, CI would let 45 failures silently return. The reconciliation is written and
> ready, but CI **blocks editing that file without a human-applied `baseline-override` label** —
> by design, so a PR cannot move its own pass/fail ceiling.

## 4 · CI & branch protection (Part 4) — **DONE**

`main` now requires **typecheck · tests-baseline · integration · focused-health ·
governance-drift**, with admin bypass OFF, force-pushes and deletions blocked, and stale reviews
dismissed. `db-lane` should be added to the required set now that it is green.

**Gap found:** the `typecheck` job runs only `typecheck:libs` + `aforce-os` + `api-server`, so
`@workspace/scripts` is never typechecked in CI — and it is currently **broken** (`TS7016`,
`checkSecrets.test.ts` importing an untyped `.mjs`). Filed separately; pre-existing.

## 5 · Client crash capture (Part 5) — **DECISION MEMO, awaiting ruling**

`governance/DECISION-W4-CLIENT-CRASH-CAPTURE.md`. Options: **A** Sentry (new vendor + DPA),
**B** first-party endpoint (no vendor, JS-only, new collection), **C** defer to TestFlight for
the beta — **recommended**. Transmission stays OFF until a box is checked. Server-side error
observability is already live (#743).

## 6 · The 1-second tick (Part 6) — **FIXED, measured**

The interval itself was correct and is unchanged (PR #544 deliberately un-gated it). What was
wrong was its cost — three amplifiers:

1. the facade memo depended on the whole state object, so **all ~90 `useAppStore()` call sites**
   re-rendered every second, including six tab-route wrappers whose children are not memoized —
   cascading through entire screen subtrees;
2. `CycleSlice` bundled `timerSeconds` with non-ticking fields;
3. once expired, the reducer returned a **value-identical new object** every second forever,
   defeating React's bail-out.

Measured against the real reducer and provider, per minute of ticks:

| Probe | Running countdown | Expired, unanswered |
|---|---|---|
| Facade (pre-fix control) | 60 | 60 → **1** |
| Facade (now) | 60 → **0** | **1** (the genuine expiry transition) |
| Cycle-slice-only consumer | 60 → **0** | **0** |
| Countdown display | **60** (must still update) | **1** |

The `timerSeconds` exclusion is **compile-enforced**, so this cannot silently regress.

## 7 · Timer & background hygiene (Part 7) — **AUDITED, not implemented**

Precise file:line map produced. Highest-severity findings: `ringService` starts a **1 Hz
module-level interval that is never stopped** once any consumer mounts (deliberate, documented as
"keeps biometrics warm" — it is a battery cost with no visible output); both scan screens run
infinite `withRepeat` loops with **no `cancelAnimation` cleanup and no reduced-motion gate**,
violating the repo's own motion contract; the 60 s entitlement poll and the WebSocket reconnect
loop keep firing while backgrounded; `phantomBandService`'s foreground/background sync switch is
**dead code** (zero callers), so a paired band syncs every 30 s forever instead of the designed
5-minute background cadence.

## 8 · Accessibility (Part 8) — **AUDITED, not implemented**

Highest-value finding is one line: **`AFCard`'s non-pressable branch omits `accessible`**, so
every carefully composed `accessibilityLabel` passed to it — including PerformanceSignalV3's
day cards — is **inert on iOS**. Also: `WeeklyReportV3` has effectively zero screen-reader
semantics and its timeline chart has no text alternative; Circle V3's tab pills and leaderboard
rows are ungrouped with "You" conveyed **by color alone**; `ManageSubscriptionScreenV2` renders
canceled/past-due status in `af.red` at ~3.1:1 contrast — failing AA — when the token file
itself documents that and provides `af.redText` for exactly this case; several touch targets are
30–38 pt against the 44 pt minimum.

## 9 · Localization (Part 9) — **AUDITED, not implemented**

340+ keys missing across 10 non-English locales, classified by the audit. Phase-1 priority set
identified. Not implemented in this wave.

## 10 · Notification toggle integrity (Part 10) — **FIXED**

Of six toggles: **two were UI-ONLY** (persisted, never read by any producer) and **three were
DEAD** (no producer exists anywhere — the app has **no remote push or device-token registration
at all**), one of which **defaulted ON**. The hint copy promised all six.

Resolution: the two with real producers are now genuinely wired (`recheckReminders` →
`useRiskTimerVoice`, `scoreDecayAlerts` → `useScoreBandVoice`), the three dead rows are hidden
(their persisted keys retained, with a comment recording what would need to exist to restore
them), the surviving copy describes what actually happens (on-device voice, not push), and
`challengeDeadlines` defaults OFF.

## 11 · Social & first-launch honesty (Part 11) — **FIXED, with one STOP**

- **Server:** `circle.ts` and `battles.ts` no longer seed fabricated friends, battles,
  challenges, and notifications into real user rows on first read. The seed sets became
  **read-side exclusions** — nothing is deleted, no migration, already-seeded rows simply stop
  being served.
- **Client:** circle/battle services start empty and **stay empty on fetch failure** — a failed
  request now reads as unavailable instead of inventing friends. Honest empty and unavailable
  states replace the invented ones.
- **Circle V3:** ranks null out when there is no real cohort to rank against; the fabricated
  `recentDelta: 12` ("moved up 12 spots" — the exact claim the founder banned) is zeroed; a
  **sample-data caption** was added per the standing captioning ruling; and the footnote no
  longer claims live re-ranking against other people.
- **Founder ruling #712 respected:** the sample cohort itself is **intact**. It was captioned,
  not removed — a previous substitution was explicitly reversed by the founder, and this wave did
  not repeat it.

> **STOP — escalated, not implemented.** Zeroing the fabricated first-launch seed
> (`aforceState.ts defaultSeed()` / `mockData.ts defaultUserState`) changes what
> `calculateScore` **receives**, which is a HydroState semantics change and a STOP condition. It
> is also the only way to stop fabricated units/streak values presenting on non-score surfaces at
> first launch. Bundled decisions: getting-started copy, i18n keys, and whether already-seeded
> existing users get equivalent read-side treatment.

## 12 · Zero-hour sleep (Part 12) — **FIXED across eight producers**

Every producer that **could not measure** sleep reported a confident **zero hours**. Downstream
that is scored as the **maximal sleep deficit (−5)** while `null` contributes nothing, and
`freshestNonNull` let a *fresher fabricated 0* outrank an *older genuine 7.4 h* reading. A user
whose watch failed to sync was told they had not slept — and penalized for it.

Fixed in Health Connect, Apple canonical, Apple snapshot, WHOOP mobile + server, Samsung, Oura,
and Garmin. Snapshot producers return `null`; the two canonical-record producers emit **no
record** (the contract's `totalSleepHours` is non-nullable, so that is the only way to say
"unknown" — `mapHeartRateRecord` already set that precedent).

**Accepted tradeoff, stated plainly:** a true measured 0 h night is now unrepresentable. No
producer's `0` was ever a real measurement, and the Apple snapshot lane already took this
position under the RC-2 ruling. No scoring surface was touched; the `ZERO_SLEEP_SAMPLE` fixture
is kept as the tripwire.

## 13 · Load & stress foundation (Part 13) — **BUILT; tier 1 executed**

Tiered k6 suite: 50-VU read-only smoke (production-safe), 250-VU steady with unsigned-webhook
mix, 1000-VU burst with two 0→1000 spikes. Safety is enforced **in code** — a fail-closed guard
refuses tiers 2/3 against any production host, in init context, locked by 10 tests.

Tier 1 against production: liveness **p95 99 ms**, entitlement fail-closed **p95 51 ms**, deep
readiness **p95 100 ms**, **0 contract errors across 5 604 requests**.

> **Disclosure:** the first version of that guard failed **open** — k6's runtime has no `URL`
> constructor, so a 250-VU tier briefly ramped read-only load against production before I killed
> it (~2 minutes; no writes were possible, since unsigned webhooks fail closed). The guard now
> regex-parses and treats an unparseable target as a refusal.

Tiers 2/3 have **not** been run: there is no staging deployment and Docker is unavailable
locally. Standing one up is the prerequisite.

## 14 · Recovery testing (Part 14) — **BUILT, not executed**

`k6-recovery.js` drives sustained light load while the operator restarts the server or stops
Postgres, measuring the outage window and asserting honest degradation (`/healthz` stays 200;
`/healthz/deep` reports `unready`/`draining`, never a fabricated `ok`). Blocked on the same
safe-environment prerequisite.

## 15 · Golden invariant locks (Part 15) — **CENSUS + missing locks added**

Census: 11 of 16 invariants were locked by automated tests, 3 partial, **2 missing entirely** —
including *"a purchase can never change HydroState"*, which rested on document inspection alone.
Locks were added for the missing and partial cases.

## 16 · Device matrix (Part 16) — **NOT EXECUTED**

The app is a managed Expo project with no prebuilt iOS directory, so a simulator matrix requires
a full prebuild + build (~15–25 min) against a tree that was mid-change for most of this wave.
The meaningful coverage the founder needs is on **real hardware via TestFlight build 59**, which
is uploaded and awaiting group assignment. Simulator passes can be run on request.

## 17 · Beta release checklist (Part 17) — **DELIVERED**

`governance/BETA-RELEASE-CHECKLIST.md` — nine sections, every box evidence-stamped, with the
maintenance rule that a box is checked only with evidence.

---

## 18 · Every STOP condition encountered

| # | Condition | Disposition |
|---|---|---|
| 1 | First-launch seed zeroing changes what `calculateScore` receives | **ESCALATED** (§11) — not implemented |
| 2 | Client crash transmission needs a new vendor or new collection | **ESCALATED** (§5) — memo, transmission OFF |
| 3 | Removing the Circle sample cohort would re-substitute against founder ruling #712 | **NOT DONE** — captioned instead (§11) |
| 4 | `TEST-BASELINE.md` edit requires a human-applied label | **ESCALATED** (§3) |
| 5 | Shopify webhooks must be registered in the admin UI, not the API | **ESCALATED** (§2) |

No HydroState math, band definition, threshold, or status-color mapping was changed anywhere in
this wave. No new vendor was added. No destructive migration was run. No later-phase feature was
exposed.

## 19 · Founder action list, in priority order

1. **Register the Shopify webhooks in the admin UI** (§2) — the web money path is dead until this happens.
2. Set Railway `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_BASE_URL`; run the `db push`.
3. Apply the `baseline-override` label so the test baseline can be corrected to zero (§3).
4. Rule on client crash capture (§5) — recommended: **C, defer to TestFlight**.
5. Rule on the first-launch seed STOP (§11).
6. Assign TestFlight build 59 to the internal group; run the real-device pass.
7. Decide whether to stand up a staging environment (unblocks §13/§14).

## 20 · Recommendation

**WAVE 5 — FINAL EXPERIENCE PASS.**

Rationale: the integrity work is now substantially done — the money path is enforced server-side,
the score-write path is backstopped, user data is isolated, the test baseline is zero with real
lanes behind it, and the three fabrication defects this wave found (sleep zeros, dead notification
toggles, invented social standing) are fixed. What remains between here and a beta a user can
trust is **experience quality, not correctness**: the accessibility gaps (§8) include a one-line
fix that silently disables VoiceOver labels on a core screen and a contrast failure the token file
itself warns about; the timer hygiene findings (§7) are battery and motion-sensitivity issues a
beta tester will feel; and the localization gap (§9) is 340+ keys. All three are already audited
down to file:line, so a focused wave can execute rather than investigate.

Command coherence should follow that, not precede it — several of its inputs (the first-launch
seed ruling, the crash decision, staging) are founder decisions still open here.
