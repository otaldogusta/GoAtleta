/* eslint-disable import/first */
const mockAddBreadcrumb = jest.fn();

jest.mock("@sentry/react-native", () => ({
  addBreadcrumb: (...args: unknown[]) => mockAddBreadcrumb(...args),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { eas: { projectId: "project-1" } } },
  },
}));

jest.mock("expo-notifications", () => ({
  IosAuthorizationStatus: { PROVISIONAL: 2 },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock("../../api/push-tokens", () => ({
  upsertMyPushToken: jest.fn(),
}));

import { resolvePushRoutePayload } from "../pushClient";

describe("pushClient resolvePushRoutePayload", () => {
  test("returns null when route is missing", () => {
    expect(resolvePushRoutePayload({})).toBeNull();
    expect(resolvePushRoutePayload(null)).toBeNull();
  });

  test("maps route with stringified params", () => {
    expect(
      resolvePushRoutePayload({
        route: "/class/[id]/attendance",
        params: { id: 123, date: "2026-02-26", empty: null },
      })
    ).toEqual({
      route: "/class/[id]/attendance",
      params: { id: "123", date: "2026-02-26" },
    });
  });
});

