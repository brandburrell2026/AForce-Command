/**
 * Hydration Demand Engine™ — mobile re-export shim.
 *
 * The implementation now lives in the shared workspace lib
 * `@workspace/demand-engine` so the api-server admin/debug surfaces
 * and the mobile app share a single source of truth. This file
 * exists so existing adapter, selector, and test imports under
 * `artifacts/aforce-os/services/hydrationDemandEngine` continue to
 * work unchanged.
 */
export {
  BASE_OZ_PER_LB,
  TARGET_FLOOR_OZ,
  TARGET_CEILING_OZ,
  ACTIVITY_ANCHOR,
  OZ_PER_ACTIVITY_POINT,
  SWEAT_ADDER_OZ,
  ENV_ADDER_OZ,
  HEAT_THRESHOLD_C,
  OZ_PER_C_OVER_THRESHOLD,
  CYCLE_OZ,
  computeHydrationDemand,
} from "@workspace/demand-engine";
export type {
  SweatProfile,
  EnvironmentProfile,
  HydrationDemandInputs,
  HydrationLoad,
  HydrationDemandOutputs,
} from "@workspace/demand-engine";
