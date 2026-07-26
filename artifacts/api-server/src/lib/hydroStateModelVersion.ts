/**
 * HydroState scoring-model version — server-side mirror.
 *
 * ⚠️ THIS IS A MIRROR, NOT THE SOURCE OF TRUTH.
 *
 * The single authoritative runtime source is
 * `artifacts/aforce-os/config/hydroStateModel.ts` → `HYDROSTATE_MODEL_VERSION`
 * (founder Decision 1, `DR-009`).
 *
 * This mirror exists only because `api-server` and `lib/db` deliberately never
 * import from the app package — a boundary documented in
 * `lib/db/src/profileRepo.ts` and `routes/profile.ts` ("the engine +
 * config/hydroStateModel.ts live in the app package"). Importing the app config
 * here would invert the package layering and pull React Native app code into
 * the server bundle.
 *
 * DRIFT IS MECHANICALLY IMPOSSIBLE TO MISS: `__tests__/hydroStateModelVersionParity.test.ts`
 * imports BOTH this constant and the app constant and asserts they are
 * identical. This follows the established precedent in
 * `__tests__/subscriptionPlanParity.test.ts`.
 *
 * When the app constant changes, change this one in the same commit. The parity
 * test fails otherwise.
 */
export const HYDROSTATE_MODEL_VERSION = "hydrostate-v0";
