# AForce OS — Release Readiness (Phase 0 addendum)

**Status:** Draft for founder review · Read-only audit · **Owner:** Julius + Brandon
**Verified against:** `52986ece` (2026-08-01).

> **Thin addendum to the canonical `governance/Launch-Readiness.md`** (maintained by scrum-master,
> verified against `main@7d40b4d7`, 2026-07-31). It is NOT restated here. This file adds only the
> **Phase-0 audit findings that intersect launch readiness** and maps them to that tracker's blockers.
> Where the two agree, `Launch-Readiness.md` is authoritative.

---

## 1. Alignment with `Launch-Readiness.md` top blockers

| Launch-Readiness blocker | Phase-0 audit corroboration |
|---|---|
| CR-1 pre-launch claims review (prepped, **unbooked**) | Confirmed the standing gate; audit adds prohibited-claim inventory to remediate/verify: BAC/driving (SS-05), detox/cellular/alkaline (SS-14), "injury risk" copy (SS-21), Guardian medical-adjacent copy (SS-09) |
| Commerce cutover (Command live; bridge source-only) | Confirmed: pricing parity-tested + server-authoritative (0K); adds stick-allotment data bug (SS-24); Ritual Save-10% CLOSED per §4 |
| §20 flag-flip (BLOCK-2/COND-3) | Out of this program's scope (Class E) |
| Graph/intelligence layer (schema attested, no ingestion) | Consistent — Stage 1–3 Partially Built; event ledger Specified-not-wired (0B) |
| Personalization (display live; engines dark) | Consistent with capability matrix §4 |
| iOS purchase posture (parked) | Consistent (Class E) |

## 2. Phase-0 additions to the readiness picture (not in the tracker)

**New launch-blocking (S1) items surfaced by this audit** — see Stop-Ship Register:
- **SS-01** client Developer/flag-admin tab possibly in prod (verify build profile).
- **SS-02** no server-side enterprise entitlement/RBAC.
- **SS-03** provider tokens possibly plaintext in prod (verify keys).
- **SS-04** no GDPR/CCPA export/deletion path.
- **SS-05** prohibited BAC/impairment/driving code+copy still in the build.

**Trust/coherence (S2)** that should clear before a confident public launch: band divergence (SS-11),
"Readiness" overload (SS-12), sharing defaults + leaderboard exposure (SS-06/07/08), sodium + claims
reconciliation (SS-13/14), Score-Protection enforcement (SS-15).

## 3. Release-budget baselines (to establish — no invented numbers)

Per prompt 0N, targets must be **measured, not asserted**. Current evidence (0L):
- **No client cold-launch / TTI / command-render / crash-free / p95 budgets exist.**
- **No crash-reporting SDK (Sentry/Crashlytics)** in the app.
- Backend has latency histograms (`observability/metrics.ts`) only.

**Required before targets can be approved:** instrument client cold-launch, time-to-useful-Home,
command-render latency, sync success/failure, crash-free sessions, ANR/hang, API latency/error, AI
timeout/fallback. Establish baselines first; do not set pass/fail thresholds on absent data.

## 4. Test-readiness gaps (0L)
264 test files, logic-heavy. Present: Score-Protection boundary, determinism, offline queue, flags,
language gate, tokens, deterministic fixtures. **Missing (required by 0N):** component/screen render
tests (0), entitlement/RevenueCat tests, accessibility tests, sweat formula/unit tests, per-P0-state
deterministic screenshots wired to CI. Known-pre-existing: ~13 RN Flow-type service test loads +
api-server `DATABASE_URL` needs (environmental, not regressions — `TEST-BASELINE.md`).

## 5. Verdict
**Not launch-ready** (consistent with `Launch-Readiness.md`). The Phase-0 audit narrows the gap to a
concrete, dependency-ordered set (see `AFORCE_OS_ELITE_IMPLEMENTATION_PLAN.md`), led by five S1
production-safety items (SS-01…SS-05) plus the standing CR-1/commerce/infra gates already tracked. All
proposed work is founder-gated; nothing in this suite authorizes a build.
