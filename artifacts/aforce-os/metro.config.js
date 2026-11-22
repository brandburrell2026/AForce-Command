const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// LOCAL DEVELOPMENT ONLY (opt-in: AFORCE_DEV_DEDUPE=1). On a pnpm install with
// the default isolated layout, a workspace package with a different
// @types/react peer pulls a SECOND copy of react-native and expo-modules-core
// into the bundle. Two copies means two native view registries, and native
// views (LinearGradient, Camera, …) fail to render. Cloud builds are not
// affected and never set this flag, so their bundles are unchanged.
if (process.env.AFORCE_DEV_DEDUPE === "1") {
  const appOrigin = path.join(__dirname, "package.json");
  const expoOrigin = require.resolve("expo/package.json");
  const single = { "react-native": appOrigin, react: appOrigin, "expo-modules-core": expoOrigin };
  const previous = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const name = Object.keys(single).find((n) => moduleName === n || moduleName.startsWith(`${n}/`));
    const ctx = name ? { ...context, originModulePath: single[name] } : context;
    return (previous ?? context.resolveRequest)(ctx, moduleName, platform);
  };
}

module.exports = config;
