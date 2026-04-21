const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Allow package exports while keeping legacy deep imports mapped.
config.resolver.unstable_enablePackageExports = true;
// Keep React 19 on the client build and avoid ESM helper interop mismatches in web dev.
// `import` / `default` can resolve Babel helpers to ESM variants that break CJS interop.
config.resolver.unstable_conditionNames = ["require", "react-native", "browser"];
config.resolver.extraNodeModules = {
  "lodash/isEmpty": require.resolve("lodash/isEmpty"),
  "yoga-layout/load": require.resolve("yoga-layout/load"),
};
config.resolver.sourceExts = Array.from(
  new Set([...(config.resolver.sourceExts || []), "cjs"])
);

module.exports = config;
