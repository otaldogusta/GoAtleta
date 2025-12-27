module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|@react-native|react-clone-referenced-element|@expo|expo(nent)?|expo-router|@react-navigation/.*)",
  ],
};
