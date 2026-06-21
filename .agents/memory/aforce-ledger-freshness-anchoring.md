---
name: AForce command-ledger freshness anchoring
description: How the command-event ledger must record per-signal freshness so a reader never overstates confidence vs the live engine (Score-Protection).
---

# Command-ledger context-snapshot freshness anchoring

When a context snapshot (weather / biometrics) is written to the command-event
ledger, freshness must be anchored to **each signal's real SOURCE fetch time**,
not to the snapshot's observation/sync time.

**Rule 1 — anchor on source, not observation.** A snapshot carries optional
per-signal `weatherFetchedAtMs` / `biometricsFetchedAtMs`. The read adapter ages
each signal out against `*FetchedAtMs ?? occurredAtMs` (the fallback is for
legacy events only). If you anchor to the sync time, a reading fetched hours ago
but synced "now" stays fresh for a full window from sync — diverging upward from
the live engine. That is a silent confidence upgrade.

**Rule 2 — single clock, flag derived from anchor (fail-closed).** Build the
snapshot fields with ONE injected `now`, and derive the boolean FROM the anchor:
`hasFreshBiometrics = (biometricsFetchedAtMs != null)`. Two separate `Date.now()`
reads (one for the boolean, one for the anchor) can straddle the boundary →
flag `true` with a `null` anchor → reader falls back to observation time and
re-extends the window. The shared pure helper makes the impossible state
unrepresentable.

**Rule 3 — one shared helper for the hook AND its parity test.** The live wiring
hook and the parity-test "ledger from state" mirror must call the SAME pure
helper, or the parity test proves nothing (the mirror can drift from what ships).

**Why:** Score-Protection forbids the advisory confidence layer from looking
more certain than the live signals justify; freshness over-reporting is exactly
that, just deferred.

**How to apply:** Any new ledger signal with a freshness window needs its own
source timestamp + the flag-derived-from-anchor pattern, a parity case that
observes late then evaluates after expiry, and a boundary-sweep invariant test
(`flag === (anchor != null)`).
