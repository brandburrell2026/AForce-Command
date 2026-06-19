---
name: AForce signal-quality layers (three distinct, do not merge)
description: How Verification Layer vs Signal Hierarchy vs Data Confidence Layer differ, and the locked rules for the Data Confidence Layer.
---

AForce OS has THREE separate pure "signal" layers that answer different
questions. They look related but must stay distinct — do not merge, replace,
or duplicate one inside another.

- **Verification Layer** (`utils/verification/verificationLayer.ts`) — *per-source
  TRUST* as a 0..1 weight by tier (phantom 1 / wearable 0.7 / phone 0.4). "How
  much do we trust the source feeding this?"
- **Signal Hierarchy** (`utils/signalHierarchy.ts`) — *source SELECTION*. Deterministic
  per-source priority order (replaces freshest-wins for picking WHICH source's
  value is used). Flag-gated (`signal_hierarchy_enabled`). "Which source wins?"
- **Data Confidence Layer** (`utils/confidence/dataConfidence.ts`) — *categorical
  COMPLETENESS* High/Medium/Low. "How much real, verified data is behind this
  engine's read?"

## Data Confidence Layer — locked rules
- Bands: total signals 0 → low; ≥2 verified → high; (1 verified OR ≥1 partial) →
  medium; only estimated → low. `coverage = (verified + 0.5·partial)/total`.
- `SignalQuality`: verified (present + trusted source) / partial (present but
  proxied/weak/self-report) / estimated (absent → engine defaults).
- One pure adapter per named consumer (Performance Age, Impact = the shared
  substrate for Command Confidence + Evidence via two thin wrappers, Performance
  Memory). Imports of consumer input TYPES are `import type` only (erased — no
  runtime utils→services coupling).
- Adapter rulings: Performance Age `activity` is NEVER verified (self-report /
  workout-load proxy → at best partial). Impact's `signalConfidence` gates ONLY
  the command/hydration floor (≥0.7 verified / >0 partial / 0 estimated);
  recovery & heat are verified purely on a finite before+after pair. Performance
  Memory is CAPPED at medium — self-report check-ins can never be "multiple
  verified signals".

**Why:** these layers were built incrementally under "Build 100% · Show 10%";
a future agent adding "confidence" risks re-implementing one of the three or
collapsing the trust/selection/completeness distinction.

**How to apply:** when wiring confidence into a surface later, consumers OPT IN
by CALLING an adapter — never widen a consumer's existing return type or add a
flag/UI/i18n without explicit owner approval (Score-Protection + Nav lock keep
all three layers headless and additive).
