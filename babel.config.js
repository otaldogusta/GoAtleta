module.exports = function (api) {
  api.cache(true);
  const {
    expoImportMetaTransformPluginFactory,
  } = require("babel-preset-expo/build/import-meta-transform-plugin");
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [],
    overrides: [
      {
        test: /node_modules[\\/]+yoga-layout[\\/]+dist[\\/]+src[\\/]+load\.js$/,
        plugins: [expoImportMetaTransformPluginFactory(true)],
      },
      {
        test: /node_modules[\\/]+yoga-layout[\\/]+dist[\\/]+binaries[\\/]+yoga-wasm-base64-esm\.js$/,
        plugins: [expoImportMetaTransformPluginFactory(true)],
      },
    ],
  };
};
