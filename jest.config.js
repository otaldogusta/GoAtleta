module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^expo-modules-core$": "<rootDir>/node_modules/expo/node_modules/expo-modules-core",
    "^expo-modules-core/(.*)$": "<rootDir>/node_modules/expo/node_modules/expo-modules-core/$1",
  },
};
