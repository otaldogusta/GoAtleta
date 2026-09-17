import { Linking } from "react-native";
import { ensureAndroidNotificationChannel, getNotificationsModule } from "./notificationRuntime";

let requestInFlight: Promise<boolean> | null = null;

export async function readNativeNotificationPermission() {
  const notifications = getNotificationsModule();
  if (!notifications) return false;
  const permission = await notifications.getPermissionsAsync();
  return permission.granted || permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** Never repeatedly prompt after denial; explicit profile actions can open Settings. */
export function requestInitialNotificationPermission(): Promise<boolean> {
  if (requestInFlight) return requestInFlight;
  requestInFlight = (async () => {
    const notifications = getNotificationsModule();
    if (!notifications) return false;
    await ensureAndroidNotificationChannel();
    const current = await notifications.getPermissionsAsync();
    if (current.granted || current.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL) return true;
    if (current.status !== "undetermined" || !current.canAskAgain) return false;
    const next = await notifications.requestPermissionsAsync();
    return next.granted || next.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
  })().finally(() => { requestInFlight = null; });
  return requestInFlight;
}

export async function changeNativeNotificationPermission() {
  const notifications = getNotificationsModule();
  if (!notifications) return false;
  const current = await notifications.getPermissionsAsync();
  if (current.status === "undetermined" && current.canAskAgain) {
    return requestInitialNotificationPermission();
  }
  await Linking.openSettings();
  return readNativeNotificationPermission();
}
