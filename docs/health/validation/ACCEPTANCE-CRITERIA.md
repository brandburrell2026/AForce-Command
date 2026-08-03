# DEVICE-VALIDATED — Acceptance Criteria

**Last verified:** 2026-08-03
**Applies to:** every provider in `HEALTH_PROVIDER_CAPABILITIES` (`lib/health-core/src/contracts.ts`) that is not dormant/parked.

A provider is **DEVICE-VALIDATED** only when all 15 criteria below are met,
with evidence, for that specific provider. Partial credit does not exist —
see `VERDICT-DEFINITIONS.md` for how partial-but-non-blocking gaps are
recorded (PARTIAL, ticketed) versus what blocks a PASS entirely (FAIL).

These are the verbatim 15 criteria:

1. **Authorization succeeds on physical device or real cloud account.**
2. **Canonical normalization correct** — provider payload maps to
   `CanonicalHealthRecord` (or `ProviderSnapshot`) fields with correct
   units, correct HRV method attribution, and no shape drift silently
   dropped.
3. **Provenance correct** — the `provenanceChain` / native-origin
   attribution reflects reality: who measured it, who delivered it, and
   (for aggregator-relayed records) the correct native origin identifier.
4. **Freshness correct** — the presentation layer reflects actual data age
   (`connected` / `stale` / `no_recent_data`), never presents a stale
   snapshot as live.
5. **Incremental sync works** — a second, later sync fetches only new data
   (or correctly no-ops), without re-ingesting or losing prior records.
6. **Duplicate ingestion prevented** — the same observation arriving twice
   (retry, re-sync, or via two paths, e.g. Oura direct + Oura-via-HealthKit)
   is deduplicated per `dedupeRecords`'s documented invariants, with the
   drop reason preserved.
7. **Product surfaces consume canonical data** — Connected Health, Home,
   Sleep, Weekly, Readiness, and Evidence Engine render the same normalized
   record the ingestion pipeline produced, not a separate ad hoc read path.
8. **Disconnect works** — the user-initiated disconnect flow completes and
   the provider transitions out of `connected`/`connected_limited` state.
9. **Revocation result truthful** — the app never claims a revocation
   succeeded when the provider-side token was not actually invalidated (or
   when revocation is unsupported by the provider, it says so rather than
   claiming success).
10. **Snapshot removal works** — disconnect removes the served biometrics
    snapshot, not just the token.
11. **Account-deletion cleanup works** — a full AForce account deletion
    cascades to remove this provider's stored tokens and data.
12. **No score/governance invariant violated** — provider data never feeds
    the Hydration Score; provider scores (WHOOP recovery/strain, Oura
    readiness, Garmin stress, Strava training load) stay provider-attributed
    and are never relabeled or blended (Score-Protection, Constitution).
13. **Accessibility and error states pass** — screen-reader labels are
    correct for connected/disconnected/error/loading states; offline and
    retry states behave correctly, not just the happy path.
14. **Evidence captured** — a complete `EVIDENCE-TEMPLATE.md` packet exists
    for this validation run, redacted per `REDACTION.md`.
15. **Independent reviewer approves** — someone who did not perform the
    validation has reviewed the evidence per `REVIEW-CHECKLIST.md` and
    signed off.

## Notes on interpreting these criteria per provider

- **Apple HealthKit** has no OAuth revocation (criterion 9) — "truthful
  revocation result" for Apple means the app never claims it revoked
  HealthKit permissions (it cannot; only iOS Settings can), and correctly
  reflects the user's actual Health app permission state on next read.
- **Samsung Health (via Health Connect)** — criterion 3 (provenance) is
  Samsung's core risk: the record must always attribute to
  "Samsung Health via Health Connect," never presented as a direct
  connection (see `runbook-health-connect-samsung.md`).
- **WHOOP** — criterion 2 is constrained by the golden parity fixtures
  (`artifacts/api-server/src/__tests__/whoopParity/`, 27 tests); validation
  confirms the real account's data matches the pinned mapping contract, it
  does not re-derive or improve that contract (see `runbook-whoop.md`).
- **Garmin** is excluded from this program entirely (dormant, no partner
  credentials) — see `docs/health/garmin/`.
