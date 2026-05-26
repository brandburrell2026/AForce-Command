---
name: AForce OS architecture lock
description: The locked product/engine architecture for AForce OS. Use whenever someone proposes a redesign, new tab, dashboard expansion, or new screen — the lock forbids all of those.
---

The architecture is **locked**. Rules that override any other instinct:

- **No redesign.** No new navigation. No new tabs. No new icons. No dashboard expansion. Orb and Timeline UI are frozen.
- **Build 100%. Show 10%. Unlock over time.** Every new capability ships behind a feature flag, OFF in prod, ON in DEMO_ALL_ON.
- **One Engine. Multiple Experiences.** Engine gets smarter; screens stay simpler. PUBLIC / CLUTCH / GUARDIAN are visibility filters over the same engine, not separate logic.
- **Profile is the single source of truth.** Required fields: Weight, Activity, Goal. Every module reads from Profile — no duplicate profile state anywhere.
- **Intelligence Layer is internal.** Primary OpenAI, secondary Claude, replaceable. Model names are never exposed to users. The layer outputs Command / Coach / Orb / Story / Target.
- **HydroScan never raises the score.** Only completed actions update score.
- **Recovery Layer stays hidden through Phase 2.** Reveals: Phase 3 Recovery Pressure™, Phase 4 Recovery Fingerprint™, Phase 5 Recovery Identity™. No new screens at any phase.

**Engine modules called for by the lock** (build order is not prescribed, but each is its own module): Hydration Demand Engine™, Electrolyte Need, PRELOAD™, AForce Format Engine™, Biometric Provider normalization (priority: Phantom → Wearables → Phone → Manual), Recovery Readiness™ (READY / BUILDING / RESET), Thermal Rhythm™ (GOOD / WARM / RECOVERING). PRELOAD output is action-only — never a forecast.

**Compliance — copy must never say:** "treats", "prevents", "blood pressure", "blood pH", "alkaline bloodstream", or any medical electrolyte claim. Approved phrasings: "supports hydration", "supports recovery", "supports performance habits", "supports hydration behavior". Applies to app, site, deck, App Store / Play listings.

**Why:** Founder issued this as a FINAL lock after the MVP was approved. Deviating from it (adding a screen, exposing a model name, leaking a medical claim, splitting Profile state) wastes work because it will be reverted, and the compliance items create real legal exposure for a CPG/health-adjacent brand.

**How to apply:** Before starting any AForce work, check this file. If a request seems to violate the lock (e.g. "add a recovery dashboard"), surface the conflict and propose the in-lock alternative (hidden engine + existing surface) rather than building the violation.
