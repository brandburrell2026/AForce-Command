# DR-004 — Encrypted Local Cache

- **Status:** ACCEPTED — settled. Closes **K-1**.
- **Date:** 2026-07-22 · **Decider:** Brandon (founder)
- **Governs:** every local store holding sensitive health, readiness or intelligence data
- **Related:** `DR-002`, `OPEN-RISKS.md` R-12, `governance/DATA-CLASSIFICATION-MATRIX.md`

---

## Decision

**All locally cached sensitive health, readiness and intelligence data must be encrypted at rest.**

| Requirement | Rule |
|---|---|
| Key storage | Device-specific key in the **OS keychain** via SecureStore or repository-approved equivalent |
| Cipher | **Authenticated encryption** — AES-256-GCM or platform-approved equivalent |
| Storage form | Encrypted structured storage or encrypted blobs, matched to volume and access pattern |
| Key metadata | **Explicit key-version metadata** |
| Rotation | Safe key rotation supported |
| Failure handling | Tamper and decryption-failure handling required |

**SecureStore must not be used as the bulk data store.** It may hold only key material, key
identifiers, and small security metadata.

## In scope (encryption required)

Locally stored data containing or derived from: health permissions · wearable observations ·
sleep · recovery · hydration · alcohol or caffeine events · workout or activity information ·
HydroState history · commands and outcomes · Performance Knowledge Graph data ·
Living Performance Model snapshots · predictions · Performance DNA patterns ·
sensitive user-uploaded information · anything classified **restricted or sensitive** in the
Data Classification Matrix.

## Out of scope (not automatically required)

Theme · general UI preferences · dismissed education screens · non-sensitive feature-tour state ·
ordinary navigation state.

## Migration of existing plaintext sensitive stores

Required behavior, in order:

1. detect legacy sensitive plaintext records;
2. encrypt into the approved store;
3. **verify integrity**;
4. remove the plaintext record **only after successful verification**;
5. record migration completion **without storing sensitive content in logs**;
6. on failure, **do not duplicate or partially expose** the record;
7. where server-canonical data exists, prefer **safe local removal + server rehydration** over a
   risky partial migration.

**Never log encryption keys, decrypted payloads, or sensitive migration contents.**

## Key loss or invalidation

- **Do not silently weaken encryption.**
- Clear the unreadable local sensitive cache.
- Preserve server-canonical records.
- Rehydrate only after authentication and consent requirements are satisfied.

## Phase 4 note

Stage 1–3 authorization permits **contracts and migration design only**. Encrypted-cache
implementation is **not yet authorized**.
