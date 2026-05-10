/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-no-react-native",
      comment: "src/core should stay platform-agnostic.",
      severity: "warn",
      from: { path: "^src/core/(?!__tests__/)" },
      to: { path: "^(react-native|expo($|[-/]))" },
    },
    {
      name: "core-no-ui",
      comment: "src/core should not depend on UI or screen layers.",
      severity: "warn",
      from: { path: "^src/core/(?!__tests__/)" },
      to: { path: "^src/(ui|screens)/" },
    },
    {
      name: "core-no-media-generation",
      comment: "src/core should not depend on media generation adapters.",
      severity: "warn",
      from: { path: "^src/core/(?!__tests__/)" },
      to: { path: "^src/(media(-generation)?|exercise-media)/" },
    }
  ],
  options: {
    doNotFollow: {
      path: "node_modules"
    },
    includeOnly: "^src",
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"]
    }
  }
};
