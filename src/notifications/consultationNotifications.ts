import AsyncStorage from "@react-native-async-storage/async-storage";

import { sendPushToUser } from "../api/push";
import {
  buildConsultationNotification,
  type ConsultationNotificationPayload,
} from "../core/consultation";
import { addNotification } from "../notificationsInbox";
import { safeJsonParse } from "../utils/safe-json";

export type ConsultationNotificationDeliveryResult = {
  eventKey: string;
  internal: "created" | "skipped_duplicate" | "failed";
  push: "sent" | "skipped" | "failed";
  error?: string;
};

const STORAGE_KEY = "consultation_notification_events_v1";

const readDeliveredKeys = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const parsed = safeJsonParse<string[] | null>(raw, null);
  return Array.isArray(parsed) ? parsed : [];
};

const writeDeliveredKeys = async (keys: string[]) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keys.slice(-120)));
};

export const buildConsultationNotificationEventKey = (
  payload: ConsultationNotificationPayload
) =>
  [
    payload.event,
    payload.studentId,
    payload.workoutId ?? "no-workout",
    payload.executionLogId ?? "no-log",
  ].join(":");

export async function notifyConsultationEvent(
  payload: ConsultationNotificationPayload
): Promise<ConsultationNotificationDeliveryResult> {
  const notification = buildConsultationNotification(payload);
  const eventKey = buildConsultationNotificationEventKey(payload);

  try {
    const deliveredKeys = await readDeliveredKeys();
    if (deliveredKeys.includes(eventKey)) {
      return { eventKey, internal: "skipped_duplicate", push: "skipped" };
    }

    const actionUrl = notification.recipientRole === "student"
      ? "/student-consultation"
      : "/prof/consultation";
    await addNotification(notification.title, notification.body, {
      type: "consultation_event",
      organizationId: payload.organizationId,
      recipientUserId: payload.targetUserId,
      actionUrl,
      sourceType: "consultation",
      sourceId: eventKey,
      metadata: {
        event: payload.event,
        studentId: payload.studentId,
        workoutId: payload.workoutId ?? null,
        executionLogId: payload.executionLogId ?? null,
        recipientRole: notification.recipientRole,
      },
    });

    let push: ConsultationNotificationDeliveryResult["push"] = "skipped";
    let pushError = "";
    if (payload.organizationId && payload.targetUserId) {
      try {
        await sendPushToUser({
          organizationId: payload.organizationId,
          targetUserId: payload.targetUserId,
          title: notification.title,
          body: notification.body,
          data: {
            route:
              notification.recipientRole === "student"
                ? "/student-consultation"
                : "/prof/consultation",
            params: {
              event: payload.event,
              studentId: payload.studentId,
              workoutId: payload.workoutId ?? "",
              executionLogId: payload.executionLogId ?? "",
            },
          },
        });
        push = "sent";
      } catch (error) {
        push = "failed";
        pushError = error instanceof Error ? error.message : "Falha ao enviar push remoto.";
      }
    }

    await writeDeliveredKeys([...deliveredKeys, eventKey]);

    return {
      eventKey,
      internal: "created",
      push,
      error: pushError || undefined,
    };
  } catch (error) {
    return {
      eventKey,
      internal: "failed",
      push: "skipped",
      error: error instanceof Error ? error.message : "Falha ao registrar notificação.",
    };
  }
}

export async function clearConsultationNotificationEventKeysForTests() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
