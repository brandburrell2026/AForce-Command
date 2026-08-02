/**
 * Deterministic build configuration (NO-c native-evidence enabler).
 *
 * Selects the app identity from the TRUSTED build-time profile selector (via
 * `resolveBuildIdentity`, which fails closed on missing/unsupported/contradictory
 * input) and runs the internal-route synchronization BEFORE Expo Router route
 * discovery / bundling (create for `internal-native`, delete + verify for every
 * other profile — fail closed). Public `EXPO_PUBLIC_*` markers are validated, not
 * trusted, as the profile selector. Merges over `app.json` via Expo's `config`.
 */
import path from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { resolveBuildIdentity } from './internal-preview/buildConfig.mjs';
import { syncInternalPreviewRoute } from './internal-preview/routeSync.mjs';

export default ({ config }: ConfigContext): ExpoConfig => {
  const id = resolveBuildIdentity(process.env);

  // Establish the generated internal route deterministically before bundling.
  syncInternalPreviewRoute({ variant: id.variant, appDir: path.join(__dirname, 'app') });

  return {
    ...config,
    name: id.name,
    slug: config.slug ?? 'aforce-os',
    scheme: id.scheme,
    ios: { ...(config.ios ?? {}), bundleIdentifier: id.bundleId },
    extra: { ...(config.extra ?? {}), appVariant: id.variant },
  } as ExpoConfig;
};
