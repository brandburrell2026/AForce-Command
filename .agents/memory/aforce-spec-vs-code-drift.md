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

Genuine gaps from that same list: **Marketing Dashboard™** (none — metrics route to Command Center); **Garmin** (scaffold/demo only, needs OAuth creds). Remaining Intelligence-Core SUB-gaps (engines BUILT, only refinements pending): (a) Performance Age weekly/monthly trends are inert because `usePerformanceAge` passes `dailySnapshots: []` — no persisted daily snapshot series yet; (b) Command Confidence has NO per-category min-sample gate — adherence uses a GLOBAL `ADHERENCE_MIN_SAMPLES = 3`, not the spec's "≥10 issued commands per category before category weighting"; (c) Performance Memory logs caffeine only as an intake `fluidType` (no caffeine-specific habit/trend logic).

**Why:** owner's rule is "build verified gaps only, leave existing untouched." Building any already-shipped item from the doc would duplicate/clobber flag-gated, tested code.
**How to apply:** before building any "missing/net-new" AForce feature, grep/explore the CODE (utils/, services/, components/, lib/, api-server routes, featureFlags/flags.ts) — not replit.md. Treat the doc as lagging the code, and offer to update the doc rather than rebuild the feature.
