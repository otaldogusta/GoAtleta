const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");
const path = require("node:path");

const config = getSentryExpoConfig(__dirname);

// Allow package exports while keeping legacy deep imports mapped.
config.resolver.unstable_enablePackageExports = true;
// Keep React 19 on the client build and avoid ESM helper interop mismatches in web dev.
//
// HYPOTHESIS (high confidence, pending runtime validation after `expo start --clear`):
// With unstable_enablePackageExports=true, including "react-native" in conditionNames may
// cause Metro to resolve react-native's native exports map entry before the Expo CLI web
// alias (react-native → react-native-web) can intercept — particularly in lazy-loaded
// chunks — producing "ReferenceError: useWindowDimensions is not defined".
//
// This conclusion is project-specific: it depends on the interaction between
// unstable_enablePackageExports, the Expo CLI resolveRequest alias, and the shape of
// react-native's package.json#exports. Do not generalise to other projects without
// verifying the same conditions hold.
//
// Validation: restart with `npx expo start --web --clear` and confirm the error no longer
// appears in the console when navigating to /training. A Metro resolver trace
// (EXPO_DEBUG=true) or bundle diff would provide stronger evidence.
config.resolver.unstable_conditionNames = ["require", "browser"];
config.resolver.extraNodeModules = {
  "lodash/isEmpty": require.resolve("lodash/isEmpty"),
  "yoga-layout/load": require.resolve("yoga-layout/load"),
};
config.resolver.sourceExts = Array.from(
  new Set([...(config.resolver.sourceExts || []), "cjs"])
);

// Keep local QA/build artifacts out of Metro's Windows file map. The project
// creates thousands of nested files under tmp/ and generated output folders;
// watching those directories can exhaust the process handle limit and surface
// as EMFILE / "Could not load bundle" in the development client.
const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const projectRootPattern = __dirname
  .split(path.sep)
  .map(escapeRegExp)
  .join("[\\\\/]");
const generatedOutputPattern = new RegExp(
  `^${projectRootPattern}[\\\\/](?:dist|storybook-static|outputs?|tmp|\\.tmp|artifacts|\\.vercel|\\.codex-(?:artifacts|doc-build|logs|runtime|tmp)|\\.expo-(?:release-check|web-build-check2?))(?:[\\\\/]|$)`
);

config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  generatedOutputPattern,
];

module.exports = config;
