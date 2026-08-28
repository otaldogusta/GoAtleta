// Keep React Native's fetch in Jest. Expo's lazy fetch getter can be resolved
// by Jest while a test environment is being torn down, producing late logs.
process.env.EXPO_PUBLIC_USE_RN_FETCH = "1";

module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^expo-modules-core$": "<rootDir>/node_modules/expo-modules-core",
    "^expo-modules-core/(.*)$": "<rootDir>/node_modules/expo-modules-core/$1",
  },
};
