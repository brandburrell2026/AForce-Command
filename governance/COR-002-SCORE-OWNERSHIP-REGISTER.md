# COR-002 — Score Ownership Register

**Directive:** `/aforce-world-class-release` §4 COR-002 · **Stage:** 1 (S1-3) ·
**Status:** Canonical classification, evidence-based · **Recorded:** 2026-08-26
**Method:** every user-visible score/metric surface in `artifacts/aforce-os` was
located by repository scan and classified into COR-002's six buckets with file
evidence, feeding source, and flag gate. No credit is given to mocks, specs, or
screenshots; provenance that could not be proven is marked NOT VERIFIABLE.

**Register verdict: no unauthorized competitor metric exists.** HydroState is
the only hero metric. Every other visible number is a supporting state,
attributed third-party context, a labeled demo overlay, a gated placeholder, or
an internal tool output — none issues independent commands.

---

## 1. Canonical hero metric

| Surface | Evidence | Feeding source | Gate |
|---|---|---|---|
| **HydroState** (Home hero; 105 files reference it) | `components/home/HomeScreenV2.tsx`, `HomeDashboard.tsx` | `scoringEngine.ts` (OFF-LIMITS, sole source of truth) + `statusColor.ts` bands | always on — it IS the product |

Score Protection: only confirmed eligible behavior reaches HydroState through
the approved scoring pipeline; the provider-score firewall (server zod closed
`scoreKind` list + client mapper omission) keeps third-party composite scores
out. Verified in the WHOOP program and G2 ingest locks.

## 2. Supporting states (may inform, must not compete or command)

| Surface | Evidence | Source | Gate / note |
|---|---|---|---|
| Hydration progress (units today / daily target) | `components/home/SignalsZone.tsx` → `WaterCycleBar` | canonical user state | always on; progress, not a score |
| Readiness insights | `components/insights/ReadinessInsightsV2.tsx`, `WeeklyReportV3.tsx` | canonical analytics snapshot over provider signals (HRV rmssd-gated by `readinessSignals`) | `weekly_v3_dashboard_enabled: true`; insight layer, no commands |
| Elite weekly editorial readiness | `components/insights/EliteWeeklyEditorial.tsx` | same canonical aggregates | `elite_weekly_report_enabled: false` (built-hidden; internal-TestFlight overlay only) |
| Opening sequence readiness | `components/opening/OpeningSequence.tsx` | canonical state — build-61 fix (`ca34c5c5`) removed the cinematic's fabricated state | always on, honest since build 61 |
| Performance Age | `components/home/PerformanceAgeZone.tsx` (+40 files) | canonical scoring derivatives | on; carries the standing Performance Age™ legal-disclosure ruling (site/legal program) — copy changes route through that ruling |
| Heat Risk | `HeatRiskCard.tsx`, `HeatPulse.tsx`, `HeatAlertBanner.tsx` | engine `heatScore` | renders only when band ≠ STABLE; `guardian_alerts_enabled: false` keeps Guardian alerting off; §12 "not a clinical probability" language handled in S1-1 claims lane |
| Protocol completion | `components/home/HomeDashboard.tsx` | protocol state | progress indicator, not a health score |
| Cruise **Guest Readiness** | `components/cruise/CruiseModeView.tsx` ← `services/cruise/cruiseModeView.ts` | **canonical engine hydration score contextualized** — module contract: "the REAL engine score contextualised"; clamped inputs; honest "—"/building state | `cruise_mode_enabled: true` (hub only; all six sub-flags OFF). S1-5 verified: no parallel engine, fixtures test-only |

## 3. Attributed third-party context (never blended into HydroState)

| Surface | Evidence | Firewall proof |
|---|---|---|
| WHOOP recovery / strain | `WhoopSnapshotCard.tsx`, `home/BiometricDetailSheet.tsx`, `EntryActions.tsx` strain labels | provider-score firewall verified live (WHOOP program); server closed `scoreKind` list rejects unknown kinds (G2 locks); suppression tallies verified in production |
| Garmin snapshot | `ProfileScreenV2.tsx` (`buildDemoSnapshot('garmin')`, `demoOptIn`) | **labeled demo overlay**, opt-in, sample-data caption ruling applies; server credential probe governs live state |
| Samsung / Google Health (Android) | Connected Health surfaces (G5) | provenance chain + aggregator-copy rule; device acceptance in progress (held lane — not modified by this register) |

## 4. Community context (not a health score)

| Surface | Evidence | Authority |
|---|---|---|
| Circle comparison cohort / challenge | `CircleChallengeCard.tsx` ← `services/circleService` | founder ruling #712 explicitly restored the comp cohort — treated as the §14 "explicitly authorized" exception; no commands issued; sample-data captions ruling applies |

## 5. Internal-only diagnostics & gated placeholders

| Surface | Evidence | Gate | §14 obligation |
|---|---|---|---|
| AForce Ring stream | `RingStatusCard.tsx` ← `services/ringService.ts` — **mocked stream, no hardware exists** (file header states it) | double-gated: render requires `phantom_wearable_enabled: false→OFF`; `ring_enabled: false` besides | must never ship enabled while mocked; enabling either flag requires founder approval + real hardware or explicit demo labeling |
| Phantom signal cards | `PhantomSignal`, `PhantomBandCard` in `SignalsZone.tsx` | same `phantom_wearable_enabled` gate (OFF) | same |
| Formula comparison | `services/comparisonEngine.ts` | no production consumer found outside the Sweat tool path | internal diagnostic; must not surface as a consumer metric |
| Guardian body map / intelligence | flags `guardian_intelligence_enabled`, `guardian_body_map_enabled`: false | built-hidden | Stage-3 lane |

## 6. Tool outputs (not scores)

| Surface | Evidence | Note |
|---|---|---|
| Sweat rate / sodium projections | `components/sweat/SweatCalculatorScreenV2.tsx` ← `services/sweatRateEngine.ts` | S1-2 (#817) added cross-field plausibility qualification — implausible outputs are no longer authoritative; UI-local computation is a documented CMD-001 exception (a check tool, not a command surface) |

## Deprecated / unauthorized

**None found.** No deprecated score surface remains mounted; no surface renders
a competitor hero metric; no surface issues commands outside the canonical
action layer.

## Watch-list (not violations today)

1. `mockUserProfile` fallback in `ProfileScreenV2.tsx` (name + `subscriptionTier`
   fallback when Clerk/entitlement data is absent) — display-only fallback, but
   subscription tier should degrade to an honest "—" rather than a mock tier;
   candidate for a later Stage-1/2 honesty PR, not a score issue.
2. Any future enablement of `ring_enabled`/`phantom_wearable_enabled` while
   `ringService` remains mocked would instantly create a §14 zero-tolerance
   breach ("fake live data") — the gate is the only barrier; a lock test is
   recommended in the Stage-1 wrap-up.

---

*This register is the COR-002 deliverable of the approved Stage-1 batch. It
changes no runtime behavior. Held provider lanes (HC/Samsung device acceptance,
Oura, Strava, arbitration, provider flags/config) were read but not modified.*
