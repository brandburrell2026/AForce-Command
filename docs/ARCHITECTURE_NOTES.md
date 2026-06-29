# Architecture notes

Explicit, reviewed architectural boundaries and trade-offs — recorded so they don't stay implicit in code comments. Each entry names the thing that bites if the boundary is crossed without revisiting it.

## V1 trust boundary — profile version minting

`POST /api/aforce/profile/version` trusts client-computed `changedFields` / `explanation` / `initialConfidence`; the server does **not** re-derive them. Safe for the current single-user / single-client app — there is no adversary, and integrity is still protected by the atomic `recordMajorChange` transaction. This boundary is about *who computes* the values, not whether the write is consistent.

The reason it lives on the client: the decision engine + thresholds live in the app package (`artifacts/aforce-os/services/adaptiveProfileEngine.ts` + `config/hydroStateModel.ts`, the brief-mandated single home for thresholds), which the api-server can't cleanly import.

**BEFORE multi-device or any untrusted client:** move classification + confidence derivation server-side — a shared package, or have the api-server import the engine — so the server is authoritative for what mints a version. (Reviewed and accepted as the V1 trade-off; Section 18.)

## Baseline confidence is completeness-blind (Section 20 → deferred to §55)

`initialConfidence` (Section 18) keys off first-baseline vs post-recalibration only — it does **not** factor how complete the §19 profile inputs were. So a recalc off a mostly-empty profile opens its baseline at the same confidence as a fully-filled one. The recalibrated *targets* themselves are honest about missing data (an output whose anchoring input is null is stored as `null`, never a fabricated number — see `bodyRecalibrationEngine.ts` missing-input policy), but the confidence scalar doesn't yet reflect input completeness.

Weighting confidence by profile completeness is **Section 55 (Profile Completeness™)** — "Completeness naturally improves HydroState Confidence over time." Deliberately out of scope for §20; implement when §55 lands. (Reviewed Section 20.)
