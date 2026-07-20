/* eslint-disable import/first */
let mockStorage: Record<string, string> = {};
const mockAddNotification = jest.fn();
const mockSendPushToUser = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
}));

jest.mock("../../../notificationsInbox", () => ({
  addNotification: (...args: unknown[]) => mockAddNotification(...args),
}));

jest.mock("../../../api/push", () => ({
  sendPushToUser: (...args: unknown[]) => mockSendPushToUser(...args),
}));

import { buildConsultationNotification } from "../consultation-notifications";
import {
  clearConsultationNotificationEventKeysForTests,
  notifyConsultationEvent,
} from "../../../notifications/consultationNotifications";

describe("consultation notifications", () => {
  beforeEach(async () => {
    mockStorage = {};
    jest.clearAllMocks();
    await clearConsultationNotificationEventKeysForTests();
  });

  test("workout published notification is addressed to the student", () => {
    expect(
      buildConsultationNotification({
        event: "consultation_workout_published",
        studentId: "student-1",
      })
    ).toEqual({
      recipientRole: "student",
      title: "Treino publicado",
      body: "Seu treino já está disponível.",
      priority: "normal",
    });
  });

  test("workout completed notification uses student name for the coach", () => {
    expect(
      buildConsultationNotification({
        event: "consultation_workout_completed",
        studentId: "student-1",
        studentName: "Ana Júlia",
      })
    ).toEqual({
      recipientRole: "coach",
      title: "Treino concluído",
      body: "Ana Júlia concluiu o treino.",
      priority: "normal",
    });
  });

  test("high pain notification is attention priority and does not expose pain level", () => {
    const notification = buildConsultationNotification({
      event: "consultation_high_pain_reported",
      studentId: "student-1",
      studentName: "Ana Júlia",
    });

    expect(notification.priority).toBe("attention");
    expect(notification.title).toBe("Atenção no treino");
    expect(notification.body).toBe("Ana Júlia enviou um feedback que precisa de revisão.");
    expect(notification.body).not.toMatch(/\b(7|8|9|10)\b/);
    expect(notification.body.toLowerCase()).not.toContain("dor");
  });

  test("missing student name uses neutral copy", () => {
    expect(
      buildConsultationNotification({
        event: "consultation_workout_completed",
        studentId: "student-1",
      }).body
    ).toBe("A aluna concluiu o treino.");
  });

  test("review notification is addressed to the student", () => {
    expect(
      buildConsultationNotification({
        event: "consultation_execution_reviewed",
        studentId: "student-1",
      })
    ).toEqual({
      recipientRole: "student",
      title: "Devolutiva revisada",
      body: "O profissional revisou seu feedback de treino.",
      priority: "normal",
    });
  });

  test("adapter creates internal notification and skips push without remote target", async () => {
    const result = await notifyConsultationEvent({
      event: "consultation_workout_completed",
      studentId: "student-1",
      studentName: "Ana",
      workoutId: "workout-1",
      executionLogId: "log-1",
    });

    expect(result.internal).toBe("created");
    expect(result.push).toBe("skipped");
    expect(mockAddNotification).toHaveBeenCalledWith(
      "Treino concluído",
      "Ana concluiu o treino.",
      expect.objectContaining({
        type: "consultation_event",
        actionUrl: "/prof/consultation",
        sourceType: "consultation",
      })
    );
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  test("adapter can use the safe push backend when target data is available", async () => {
    mockSendPushToUser.mockResolvedValue({ status: "ok", sent: 1, failed: 0, invalidTokens: 0 });

    const result = await notifyConsultationEvent({
      event: "consultation_workout_published",
      studentId: "student-1",
      workoutId: "workout-1",
      organizationId: "org-1",
      targetUserId: "user-student-1",
    });

    expect(result.internal).toBe("created");
    expect(result.push).toBe("sent");
    expect(mockSendPushToUser).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        targetUserId: "user-student-1",
        title: "Treino publicado",
        body: "Seu treino já está disponível.",
      })
    );
  });

  test("adapter does not duplicate the same event key", async () => {
    const payload = {
      event: "consultation_workout_completed" as const,
      studentId: "student-1",
      workoutId: "workout-1",
      executionLogId: "log-1",
    };

    const first = await notifyConsultationEvent(payload);
    const second = await notifyConsultationEvent(payload);

    expect(first.internal).toBe("created");
    expect(second.internal).toBe("skipped_duplicate");
    expect(mockAddNotification).toHaveBeenCalledTimes(1);
  });
});
