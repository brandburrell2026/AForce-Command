# AForce OS — Legal, Compliance & Trust Framework

**Status:** Governing framework. Every module built for AForce OS inherits this document. It sits alongside `AFORCE_OS_ARCHITECTURE_V1.md` as a required reference for every engineering session.

**Version:** Draft v1 — architecture-stage framework. Built to be handed to counsel, not to replace them.

---

## ⚠️ Read first — what this document is and is not

- **This is an engineering and architecture compliance framework.** It defines how AForce OS is *built* so that privacy, compliance, trust, and regulatory awareness are designed into the platform from the start.
- **This is not legal advice, and it is not the final legal language.** Nothing here is a substitute for review by qualified counsel. All binding legal documents — Privacy Policy, Terms of Service, health disclaimers, consent language, data-processing agreements — are drafted, reviewed, strengthened, and finalized by AForce's attorneys before public launch.
- **The goal is to hand attorneys a platform already designed around compliance**, so their review strengthens and finalizes rather than rebuilds. It reduces expensive rework and lets the architecture scale cleanly as AForce grows.
- Where this framework and a future attorney-reviewed legal document disagree, **the attorney-reviewed document governs.**

---

## Governing sequence

The framework is built **now**, at architecture stage — not after beta. The sequence is:

1. **Lock the architecture.** (`AFORCE_OS_ARCHITECTURE_V1.md` — V1 locked after Sections 53–57.)
2. **Build the product correctly** — every module inheriting this framework by design.
3. **Beta test with real users** under the beta-validation and feature-flag rules below.
4. **Attorneys perform a complete legal review** before public release.
5. **Update every legal document to match the product that actually ships**, then finalize before public launch.

This order gives a stronger product, reduces rework, and produces a platform that scales cleanly.

---

## Compliance Inheritance Clause

> Every AForce OS module — current and future — inherits this framework automatically. A module specification does not restate these rules; it references this document and notes only where it needs *stricter* handling. No module may relax a standard defined here. If a module appears to require an exception, **stop and flag it for the founder and counsel** — do not implement the exception.

Modules currently in scope of inheritance: **HydroState™, HydroScan™, Performance Age™, Guardian™, Cruise Mode™, Clutch™, Sleep Readiness Intelligence™, Adaptive Performance Profile™, Evidence Engine™, Phantom Band™, Meridian™** — and every engine listed in the Master Architecture Engine Flow. Any new module inherits by default the moment it is created.

---

## 1. Compliance by Design

Compliance is an architectural property, not a launch checklist. Every engine is built so that the compliant path is the default path:

- Privacy, consent, transparency, and disclaimer requirements are wired into the data flow, not bolted on before launch.
- No engine ships a surface that would require a compliance exception to operate.
- The Evidence Engine™ is the single explainability spine — every recommendation can be explained back to the user in plain language (see §4).
- When a requirement here cannot be met by design, the feature stays behind a flag (see §10) until it can.

## 2. Observation, Never Diagnosis

AForce OS observes and optimizes performance. **It never diagnoses, treats, or offers medical advice.** This is a hard, non-negotiable boundary inherited from the architecture's core principle "Never diagnose."

- All signals — hydration, skin, oral, sleep, recovery — are framed as **performance observations compared only to the user's own baseline**, never against population norms or clinical thresholds.
- No output may state or imply a medical condition, deficiency, or diagnosis.
- Language stays in the performance/optimization register (see §14 Health Disclaimer Standards).
- Applies with particular force to §24 Oral Hydration Signal™ and §25 Advanced Visual Intelligence™ (camera).

## 3. AI Transparency & Disclosure

Users always know when they are interacting with AI and on what basis a recommendation was made.

- AI-generated coaching, voice, and recommendations are disclosed as AI (see §17 for standards).
- The Explainability Center™ (§52) lets users ask "Why did I receive this recommendation?" and get an answer in their own data.
- Confidence is disclosed honestly — Decision Confidence™ (§31) and Signal Quality™ (§54) never pretend certainty when data is incomplete.
- The OS never fabricates a number to fill a gap; a missing input yields an honest "limited data" state, not an invented value.

## 4. Evidence Engine Requirements

The Evidence Engine™ is the compliance backbone. Requirements every module must satisfy:

- **Every recommendation is explainable** — traceable to the user's own signals and profile.
- **Every recalibration is explained** (profile changes, baseline transitions — Section 18).
- Explanations use plain language and the user's own data, never clinical claims.
- No engine may surface a command that the Evidence Engine cannot explain.

## 5. Privacy by Design

Privacy is part of the product experience (Privacy Center™, §51), not a buried setting.

- Data minimization: collect only what an engine genuinely needs to personalize.
- Personal Baseline™ data stays scoped to the individual; users are never compared to one another.
- Users can view, download, and delete their data, and disable analysis surfaces, from within the product.
- Privacy defaults favor the user; sharing (§47–49) is always opt-in and never exposes weight, medical information, or private health data.

## 6. Data Collection & Retention Standards

- **Collection** is purpose-bound: each data type maps to a named engine and a stated purpose.
- **Retention** follows Performance Memory™'s append-only model — historical performance is preserved, never overwritten — balanced against the user's right to delete (§51).
- Deletion requests are honored end-to-end, including derived records, subject to counsel-defined legal-retention exceptions.
- Retention schedules and lawful bases are **finalized by counsel** before launch; this section defines the architectural hooks that make them enforceable.

## 7. Camera & Wearable Consent Standards

- **Camera (§25 Advanced Visual Intelligence™) requires explicit, informed, opt-in consent** and remains behind a feature flag, disabled in production, until legal/regulatory review is complete (biometric-data law, Apple health/camera privacy review, medical-claims review). This matches the standing architecture decision to keep the camera surface dark.
- **Wearable connections** (Apple Watch, Garmin, Samsung, WHOOP, Oura, future Phantom Band™) require explicit user authorization and are disconnectable at any time (§51).
- Consent is granular (per surface), revocable, and logged. Revocation stops collection and is honored immediately.
- Biometric and health-adjacent data receive the strictest handling defined in this framework.

## 8. User Permission Requirements

- Every sensitive capability (camera, location, notifications, health/wearable data, microphone for Voice Mode™) is gated behind an OS-level permission requested in context, with a plain-language reason.
- Permissions are inspectable and revocable from the Privacy Center™ (§51) without contacting support.
- Denied permissions degrade gracefully — Signal Quality™ (§54) redistributes weighting; the OS never fails because one signal is unavailable.

## 9. Security Standards

- Secrets (Stripe, Clerk, database, API keys) are never logged, printed, copied, or committed. Confirming a variable exists is fine; revealing or moving its value is not.
- Production secrets are pulled from managed connectors at boot, not stored in client-readable env.
- `EXPO_PUBLIC_*` is the only prefix exposed to the client bundle; anything sensitive stays server-side.
- Transport encryption, least-privilege data access, and secure session handling are baseline expectations; specifics are hardened with counsel and security review before launch.

## 10. Feature Flag Policy

- Any surface that is not yet cleared for production — legally, medically, or from a privacy standpoint — ships **behind a feature flag, defaulted OFF in production.**
- The camera capture surface (§25) is the canonical example: engine/data wiring may be built, but capture stays dark until sign-off.
- A flag is only flipped ON in production after the relevant review gates (§15, §16) are cleared and recorded.
- No flag is enabled for beta that would expose users to an uncleared legal or medical surface.

## 11. Beta Validation Requirements

- Beta runs under real-user validation (see `validation-methodology.md`) with only cleared surfaces enabled.
- Uncleared surfaces (e.g. camera capture) stay flagged OFF during beta.
- Beta collects the evidence attorneys need for their pre-launch review — actual data flows, actual disclosures, actual consent UX — so the legal review matches the product that will ship.
- Findings from beta feed back into both the architecture and this framework before launch.

## 12. Accessibility Standards

- The OS targets accessible-by-default UI: sufficient contrast, scalable type, screen-reader compatibility, and non-color-dependent status cues (important given the brand status-color system).
- Voice Mode™ (Part F, Operating Modes) is treated as an accessibility surface as well as a convenience.
- Accessibility is validated during beta and aligned to platform (Apple / Google) accessibility expectations before launch.

## 13. App Store & Google Play Compliance

- The app conforms to Apple App Store and Google Play policies for **health & wellness** apps, data-use disclosure, and privacy labeling (Apple Privacy Nutrition Labels / Google Data Safety).
- No medical claims in store listings, screenshots, or metadata (ties to §2 and §14).
- Camera, health, and wearable data usage are declared accurately in store privacy disclosures.
- Store-review readiness is a launch gate (§16).

## 14. Health Disclaimer Standards

- The OS presents a clear, standing disclaimer that it provides **performance and wellness information, not medical advice, diagnosis, or treatment**, and that users should consult a professional for medical concerns.
- Disclaimer language is surfaced where users act on guidance, not buried once at signup.
- All copy stays in the performance register; "observation, never diagnosis" (§2) governs wording.
- **Final disclaimer wording is drafted and approved by counsel.**

## 15. Internal Engineering Review Gates

- Every module is checked against this framework **before it is considered done**.
- If a task appears to require touching an off-limits area (scoring engine, status-color mapping, secrets, deployment/publishing, production data) — **stop and flag it for the founder.** Do not proceed.
- If a task appears to require a compliance exception, stop and flag it (per the Inheritance Clause).
- Camera/§25 and any flagged surface may not be enabled without an explicit recorded sign-off.

## 16. Legal Review Gates Before Public Launch

- No public launch until counsel has performed a **complete legal review** of the shipped product.
- Gate checklist (owned by counsel; engineering supplies the evidence): privacy policy & data flows, consent UX, health disclaimers, AI disclosures, biometric/camera clearance, store privacy declarations, retention & deletion behavior, security posture.
- Every legal document is updated to match the product that actually ships (governing sequence, step 5), then finalized.
- Flags for uncleared surfaces stay OFF until their specific gate is cleared and recorded.

## 17. AI Disclosure Standards

- AI-driven features (coaching, voice, recommendations, any generative output) are disclosed to the user as AI.
- Disclosure is honest about capability and limits — no implication of clinical judgment or certainty beyond what the data supports.
- AI outputs remain explainable through the Evidence Engine™ (§4) and honest about confidence (§3).

## 18. Module Compliance Inheritance — reference map

Every module inherits **all** sections above. This map highlights the sections that bite hardest per module; it does not narrow the inheritance.

| Module | Highest-attention sections |
|--------|----------------------------|
| **HydroState™** | §2 Observation-not-diagnosis, §4 Evidence, §5 Privacy |
| **HydroScan™** | §2, §3 AI transparency, §17 AI disclosure, Trust Principle™ (§36) |
| **Advanced Visual Intelligence™ (§25, camera)** | §7 Camera consent, §10 Feature flags, §13 store, §16 legal gate |
| **Performance Age™** | §2, §14 Health disclaimer, §3 confidence honesty |
| **Guardian™** | §2, §8 Permissions (notifications), §3 |
| **Cruise Mode™** | §5 Privacy, §6 Retention, §8 (location) |
| **Clutch™** | §2, §3 |
| **Sleep Readiness Intelligence™** | §7 Wearable consent, §6 Retention |
| **Adaptive Performance Profile™** | §4 Evidence (recalibration), §6 append-only retention, §5 |
| **Phantom Band™** | §7 Wearable consent, §5 Privacy, §9 Security |
| **Meridian™** | §4 Evidence, §3 AI transparency, §17 AI disclosure |
| **Voice Mode™** | §8 Permissions (microphone), §12 Accessibility, §17 |
| **Performance Sharing / Referral (§47–49)** | §5 Privacy, opt-in only, no health data exposure |

---

## Relationship to other documents

- **`AFORCE_OS_ARCHITECTURE_V1.md`** — the locked V1 architecture. This framework governs *how* those engines are built and shipped compliantly.
- **`validation-methodology.md`** — beta validation methodology referenced by §11.
- **`CLAUDE.md`** (project rules) — off-limits list and working agreement; §9 and §15 here are consistent with it.

*Prepared as the architecture-stage compliance framework for AForce OS. Not legal advice. Finalized by counsel before public launch.*
