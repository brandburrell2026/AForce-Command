# Phase 3 · F — Privacy and Data Lifecycle Design

**Status:** DESIGN ONLY — nothing implemented. **Updated:** 2026-07-22
**Governed by:** `DR-002` · Constitution Principle 7 · `docs/COMPLIANCE_FRAMEWORK.md` §5–§9

---

## 1. Collection

**No new raw collection.** Every intelligence event derives from data already collected under
existing consent (`DATA-CLASSIFICATION-MATRIX.md` §3). Server-authoritative persistence changes
*where derived data lives*, not *what is gathered*.

| Source | Class | Consent |
|---|---|---|
| Intake, commands, check-ins | S1 | Existing app consent |
| Profile, body measurements | S2 | Existing profile flow |
| Wearables (WHOOP/HealthKit/Garmin/Oura/Strava) | S2 | Existing per-provider OAuth consent |
| Camera (HydroScan) | **S3** | Existing per-feature consent; advisory-only (DR-001) |
| Weather / location | S1 | Existing |

## 2. Minimization

| Rule | Application |
|---|---|
| Derived over raw | Relationships store counts and confidence, not copies of source payloads |
| Cache is **selected** insights | Not a graph replica — a strict, capped subset (`DR-002`) |
| No re-identification | Intelligence events are user-identified; `aforce_analytics_events` stays pseudonymous. **The boundary must not be crossed** (A4). |
| Descriptors normalized | Graph node descriptors carry the attribute, not the raw record |
| Provenance stores **references** | `aforce_provenance_links` holds ids, not duplicated content |

## 3. Retention

`DR-002`: **no unrestricted permanent retention.** Classes from Output C §6:

| Class | Applies to | Proposed | Rationale |
|---|---|---|---|
| `R-raw` | Primary events | Rolling window (config) | Needed for re-derivation after a major model bump |
| `R-derived` | Relationships, patterns, snapshots | Live while supported | Invalidated when unsupported |
| `R-ephemeral` | Predictions | `expires_at` + reconciliation window | Projections expire by design |
| `R-audit` | Audit, pattern history, model versions | Long-lived | These *are* the accountability record |
| `R-versioned` | Profile/baseline versions | Existing policy (never deleted) | Unchanged |

> **Unresolved:** exact windows per class are a founder/legal decision — Output K, **K-2**.
> A shorter `R-raw` window strengthens privacy but weakens re-derivation after a major model bump.
> The two pull against each other and the trade-off is not mine to set.

## 4. Deletion — the propagation

`DR-002` mandates this exact chain:

```
source data deletion
  → dependent evidence invalidation
  → graph relationship recalculation or invalidation
  → Living Performance Model recalculation
  → Prediction Engine review
  → Performance DNA pattern review
  → user-facing outputs updated where required
```

### 4.1 Mechanism

1. Delete source rows from `aforce_intelligence_events`.
2. Look up dependents via **`aforce_provenance_links` by `source_event_id`** — the reverse index
   exists precisely to make this a lookup rather than a full scan.
3. Recompute each dependent relationship's counts.
4. **Any derived record whose supporting evidence is entirely gone → `invalidated`. It may not
   remain active.** This is the hard invariant.
5. Re-evaluate DNA patterns; unsupported → `retired`, transition written to pattern history.
6. Regenerate or invalidate the LPM snapshot.
7. Invalidate affected predictions (`source_deleted`).
8. **Propagate to the device cache** — deletion that stops at the server leaves the user seeing
   deleted-derived content.
9. Write one `aforce_intelligence_audit` row for the whole cascade.

### 4.2 Scopes

| Scope | Effect |
|---|---|
| Single record | Cascade from that event |
| Date range | Cascade from all events in range |
| Data class | e.g. remove all wearable-derived events |
| **Account-wide** | Full erasure. **No such endpoint exists today** — must be built (Output E §2.1). |

### 4.3 What survives deletion

Audit records and pattern history are **retained** — they are the record *that* deletion happened,
and contain no derived claims about the person. Retaining them is what makes deletion auditable.

## 5. Export

| Property | Rule |
|---|---|
| Scope | Events, relationships, patterns, predictions, provenance, model versions |
| Format | Structured, machine-readable |
| Plain language | Patterns exported with their `explanation_key` resolved — an export the user cannot read is not really an export |
| Contradictions included | Counter-evidence exports too (Founder Decision 4) |
| Audited | Every export writes an audit row |
| Route | Privacy Center (§51) |

## 6. Invalidation (distinct from deletion)

Deletion removes source data. **Invalidation retires a conclusion while keeping the record that it
existed** — required for auditability and for explaining why something the user saw yesterday is
gone today.

Triggers (Output B §5): `source_deleted` · `profile_version_changed` · `baseline_recalibrated` ·
`model_version_major` · `contradicted` · `expired` · `superseded`.

## 7. Derived-data recalculation

| Trigger | Action |
|---|---|
| New events | Incremental graph update |
| Source deletion | Cascade (§4) |
| Major profile change | Invalidate baseline-relative conclusions; re-derive |
| Baseline recalibration | Confidence re-evaluated against the new baseline |
| Major model bump | **Re-derive or retire** — never silently reinterpret old records under new logic |
| Pattern dismissed | Retire; does not silently return |

## 8. Consent

| Item | Handling |
|---|---|
| Existing consents | Unchanged — no new collection |
| Intelligence processing preference | New field on `aforce_privacy` (**no JSONB default** — SCHEMA_DRIFT) |
| Withdrawal | Stops derivation and triggers the deletion cascade for derived data |
| Per-source revocation | Revoking a wearable invalidates conclusions derived from it |

## 9. Sensitive inference

The real risk of a knowledge graph: inferring something the user never disclosed and would not
expect.

| Guard | Rule |
|---|---|
| **No health inference** | Never a medical condition, diagnosis, or health status (Principle 5, §42) |
| **No protected-characteristic inference** | Never derive or store inferences about protected characteristics |
| **Observation only** | Relationships record what was *observed*, never what is *concluded about the person* |
| **No cross-user inference** | Never derive one user's pattern from another's data |
| **§42 gate** | Every user-facing output passes it, fail-closed |
| **Challenge/dismiss** | The user can reject any pattern (Founder Decision 4) |

## 10. Auditability

`aforce_intelligence_audit` records every access, export, deletion, invalidation, and re-derivation
with actor (`user` \| `system` \| `founder_mode`), scope, and affected counts.

Combined with `aforce_provenance_links` and `aforce_model_versions`, this answers the three
questions Principle 3 requires: **what was said, what it came from, and which logic produced it.**

## 11. Privacy-impact summary

| Dimension | Before | After `DR-002` | Net |
|---|---|---|---|
| Raw collection | — | **Unchanged** | Neutral |
| Derived data location | Device-only (proposed) | **Server-authoritative** | ⬆ exposure |
| Cross-device continuity | Lost on device change | Preserved | ⬆ utility |
| Deletion completeness | Device-local, unverifiable | Server cascade + audit | ⬆ **improved** |
| Explainability | Best-effort | Provenance-backed, mandatory | ⬆ **improved** |
| Device-at-rest security | Plaintext AsyncStorage | **Encryption required** | ⬆ improved *once built* (**R-12** open) |
| Retention | Unbounded local growth | Explicit classes | ⬆ improved |

**Assessment:** server-authoritative raises exposure of derived S1/S2 data, and that is a real
cost. It is offset by three things the device-only alternative could not offer — verifiable
deletion, mandatory provenance, and bounded retention. The **net posture improves**, conditional on
**R-12 (encrypted cache)** being resolved before any intelligence data is cached. If R-12 is not
resolved, the device becomes the weakest link and the assessment does not hold.
