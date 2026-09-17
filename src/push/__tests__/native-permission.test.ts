import { Linking } from "react-native";
import { changeNativeNotificationPermission, readNativeNotificationPermission, requestInitialNotificationPermission } from "../native-permission";
import { getNotificationsModule, ensureAndroidNotificationChannel } from "../notificationRuntime";
jest.mock("../notificationRuntime", () => ({ getNotificationsModule: jest.fn(), ensureAndroidNotificationChannel: jest.fn() }));
const get = jest.fn();
const request = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (getNotificationsModule as jest.Mock).mockReturnValue({ getPermissionsAsync: get, requestPermissionsAsync: request, IosAuthorizationStatus: { PROVISIONAL: 3 } });
});
it("requests once for concurrent first-login callers, after channel creation", async () => {
  get.mockResolvedValue({ status: "undetermined", canAskAgain: true });
  request.mockResolvedValue({ granted: true });
  expect(await Promise.all([requestInitialNotificationPermission(), requestInitialNotificationPermission()])).toEqual([true,true]);
  expect(request).toHaveBeenCalledTimes(1);
  expect(ensureAndroidNotificationChannel).toHaveBeenCalledTimes(1);
});
it("does not ask again after refusal", async () => {
  get.mockResolvedValue({ status: "denied", granted: false, canAskAgain: true });
  expect(await requestInitialNotificationPermission()).toBe(false);
  expect(request).not.toHaveBeenCalled();
});
it("reads actual permission and opens system settings instead of faking OFF", async () => {
  get.mockResolvedValue({ status: "granted", granted: true });
  jest.spyOn(Linking, "openSettings").mockResolvedValue();
  expect(await readNativeNotificationPermission()).toBe(true);
  expect(await changeNativeNotificationPermission()).toBe(true);
  expect(Linking.openSettings).toHaveBeenCalled();
  get.mockResolvedValue({ status: "denied", granted: false });
  expect(await readNativeNotificationPermission()).toBe(false);
});
