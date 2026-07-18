# AForce OS — Architecture Appendix

Contains everything already built and specced. Every section carries a **Status** field.

**Status options:** Build Now · Architecture Only · Phase 2 · Phase 3 · Phase 4

> Governing documents: [`AForce-Constitution.md`](AForce-Constitution.md) and `AFORCE_OS_ARCHITECTURE_V1.md`. This appendix records build/phase status per section; it does not restate the full architecture.

---

## HydroState™ (Sections 1–17)

**Status:** Build Now (core), Phase 2 (Visual Intelligence, gated by `hydrostate_visual_enabled` until device/lighting validation complete).

## Sections 18–27 — Adaptive Profile & HydroState Intelligence

Adaptive Profile Engine, Performance Profile, Body Recalibration Engine, Sleep Readiness Intelligence, Tomorrow Load Forecast, Hydration Resilience Score, Oral Hydration Signal, Advanced Visual Intelligence, Personal Adaptive Learning, Performance Drift.

**Status:** Build Now (architecture), Phase 2 (surface).

## HydroScan™ (Sections 28–37)

Performance Decision Intelligence, Scan Anything, Performance Fit, Decision Confidence, Strengths & Considerations, Recovery Intelligence, Decision Memory, Integration Rule, Trust Principle, Global HydroScan.

**Status:** Build Now (base scan). See **DR-001** for launch-scope amendments.

> **Launch amendment — DR-001 (2026-07-17), controlling for launch:** §35 Integration
> Rule is **advisory-only** — HydroScan surfaces advisory signals and never mutates a
> score (Score-Protection isolation stays permanent). §32 / §33 / §34 / §29-OCR are
> **post-launch** (deferred, not defects); built-but-dark HydroScan 2.0 stays behind its
> flags, gated by CR-1. Full record:
> `governance/decisions/DR-001-hydroscan-integration-and-launch-scope.md`.

## Sections 47–52 — Engagement, Sharing & Transparency

Performance Sharing, Performance Referral, Year in Performance, Performance Status, Privacy Center, Explainability Center.

**Status:** Phase 2.

## Sections 53–57 — V1 Refinements

Data Freshness, Signal Quality, Profile Completeness, Universal Personalization, Performance & Battery Optimization.

**Status:** Build Now.

## Section 58 — Command Confidence Display

**Status:** Build Now.

UI surfacing on the existing Signal Weighting Engine and Command Confidence. **No new calculation logic.** Applies to Today's Command, HydroScan Performance Fit, Recovery Window, Sun Recovery Mode.

## Section 59 — Adaptive Response Engine (extends Decision Memory)

**Status:** Build Now.

Tracked categories: Heat, Hydration, Recovery, Sleep, Caffeine, Alcohol, Travel, Training, Cramp, Recovery Speed, Performance Consistency Response.

Includes Personal Response Library, What Worked, Confidence After Action.

**Language rule:** cause-and-effect only, never risk or diagnosis language. Never the words *risk, injury, diagnosis, prevent*. Recurring/severe symptoms always prompt physician consultation.

## Section 60 — Response Timeline

**Status:** Phase 2.

Query layer on existing Performance Memory. Feature flag defaults **off** until 60–90 days of personal data exists for that user.

## Section 61 — Living Performance Model

**Status:** Build Now (daily single-lesson surface only), Phase 2–4 (Your Body's Manual, Confidence Journey, Legacy summary).

User-facing language is always "**your body taught us**" — never "what did I learn about [name]." Long-term Legacy summaries never use prevention or causal medical language ("prevented X events"); always reflect completed behavior ("completed X commands, improved Y%, thank you for showing up").

**Silent Intelligence:** when on track, say so plainly — "You're exactly where you should be."

## Section 62 — Founder Mode & Four-Environment Architecture

**Status:** Build Now, internal only, never exposed in Production.

**Four environments:**

- **Production** — real users, phased by feature flag, reads/writes Production only.
- **Founder Mode** — Julius, Brandon, internal team only. Full unrestricted access to every feature regardless of phase, including features mid-build with no phase number yet assigned. Reads Sandbox or Production. Writes Sandbox only.
- **Engineering Sandbox** — infrastructure layer, separate responsibility from Founder Mode interface. Writes Sandbox only.
- **Demo Mode** — investors, scripted, reads seeded demo data only (`data/demoProfile.ts`), writes nothing.

**Founder Control Center** (built as part of Founder Mode):

- Instant per-feature toggle on/off
- View as Phase 1 / Phase 2 / Phase 3 / Phase 4
- Simulate new user / 30 days / 90 days / 1 year of usage (Time Travel)
- Simulate different user types — beta user, coach, parent, enterprise customer
- Compare versions side by side before release decisions
- Scenario Engine — pre-built real usage scenarios, at least one sourced from a real documented competitor failure (e.g. recurring cramping where sodium-only replacement failed), not only idealized personas

**Isolation:** separate database schema for Sandbox, persistent visual watermark (**FOUNDER MODE / SANDBOX**) whenever active. No additional overlapping safeguards beyond this unless a specific demonstrated problem requires it.

## Section 63 — Guardian, Clutch, Cruise Mode Compliance Pass

**Status:** Build Now (required revisions to existing specs, not new features).

- Profile recalibration always framed as performance optimization, never correction, never used for urgency/re-engagement.
- Guardian and Clutch are a stated exception to Principle 11 (trust over attention) — they serve a coach/staff safety relationship where active attention during risk windows is the explicit value delivered. This exception applies only to Guardian and Clutch.
- Cruise Mode streak mechanic requires revision: replace do-not-break-the-chain framing with the **Resolved Today / Carrying Forward** framing already proven in Evening Debrief. Never threaten loss of a streak if a day is missed.

## Section 64 — Conversational Intelligence Architecture™

**Status:** Build Now.

Governs the AI Coach behavior layer (`services/voiceService.ts` and any future conversational surface).

AForce OS is not an AI chatbot. The AI does not exist to answer questions. It exists to understand the person over time so well that fewer questions are ever necessary.

**Core behavior rules:**

1. The AI does not wait passively for input. It already knows enough about the user's current HydroState, Performance Memory, and recent patterns to speak first when speaking adds value — and to stay silent when it does not (per Constitution Principle 6).
2. Every conversation should make the next conversation shorter, not longer. A returning user should never have to re-explain context the OS should already know.
3. The AI earns trust by remembering, adapting, and speaking only when it adds value — never by being talkative, never by maximizing engagement through conversation volume.
4. Success is measured by reduction, not expansion: fewer clarifying questions needed over time, shorter time-to-command, less back-and-forth required for the user to get what they need.
5. When a user initiates a conversation, the AI always responds with full context already loaded — current HydroState, recent Adaptive Response patterns, active Recovery Window status, relevant Personal Response Library entries — never starting from zero.
6. The AI Coach speaks in the locked voice per coach persona (Rock, BB, Surge, Sage) and in the observation-only language already locked across every other module — markers suggest, never diagnosis, cause-and-effect from Personal Response Library, never population comparison.

**What this means in practice:** a standard AI assistant waits for a question, asks clarifying questions, then answers. AForce OS already initiates the relevant command before the user needs to ask, because HydroState, the Adaptive Response Engine, and Environmental Pressure already combined to determine the answer. If the user does ask anyway, the AI already has every relevant signal loaded and answers immediately, in one exchange, using the user's own history.

This section does not require new data architecture. It requires the existing voice and chat layer to be built against these behavior rules from the start, rather than defaulting to a standard question-and-answer chatbot pattern.
