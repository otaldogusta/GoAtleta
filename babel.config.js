module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [],
    overrides: [
      {
        test: /node_modules[\\/]+yoga-layout[\\/]+dist[\\/]+src[\\/]+load\.js$/,
        plugins: [require("babel-preset-expo/build/import-meta-transform-plugin")],
      },
    ],
  };
};
