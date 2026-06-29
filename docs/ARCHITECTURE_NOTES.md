# Architecture notes

Explicit, reviewed architectural boundaries and trade-offs — recorded so they don't stay implicit in code comments. Each entry names the thing that bites if the boundary is crossed without revisiting it.

## V1 trust boundary — profile version minting

`POST /api/aforce/profile/version` trusts client-computed `changedFields` / `explanation` / `initialConfidence`; the server does **not** re-derive them. Safe for the current single-user / single-client app — there is no adversary, and integrity is still protected by the atomic `recordMajorChange` transaction. This boundary is about *who computes* the values, not whether the write is consistent.

The reason it lives on the client: the decision engine + thresholds live in the app package (`artifacts/aforce-os/services/adaptiveProfileEngine.ts` + `config/hydroStateModel.ts`, the brief-mandated single home for thresholds), which the api-server can't cleanly import.

**BEFORE multi-device or any untrusted client:** move classification + confidence derivation server-side — a shared package, or have the api-server import the engine — so the server is authoritative for what mints a version. (Reviewed and accepted as the V1 trade-off; Section 18.)
