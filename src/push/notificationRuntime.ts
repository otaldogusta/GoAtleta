import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

let handlerConfigured = false;
let androidChannelConfigured = false;

export const ensureNotificationHandlerConfigured = () => {
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
  if (Platform.OS !== "android" || androidChannelConfigured) return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  androidChannelConfigured = true;
};

