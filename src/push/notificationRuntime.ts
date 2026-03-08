import { Platform } from "react-native";
import Constants from "expo-constants";

let handlerConfigured = false;
let androidChannelConfigured = false;

const appOwnership = String(Constants.appOwnership ?? "").toLowerCase();
const executionEnvironment = String(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Constants as any).executionEnvironment ?? ""
).toLowerCase();
export const isExpoGo = appOwnership === "expo" || executionEnvironment === "storeclient";

let notificationsModule: typeof import("expo-notifications") | null | undefined;

export const getNotificationsModule = (): typeof import("expo-notifications") | null => {
  if (Platform.OS === "web" || isExpoGo) return null;
  if (notificationsModule !== undefined) return notificationsModule;
  try {
    // Lazy-load to avoid Expo Go crash on module initialization.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    notificationsModule = require("expo-notifications") as typeof import("expo-notifications");
    return notificationsModule;
  } catch {
    notificationsModule = null;
    return null;
  }
};

export const ensureNotificationHandlerConfigured = () => {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  if (handlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
};

export const ensureAndroidNotificationChannel = async () => {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  if (Platform.OS !== "android" || androidChannelConfigured) return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  androidChannelConfigured = true;
};
