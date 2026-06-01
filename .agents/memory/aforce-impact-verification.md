---
name: AForce Impact Engine & Verification Layer
description: Two pure internal engines that close the action loop and grade signal-source trust; build-lock + Score-Protection constraints they must obey.
---

# Impact Engine & Verification Layer (pure, internal)

Both are delivered as pure, internal engine modules with unit tests and NO UI / nav / store
wiring — mirroring the existing internal no-UI analytics engine. This is the locked-in shape for
additive engine work under the build-lock (no new screens/tabs/dashboards).

## Verification Layer
Grades the *trust in the signal source* feeding a command. Tier priority is
**Phantom → Connected Wearables → Phone/Manual self-report**.

**Why:** Phantom is positioned as native infrastructure ABOVE wearables, but it must never become a
dependency. Phone/self-report is the GUARANTEED floor so the loop never goes dark — users without
Phantom keep full functionality, just lower confidence.

**How to apply:**
- It sits ON TOP of the freshest-wins biometric merge — it does NOT change per-metric merging.
- Phantom is a separate service (a connection state machine), not in the HealthProviderId catalog, so
  the layer takes a boolean `phantomConnected`, not a provider id.
- Wearable corroboration raises confidence but is capped strictly below the phantom tier.
- The phone floor is UNCONDITIONAL. Do not add a `phoneInputsAvailable`-style flag — a removed flag
  that the impl silently ignores is an API contract bug (caught in review). If you ever model an
  "empty" state, do it explicitly elsewhere, not by weakening the floor.

## Impact Engine
Closes the loop Signal → Command → Action → **Impact**: did the completed command actually improve the
outcome? Reads before/after of whatever signals exist and emits summary / trend / reinforcement /
commandConfidence.

**Why:** Score Protection Rule — only completed behavior changes score. Impact only MEASURES; it must
NEVER mutate score or state. Confidence is scaled by the Verification Layer's signal quality
(best-available source). Reinforcement copy is positive-only / water-first, never a downer.

**How to apply:**
- `commandConfidence` multiplies a magnitude-based base by `signalConfidence`, so better signal ⇒ more
  confidence.
- `foldCommandConfidence` is a pure EMA whose step scales with the observation's signalConfidence, so
  low-quality reads barely move an established belief — this is the learn-over-time hook. Persistence is
  the caller's job; nothing is wired/stored.
