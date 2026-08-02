/**
 * NO-c native-evidence enabler — internal-build eligibility gate (PURE).
 *
 * This whole `internal-preview/` tree lives OUTSIDE `app/` and is imported only by
 * the internal route that is GENERATED into `app/` for the `internal-native` build
 * (see `routeSync.mjs`). It is structurally absent from production bundles.
 *
 * The gate FAILS CLOSED: the internal evidence control is eligible only when every
 * condition below holds. Environment variables are BUILD SELECTORS, not
 * authorization credentials — the real gates are the build identity (items 5–6)
 * and, for navigation, the sanctioned Night Out access check performed separately.
 */

export const PRODUCTION_BUNDLE_ID = 'com.aforce.os' as const;
export const INTERNAL_BUNDLE_ID = 'com.aforce.os.internal' as const;
export const INTERNAL_PROFILE = 'internal-native' as const;

export interface InternalBuildInputs {
  /**
   * Trusted BUILD-TIME profile selector (EAS_BUILD_PROFILE / APP_PROFILE). It is
   * NOT `EXPO_PUBLIC_*` so it is NOT in the client bundle — hence usually `null`
   * at runtime. Used by `app.config.ts` at build time; when present it must match
   * the internal profile, when absent the native identity carries the proof.
   */
  buildProfile?: string | null;
  /** Public presentation marker EXPO_PUBLIC_APP_VARIANT (DERIVED from the profile at build time). */
  appVariant?: string | null;
  /** Public presentation marker EXPO_PUBLIC_INTERNAL_PREVIEW. */
  internalPreview?: string | null;
  /** DEMO_MODE (EXPO_PUBLIC_DEMO_MODE === 'true'). */
  demoMode: boolean;
  /** Native application identifier (expo-application) — the runtime trust anchor. */
  applicationId?: string | null;
}

/**
 * True only for an authorized internal-native evidence build. Fails closed on any
 * missing/contradictory input.
 *
 * The runtime trust anchor is the NATIVE BUNDLE IDENTITY (`com.aforce.os.internal`):
 * only the internal-native profile produces it, and production (`com.aforce.os`)
 * can never satisfy it — so public env markers alone can never enable the control.
 * A build-time `buildProfile`, when available, must additionally match the named
 * internal profile (extra strictness at config time); when absent (normal runtime)
 * the identity + derived markers carry the proof.
 */
export function isInternalEvidenceBuild(i: InternalBuildInputs): boolean {
  // 5–6 · build identity: must equal the internal bundle id. This alone excludes
  //     production (`com.aforce.os`), which can never equal `com.aforce.os.internal`.
  const internalIdentity = i.applicationId === INTERNAL_BUNDLE_ID;
  // 1 · profile: build-time selector must match when present; never trust a
  //     non-internal selector.
  const profileOk = i.buildProfile == null || i.buildProfile === INTERNAL_PROFILE;
  // 2–4 · derived public presentation markers.
  const markers =
    i.appVariant === 'internal' && i.internalPreview === 'true' && i.demoMode === true;
  return internalIdentity && profileOk && markers;
}
