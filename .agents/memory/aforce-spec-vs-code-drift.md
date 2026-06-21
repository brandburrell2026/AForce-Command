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

Genuine gaps from that same list: **Evidence Engine™** (reasons exist scattered — WhyThisScore / AICommandCard.explanation / WhyThisForYouCard / personalizationSignals — but no unified engine guaranteeing every recommendation links to its real triggering signals); **Marketing Dashboard™** (none — metrics route to Command Center); **Garmin** (scaffold/demo only, needs OAuth creds).

**Why:** owner's rule is "build verified gaps only, leave existing untouched." Building any already-shipped item from the doc would duplicate/clobber flag-gated, tested code.
**How to apply:** before building any "missing/net-new" AForce feature, grep/explore the CODE (utils/, services/, components/, lib/, api-server routes, featureFlags/flags.ts) — not replit.md. Treat the doc as lagging the code, and offer to update the doc rather than rebuild the feature.
