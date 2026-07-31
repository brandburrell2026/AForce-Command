# Phase 3 · K — Risks and Decisions Required

**Status:** DESIGN ONLY. **Updated:** 2026-07-22

New decisions and risks surfaced by the Phase 3 design. Nothing here was known at Phase 2 close.

**[JB]** = requires both Julius and Brandon.

---

## 1. Decisions required before implementation

### K-1 — Encrypted device-cache strategy **[JB]** · 🔴 BLOCKING

`DR-002` requires an **encrypted** local cache. Every existing client store (`commandLedger`,
`hydroScanHistory`, `intakeOutbox`) uses **plaintext AsyncStorage**. `expo-secure-store` is a
dependency but is keychain/keystore-backed and unsuitable for bulk payloads.

**Options:** (a) key in SecureStore + AES-encrypted blob in AsyncStorage — *recommended*, works
today, no native module; (b) encrypted SQLite (SQLCipher/op-sqlite) — stronger, adds a native
dependency and an EAS build change; (c) OS file-level protection only — weakest, arguably not
"encrypted" as ruled.

**Also needed:** does this apply retroactively to the existing plaintext stores, or only to new
intelligence caches? A mixed posture is hard to defend.
**Blocks:** I-9 and any intelligence caching. `OPEN-RISKS.md` **R-12**.

### K-2 — Retention windows per data class **[JB]** · 🔴 BLOCKING

`DR-002` forbids unrestricted permanent retention; Phase 3 must propose explicit rules. The classes
exist (Output C §6) but **the windows are unset**.

The tension is real: a short `R-raw` window is better privacy but weakens graph rebuild after a
major model bump — with raw events aged out, history cannot be re-derived and past conclusions
become unreconstructable.
**Needed:** a window per class, and an explicit ruling on whether re-derivability or minimization
wins when they conflict. Likely a legal/privacy review input.
**Blocks:** I-1 (retention class is a column on the events table).

### K-3 — Account-wide deletion endpoint scope **[JB]** · 🟠

No account-wide deletion endpoint exists — only `POST /analytics/forget` (pseudonymous). The
`DR-002` cascade needs a broader path.
**Needed:** does account deletion remove intelligence data only, or all AForce data (profile,
versions, intake, scans)? Does it interact with Clerk account deletion? Is there a grace period?
**Blocks:** Output F §4.2 account-wide scope.

### K-4 — Back-derivation at first run · 🟡

Recommended (Output I §7): build the graph from existing ledger history so `DR-003` gates open
sooner. But it derives conclusions from data collected before the intelligence layer existed.
**Needed:** confirm back-derivation is acceptable, or require forward-only.
**Consideration:** forward-only means every existing user waits 7+ days from launch before any
personal prediction. That may be the honest choice.

### K-5 — Does Founder Mode inspection count as user-facing? · 🟡

`DR-003` makes the Founder Mode inspector DNA exposure step 1. §62 says Founder Mode is internal
only. The inspector shows **raw records, not user-facing copy**, so §42 arguably does not apply —
but "arguably" is not a ruling.
**Needed:** confirm §42 does not gate Founder Mode inspection (design assumes it does not).

### K-6 — Prediction types to launch with · 🟡

`DR-003` sets per-type thresholds but does not enumerate the types.
**Needed:** the initial list (e.g. hydration timing, heat response, sleep-debt recovery). Each
needs its own backtest and calibration.

### K-7 — Server-side derivation cost ownership · 🟢

Graph construction, prediction, and pattern detection run server-side per `DR-002`. This is new,
recurring compute and storage.
**Needed:** confirm this is accepted, and whether derivation is synchronous on ingest or a queued
background job (design assumes **queued**).

## 2. New risks

| ID | Risk | Sev | Mitigation |
|---|---|---|---|
| **R-12** | Device cache plaintext today; `DR-002` requires encryption | **S1** | K-1. No intelligence cache ships plaintext. |
| **R-13** | Cross-user cache leakage on user switch | **S1** | Per-user storage key + generation guard (intake-outbox precedent). Test §3. |
| **R-14** | Orphaned derived relationships surviving deletion | **S1** | Provenance reverse index; cascade; **property test** in J §4. |
| **R-15** | New sync/conflict surface | **S2** | Idempotency, server-wins, fail-closed degraded mode. |
| **R-16** | Context-only estimates read as personal predictions | **S2** | Four mandatory states; labeling enforced by §42 copy tests. |
| **R-17** | **Server-side S1/S2 derived data expands the breach surface.** Previously this data would not have left the device. | **S2** | Encryption at rest, retention limits, audit, minimization. Accepted trade-off of `DR-002` — recorded, not hidden. |
| **R-18** | **Derivation drift between client and server.** Both derive from the same pure modules; if they diverge in version, users see values flip. | **S2** | Server-wins; `model_version` on every record; client discards local derivation on conflict. |
| **R-19** | **Back-derivation is a bulk job** that could overwhelm the DB if run globally. | **S2** | Per-user, rate-limited, resumable, off the request path. K-4. |
| **R-20** | **`DR-003` thresholds are permissive** (7 days / 5 observations). Real risk of premature patterns. | **S2** | Explicitly beta defaults; backtesting (J §5) is the correction mechanism; four-state labeling prevents overclaiming. |

## 3. Legal / privacy review needed

| Item | Why |
|---|---|
| Retention windows (K-2) | Regulatory exposure |
| Account-wide deletion (K-3) | Data-subject rights |
| Server-side derived health-adjacent data (R-17) | S2 class now leaves the device |
| §39 prediction language | `Risk-Register.md` **CR-1** must explicitly cover §39 (`OPEN-RISKS.md` R-01) |
| Guardian copy (`DR-003`) | Must propagate to marketing and contracts, not just specs |

## 4. Scientific review needed

| Item | Why |
|---|---|
| `DR-003` sufficiency thresholds | Beta defaults, not validated science |
| Confidence formula (Output G §2) | Coefficients unvalidated |
| DNA hysteresis thresholds | Determine pattern stability |
| Prediction types (K-6) | Each needs a defensible basis |

## 5. Assessment

The design is **structurally sound and internally consistent**, and it is bounded by the right
invariants: Score Protection, the §42 gate, provenance-or-nothing, and the deletion propagation.

**Two decisions genuinely block implementation** — K-1 (encrypted cache) and K-2 (retention
windows). Both are direct consequences of `DR-002` and neither can be answered from existing
authority.

The rest can proceed in parallel. **I-0 through I-3** (audit/model-version tables, events,
provenance links, graph tables) depend on **K-2 only** for the retention-class column and are
otherwise unblocked and additive — no existing table is touched until I-4.
