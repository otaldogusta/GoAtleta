/* eslint-disable import/first */
jest.mock("../../api/web-push-subscriptions", () => ({
  registerWebPushSubscription: jest.fn(),
  unregisterWebPushSubscription: jest.fn(),
}));

import {
  getWebNotificationPermission,
  requestWebNotificationPermission,
} from "../web-notifications";

describe("web notification capability", () => {
  const originalNotification = window.Notification;

  afterEach(() => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: originalNotification,
    });
  });

  test("reports unsupported browsers", async () => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: undefined,
    });
    expect(getWebNotificationPermission()).toBe("unsupported");
    await expect(requestWebNotificationPermission()).resolves.toBe("unsupported");
  });

  test("requests permission only while undecided", async () => {
    const requestPermission = jest.fn().mockResolvedValue("granted");
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "default", requestPermission },
    });
    await expect(requestWebNotificationPermission()).resolves.toBe("granted");
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });
});
