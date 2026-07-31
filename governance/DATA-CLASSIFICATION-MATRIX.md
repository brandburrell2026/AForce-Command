# Data Classification Matrix

**Status:** Canonical · **Updated:** 2026-07-22 (Phase 2)
**Governed by:** Constitution Principle 7 ("Who sees this data, and why, must be answered before
any feature ships"); `docs/COMPLIANCE_FRAMEWORK.md` §5–§9; §41 Provenance & Retention.

Classifies every data class the intelligence layer touches. **A system may not ship a surface
until every class it reads appears here.**

---

## 1. Sensitivity classes

| Class | Definition | Handling |
|---|---|---|
| **S0 — Derived, non-identifying** | Computed values with no personal detail (band label, confidence figure). | Standard app storage. |
| **S1 — Personal behavioral** | What the user did and when (intake events, command completions, check-ins). | On-device first; encrypted at rest server-side. |
| **S2 — Personal physiological** | Body measurements, wearable biometrics, sleep, recovery. | Encrypted at rest; explicit consent per source. |
| **S3 — Sensitive / regulated** | Camera imagery (HydroScan, skin), health-app data (HealthKit). | Explicit per-feature consent; never used for advertising; strictest retention. |
| **S4 — Identity / credential** | Auth identity, payment identity. | Never touched by the intelligence layer. |

## 2. Existing data classes

| Data class | Sensitivity | Source | Consumed by |
|---|---|---|---|
| Intake events (rolling) | S1 | User logging | HydroState™, Performance Memory™, §38 |
| Command issue / completion | S1 | Today's Command | Command Confidence™, §38, §59 |
| Voice check-ins (energy 1–5) | S1 | Voice check-in | Performance Memory™, §59, §38 |
| Performance Age snapshots | S0/S1 | Daily snapshot | Performance Memory™, §38 |
| Adaptive Profile fields | S2 | Onboarding + edits | Adaptive Performance Profile™, recalibration |
| Body measurements (weight, height) | S2 | Profile | Body Recalibration Engine™ |
| Wearable biometrics | S2 | WHOOP / HealthKit / Garmin | Sleep Readiness™, Recovery Window™, §38 |
| HydroScan imagery | **S3** | Camera | HydroScan™ — **advisory only, never mutates score (DR-001)** |
| Weather / location context | S1 | OpenWeather, device | Environmental Pressure™, Climate Profile™, §38 |
| Personal Response Library | S1 | Derived from §59 | §59, §61, §38 |

## 3. New data classes introduced by §38–42

**No new raw collection.** Every class below is *derived* from data already collected and
consented. This is a deliberate constraint: the new systems reorganize existing data rather than
widening the collection surface.

| Data class | Sensitivity | Derived from | Notes |
|---|---|---|---|
| **Graph nodes** (context / behavior / outcome) | S1 | Existing ledger events | Created only from real recorded events; never inferred, never seeded |
| **Graph edges** (observed co-occurrence) | S1 | Nodes + ledger | Carries observation count, confidence, provenance |
| **Provenance records** (§41) | S1 | Edge → source event ids | Makes Principle 3 mechanically enforceable |
| **Projections** (§39) | S0 | Graph edges | Confidence-bound; expires; never stored as fact |
| **Patterns** (§40) | S1 | Graph edges over time | Includes contradictory evidence by construction |
| **Model version records** (§41) | S0 | Build metadata | See `MODEL-VERSION-REGISTRY.md` |

## 4. Retention and deletion

| Rule | Detail |
|---|---|
| **Derived data is subordinate** | Deleting source events invalidates every edge, projection, and pattern derived from them. Derived structures never outlive their sources. |
| **No orphan inference** | A pattern whose supporting events were deleted is retired, not preserved. |
| **Privacy Center (§51) governs** | Export and deletion flow through the existing Privacy Center contract. |
| **Performance Memory never overwrites history** | Existing rule; §38 append-only, consistent with it. |
| **Projections expire** | A §39 projection is valid only for its stated window; stale projections are discarded, never re-surfaced. |

## 5. Access

| Actor | Access |
|---|---|
| The user | Full — own data, own patterns, own provenance, with challenge/dismissal controls (Founder Decision 4) |
| AI Coach | Read-only, at inference time, per §64 |
| Founder Mode | Sandbox only; writes never reach Production (§62) |
| Demo Mode | Seeded demo data only (`data/demoProfile.ts`); writes nothing |
| Third parties | **None.** No intelligence data is sold, shared, or used for advertising. |

## 6. Persistence topology — settled by `DR-002`

**PostgreSQL is authoritative. The mobile cache is limited, encrypted, and non-authoritative.**

| Tier | Holds | Authority |
|---|---|---|
| **Server (PostgreSQL)** | canonical intelligence events · graph nodes · graph relationships · provenance · observation counts · confidence history · profile versions · baseline versions · model versions · invalidation and supersession status · prediction records · prediction outcomes · Performance DNA pattern history · audit records | **Authoritative** |
| **Device (encrypted cache)** | offline continuity · pending event sync · recent HydroState context · recent commands · selected graph-derived insights · current LPM snapshot | **Never authoritative** — server wins on conflict |

**Consequences carried into Phase 3:**

- **Encryption is new.** Every existing client store uses plaintext AsyncStorage. An encrypted
  bulk-cache strategy must be designed (`expo-secure-store` is keychain-backed and unsuitable for
  bulk payloads).
- **Per-user cache keying is mandatory** — scope durable local stores under a per-user key, never
  clear-on-sign-out, or a user switch exposes another person's intelligence.
- **No unrestricted permanent retention.** Retention, minimization, export, deletion and
  invalidation rules are required **per data class**.
- **Deletion is a propagation**, not a row removal: source deletion → evidence invalidation →
  graph recalculation/invalidation → LPM recalculation → Prediction review → DNA pattern review →
  user-facing outputs updated. **A derived relationship may not remain active when all supporting
  evidence has been deleted or invalidated.**
- **Deletion must reach the device cache**, not only the server.
