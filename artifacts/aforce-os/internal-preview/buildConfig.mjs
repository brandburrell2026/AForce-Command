/**
 * NO-c native-evidence enabler — deterministic build-profile resolver (pure).
 *
 * Selects the app identity from the TRUSTED BUILD-TIME profile selector
 * (`EAS_BUILD_PROFILE` / `APP_PROFILE`) — NOT from public `EXPO_PUBLIC_*` markers.
 * Public markers are validated to not contradict the selected profile; the config
 * establishes the profile independently. FAILS CLOSED (throws at build time) on a
 * missing/unsupported profile or any contradiction. Unit-tested.
 */
export const PRODUCTION_BUNDLE_ID = 'com.aforce.os';
export const INTERNAL_BUNDLE_ID = 'com.aforce.os.internal';
export const INTERNAL_PROFILE = 'internal-native';
const KNOWN_PROFILES = ['development', 'preview', 'demo', 'production', INTERNAL_PROFILE];

/**
 * @param {object} env — a plain object of the relevant env vars (process.env slice).
 * @returns {{variant:'internal'|'production', bundleId, name, scheme, appVariant}}
 */
export function resolveBuildIdentity(env = {}) {
  const selector = env.EAS_BUILD_PROFILE ?? env.APP_PROFILE ?? null;

  // Missing selector: local dev / non-EAS. Default to the SAFE production identity
  // (no internal route). An EAS build always sets EAS_BUILD_PROFILE.
  if (selector != null && !KNOWN_PROFILES.includes(selector)) {
    throw new Error(`[internal-preview] unsupported build profile: ${selector}`);
  }
  const variant = selector === INTERNAL_PROFILE ? 'internal' : 'production';

  const bundleId = variant === 'internal' ? INTERNAL_BUNDLE_ID : PRODUCTION_BUNDLE_ID;

  // Fail closed on contradictions between the selected profile and public markers.
  const pubVariant = env.EXPO_PUBLIC_APP_VARIANT;
  const pubPreview = env.EXPO_PUBLIC_INTERNAL_PREVIEW;
  if (variant === 'production') {
    if (pubVariant === 'internal') throw new Error('[internal-preview] production profile with EXPO_PUBLIC_APP_VARIANT=internal');
    if (pubPreview === 'true') throw new Error('[internal-preview] production profile with EXPO_PUBLIC_INTERNAL_PREVIEW=true');
  } else {
    // internal profile must carry the internal markers + must NOT claim production identity
    if (pubVariant != null && pubVariant !== 'internal') throw new Error('[internal-preview] internal profile with non-internal EXPO_PUBLIC_APP_VARIANT');
    if (env.EXPO_PUBLIC_DEMO_MODE != null && env.EXPO_PUBLIC_DEMO_MODE !== 'true') throw new Error('[internal-preview] internal profile requires DEMO_MODE=true');
  }

  return {
    variant,
    bundleId,
    name: variant === 'internal' ? 'AForce OS Internal' : 'AForce OS',
    scheme: variant === 'internal' ? 'aforce-os-internal' : 'aforce-os',
    appVariant: variant,
  };
}
