import AsyncStorage from "@react-native-async-storage/async-storage";

import { listClassHeadsByClassIds } from "../api/class-responsibles";
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

const resolveRecipientUserIds = async (
  payload: ConsultationNotificationPayload,
  recipientRole: "student" | "coach",
) => {
  const explicitTarget = String(payload.targetUserId ?? "").trim();
  if (explicitTarget) return [explicitTarget];
  if (
    recipientRole !== "coach" ||
    !payload.organizationId ||
    !payload.classId
  ) {
    return [];
  }

  const heads = await listClassHeadsByClassIds({
    organizationId: payload.organizationId,
    classIds: [payload.classId],
  });
  return Array.from(
    new Set(heads.map((head) => String(head.userId ?? "").trim()).filter(Boolean)),
  ).sort();
};

export async function notifyConsultationEvent(
  payload: ConsultationNotificationPayload
): Promise<ConsultationNotificationDeliveryResult> {
  const notification = buildConsultationNotification(payload);
  const eventKey = buildConsultationNotificationEventKey(payload);

  try {
    const organizationId = String(payload.organizationId ?? "").trim();
    if (!organizationId) {
      return {
        eventKey,
        internal: "failed",
        push: "skipped",
        error: "Organização da notificação não informada.",
      };
    }

    const recipientUserIds = await resolveRecipientUserIds(
      payload,
      notification.recipientRole,
    );
    if (!recipientUserIds.length) {
      return {
        eventKey,
        internal: "failed",
        push: "skipped",
        error: "Destinatário da notificação não encontrado.",
      };
    }

    const deliveredKeys = await readDeliveredKeys();
    const deliveredSet = new Set(deliveredKeys);
    const pendingRecipients = recipientUserIds.filter(
      (recipientUserId) => !deliveredSet.has(`${eventKey}:${recipientUserId}`),
    );
    if (!pendingRecipients.length) {
      return { eventKey, internal: "skipped_duplicate", push: "skipped" };
    }

    const actionUrl = notification.recipientRole === "student"
      ? "/student-consultation"
      : "/prof/consultation";
    let internalFailed = false;
    let pushAttempted = false;
    let pushFailed = false;
    const errors: string[] = [];
    const succeededKeys: string[] = [];

    for (const recipientUserId of pendingRecipients) {
      const createdNotification = await addNotification(
        notification.title,
        notification.body,
        {
          type: "consultation_event",
          organizationId,
          recipientUserId,
          inboxScope:
            notification.recipientRole === "student" ? "student" : "prof",
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
          dedupe: true,
        },
      );
      if (!createdNotification) {
        internalFailed = true;
        errors.push("Não foi possível registrar a notificação interna.");
        continue;
      }

      succeededKeys.push(`${eventKey}:${recipientUserId}`);
      pushAttempted = true;
      try {
        await sendPushToUser({
          organizationId,
          targetUserId: recipientUserId,
          notificationType: "consultation_event",
          sourceType: "consultation",
          notificationId: createdNotification.id,
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
      } catch (error) {
        pushFailed = true;
        errors.push(
          error instanceof Error ? error.message : "Falha ao enviar push remoto.",
        );
      }
    }

    if (succeededKeys.length) {
      await writeDeliveredKeys([...deliveredKeys, ...succeededKeys]);
    }

    return {
      eventKey,
      internal: internalFailed ? "failed" : "created",
      push: pushFailed ? "failed" : pushAttempted ? "sent" : "skipped",
      error: errors.length ? Array.from(new Set(errors)).join(" ") : undefined,
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
