---
name: AForce spec-doc vs code drift
description: replit.md significantly lags the aforce-os codebase; audit CODE before treating "net-new per the spec" items as gaps.
---

`replit.md` is NOT a reliable inventory of what exists. Several trademarked features were requested as "net-new — don't appear in the architecture documents, audit as gaps" but were already fully built AND runtime-wired + tested:

- Performance Age™ — `utils/performanceAge.ts`, flag `performance_age_enabled`
- Command Confidence™ — `utils/scoring/commandConfidence.ts`, on `AICommandCard`
- Performance Memory™ — `utils/performanceMemory.ts`, flag `voice_checkin_enabled`
- Voice Check-In™ — full UI `components/voiceCheckIn/VoiceCheckInOverlay.tsx` + hook + service
- Founder Command Center™ — `artifacts/aforce-command-center` web + `api-server` `/admin/command-center/*` + `requireFounder` middleware
- QR Activation Tracking™ — `lib/activation-core`, `analytics/activation_tracker.ts`, server funnel endpoint, flag `spec_activation`
- Unified Height/Weight Component™ — `components/bodyModel/` + `utils/bodyMeasurements.ts`
- Evidence Engine™ — `utils/scoring/commandEvidence.ts` (`deriveCommandEvidence`, fail-closed integrity: hides reasons if its predicted command ≠ the fired command), flag `evidence_engine_enabled` (OFF prod / ON demo). Per-surface explainability also live via `drivers.ts` (Score/Orb), `personalizationSignals.ts` (HydroScan/Smart-Capture), coach script. (Was previously logged as a "genuine gap"; a unified command-evidence engine has since shipped — gated, not missing.)

"FINAL SPEC" 10-item audit (June 2026) outcome — 8 BUILT, 2 gaps:
- BUILT: Performance Age™ (weights 35/30/20/15 + disclaimer verbatim; weekly/monthly trends now LIVE via persisted ledger snapshots), Command Confidence™ (per-category gate IS present — `CATEGORY_LEARNING_MIN_SAMPLES = 10` in `intelligence/commandAdaptiveLearning.ts`; the older "global ADHERENCE_MIN_SAMPLES=3, no per-category gate" note is STALE), Evidence Engine™, QR Activation™, Founder Command Center™ (all six views exist: Activations/D7-Retention/Sub-Conversion/PerfAge-Trends/Territory/VoiceCheckIn; gate = `requireFounder` super_admin + `FOUNDER_EMAILS` env allow-list — founder emails are CONFIG not code), **Marketing Dashboard™** (STALE "none" — a DISTINCT `MarketingDashboard.tsx` page + `ReferralAttributionDashboard.tsx` now exist with geo/retail/campaign attribution), Voice Check-In™, Phantom Band Architecture Reservation™ (`utils/verification/verificationLayer.ts` `TIER_PRIORITY=['phantom','wearable','phone']`, phantom conf 1 > wearable .7 > phone .4 floor — reservation only, no hardware).
- GAP — **Performance Identity Foundation™ = NOT STARTED**: no `PerformanceIdentity` type/field anywhere (grep empty in aforce-os + api-server). The Operator/Warrior/etc. words that exist are UNRELATED (coach archetypes push/precision/ignite/recovery in voiceCatalog; "Operator XXXX" referral anonymization). Founder scoped it "architecture only, post-launch" — confirm before building.
- GAP — **Performance Memory™ = PARTIAL**: the named `utils/performanceMemory.ts` is only a Voice Check-In recap (energy/stress/goal/streak). The other patterns exist but are FRAGMENTED across separate stores (hydration = `state.history` capped at 30; command history = `intelligence/commandEvents.ts` ledger; execution streak = `executionMemory.ts`; caffeine = intake `fluidType` only). Missing: one unified Performance Memory store, longitudinal travel/caffeine/priorities pattern memory, and the explicit "persists across updates / removed only on explicit request" contract. **Garmin** still scaffold/demo (needs OAuth creds).

**Why:** owner's rule is "build verified gaps only, leave existing untouched." Building any already-shipped item from the doc would duplicate/clobber flag-gated, tested code.
**How to apply:** before building any "missing/net-new" AForce feature, grep/explore the CODE (utils/, services/, components/, lib/, api-server routes, featureFlags/flags.ts) — not replit.md. Treat the doc as lagging the code, and offer to update the doc rather than rebuild the feature.
