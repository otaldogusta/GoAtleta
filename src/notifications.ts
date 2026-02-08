import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { addNotification } from "./notificationsInbox";

let handlerSet = false;
let channelSet = false;

export const requestNotificationPermission = async () => {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
};

const ensureNotificationHandler = () => {
  if (handlerSet) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  handlerSet = true;
};

const ensureAndroidChannel = async () => {
  if (Platform.OS !== "android" || channelSet) return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  channelSet = true;
};

const ensurePermissions = async () => {
  return await requestNotificationPermission();
};

const sendLocalNotification = async (title: string, body: string) => {
  ensureNotificationHandler();
  await ensureAndroidChannel();
  const granted = await ensurePermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
};

export const notifyTrainingCreated = async () => {
  await addNotification(
    "Treino criado",
    "O assistente gerou um treino para você."
  );
};

export const notifyTrainingSaved = async () => {
  await addNotification("Treino salvo", "Treino salvo com sucesso.");
};

export const notifyBirthdays = async (names: string[]) => {
  if (!names.length) return;
  const preview = names.slice(0, 3).join(", ");
  const extra =
    names.length > 3 ? ` e mais ${names.length - 3}` : "";
  const body = `Aniversariantes de hoje: ${preview}${extra}.`;
  await addNotification("Aniversariantes do dia", body);
  await sendLocalNotification("Aniversariantes do dia", body);
};
