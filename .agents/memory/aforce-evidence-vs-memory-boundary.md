---
name: AForce Evidence engine vs Performance Memory boundary
description: Why execution/longitudinal memory must stay OUT of the Evidence engine's provenance, and how to extend each.
---

# Evidence engine vs Performance Memory — keep them separate consumers

**Rule:** The Performance Memory™ "execution history / completion behaviour" expansion is
surfaced as its OWN flag-gated sub-readout *inside the Performance Memory card* (a separate
consumer of the shared command ledger). It must NOT be appended into the Evidence engine's
`deriveCommandEvidence` output, and Evidence's output shape must not be widened to carry it.

**Why:** The Evidence engine has a tight, fail-closed "why THIS command fired right now"
provenance contract — each evidence row is in lockstep with the live command decision and the
surface renders nothing when inputs are missing/stale. Folding longitudinal execution-memory
signals into that path dilutes the provenance ("why this command" becomes "your general
history") and erodes the fail-closed semantics. This was an explicit architect ruling during
the Performance Memory expansion: surface execution memory as its own additive sub-readout;
do not feed it into Evidence.

**How to apply:** When extending Performance Memory or Evidence, add new surfaces as additive,
flag-gated sub-readouts that read the shared ledger independently. Never widen the Evidence
engine's output to carry memory/longitudinal signals, and never make one engine depend on the
other's internals. Both stay flag-off = byte-identical production no-op.
