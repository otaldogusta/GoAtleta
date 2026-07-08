import { Platform } from "react-native";

import type { CreateNotificationInput } from "./api/notifications";
import { addNotification } from "./notificationsInbox";
import {
  ensureAndroidNotificationChannel,
  ensureNotificationHandlerConfigured,
  getNotificationsModule,
  isExpoGo,
} from "./push/notificationRuntime";

export const requestNotificationPermission = async () => {
  if (Platform.OS === "web" || isExpoGo) return false;
  const Notifications = getNotificationsModule();
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
};

const ensurePermissions = async () => {
  return await requestNotificationPermission();
};

const sendLocalNotification = async (title: string, body: string) => {
  if (isExpoGo) return;
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  ensureNotificationHandlerConfigured();
  await ensureAndroidNotificationChannel();
  const granted = await ensurePermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
};

export const notifyTrainingCreated = async (
  options: Omit<CreateNotificationInput, "title" | "body" | "type"> = {}
) => {
  await addNotification(
    "Treino criado",
    "O assistente gerou um treino para você.",
    {
      ...options,
      type: "training_created",
      actionUrl: options.actionUrl ?? "/training",
      sourceType: options.sourceType ?? "training",
    }
  );
};

export const notifyTrainingSaved = async (
  options: Omit<CreateNotificationInput, "title" | "body" | "type"> = {}
) => {
  await addNotification("Treino salvo", "Treino salvo com sucesso.", {
    ...options,
    type: "training_saved",
    actionUrl: options.actionUrl ?? "/training",
    sourceType: options.sourceType ?? "training",
  });
};

export const notifyBirthdays = async (
  names: string[],
  options: Omit<CreateNotificationInput, "title" | "body" | "type"> = {}
) => {
  if (!names.length) return;
  const preview = names.slice(0, 3).join(", ");
  const extra =
    names.length > 3 ? ` e mais ${names.length - 3}` : "";
  const body = `Aniversariantes de hoje: ${preview}${extra}.`;
  await addNotification("Aniversariantes do dia", body, {
    ...options,
    type: "birthday",
    actionUrl: options.actionUrl ?? "/students/birthdays",
    sourceType: options.sourceType ?? "birthdays",
    metadata: {
      names: names.slice(0, 12),
      total: names.length,
      ...(options.metadata ?? {}),
    },
  });
  await sendLocalNotification("Aniversariantes do dia", body);
};
