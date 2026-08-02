const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// NO-c native-evidence enabler — production-isolation belt.
// The internal-preview tree is bundled ONLY for the internal-native build. For any
// other profile, block its resolution so an accidental import cannot ship it. The
// generated `app/internal-preview.tsx` is also removed by routeSync (app.config).
const isInternal =
  (process.env.EAS_BUILD_PROFILE || process.env.APP_PROFILE) === "internal-native";
if (!isInternal) {
  const blockInternalPreview = /[\\/]internal-preview[\\/]/;
  config.resolver = config.resolver || {};
  const existing = config.resolver.blockList;
  config.resolver.blockList = existing
    ? [].concat(existing, blockInternalPreview)
    : blockInternalPreview;
}

module.exports = config;
