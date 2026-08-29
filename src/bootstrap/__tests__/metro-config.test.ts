import path from "node:path";

jest.mock("@sentry/react-native/metro", () => ({
  getSentryExpoConfig: () => ({
    resolver: {
      blockList: [],
      sourceExts: [],
    },
  }),
}));

// The Metro config is CommonJS because it is loaded directly by Expo.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const metroConfig = require("../../../metro.config");

const isBlocked = (candidate: string) =>
  metroConfig.resolver.blockList.some((pattern: RegExp) => pattern.test(candidate));

describe("Metro generated-output exclusions", () => {
  it.each([
    "dist\\_expo\\static.js",
    "tmp\\device-captures\\screen.png",
    "storybook-static/index.html",
    "artifacts/design-qa/comparison.png",
    ".expo-web-build-check2/server/pages.json",
    ".codex-artifacts/reports/result.json",
  ])("does not watch generated path %s", (candidate) => {
    expect(isBlocked(path.resolve(process.cwd(), candidate))).toBe(true);
  });

  it("keeps application assets visible to Metro", () => {
    expect(isBlocked(path.resolve(process.cwd(), "assets/icons/icon.png"))).toBe(false);
    expect(isBlocked(path.resolve(process.cwd(), "src/ui/AppShell.tsx"))).toBe(false);
  });

  it("does not block generated folders inside dependencies", () => {
    expect(
      isBlocked(path.resolve(process.cwd(), "node_modules/example-package/dist/index.js"))
    ).toBe(false);
  });
});
