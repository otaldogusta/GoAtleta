module.exports = function (api) {
  api.cache(true);
  const {
    expoImportMetaTransformPluginFactory,
  } = require("babel-preset-expo/build/plugins/import-meta-transform-plugin");
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [],
    overrides: [
      {
        test: (filename) =>
          Boolean(filename) && /node_modules[\\/]+yoga-layout[\\/]+dist[\\/]+src[\\/]+load\.js$/.test(filename),
        plugins: [expoImportMetaTransformPluginFactory(true)],
      },
      {
        test: (filename) =>
          Boolean(filename) &&
          /node_modules[\\/]+yoga-layout[\\/]+dist[\\/]+binaries[\\/]+yoga-wasm-base64-esm\.js$/.test(filename),
        plugins: [expoImportMetaTransformPluginFactory(true)],
      },
    ],
  };
};
