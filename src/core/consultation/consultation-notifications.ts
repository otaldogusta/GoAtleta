export type ConsultationNotificationEvent =
  | "consultation_workout_published"
  | "consultation_workout_completed"
  | "consultation_high_pain_reported"
  | "consultation_execution_reviewed";

export type ConsultationNotificationPayload = {
  event: ConsultationNotificationEvent;
  studentId: string;
  coachId?: string;
  studentName?: string;
  workoutId?: string;
  executionLogId?: string;
  organizationId?: string;
  targetUserId?: string;
};

export type BuiltConsultationNotification = {
  recipientRole: "student" | "coach";
  title: string;
  body: string;
  priority: "normal" | "attention";
};

const normalizeStudentName = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed || "A aluna";
};

export function buildConsultationNotification(
  payload: ConsultationNotificationPayload
): BuiltConsultationNotification {
  const studentName = normalizeStudentName(payload.studentName);

  switch (payload.event) {
    case "consultation_workout_published":
      return {
        recipientRole: "student",
        title: "Treino publicado",
        body: "Seu treino já está disponível.",
        priority: "normal",
      };

    case "consultation_workout_completed":
      return {
        recipientRole: "coach",
        title: "Treino concluído",
        body: `${studentName} concluiu o treino.`,
        priority: "normal",
      };

    case "consultation_high_pain_reported":
      return {
        recipientRole: "coach",
        title: "Atenção no treino",
        body: `${studentName} enviou um feedback que precisa de revisão.`,
        priority: "attention",
      };

    case "consultation_execution_reviewed":
      return {
        recipientRole: "student",
        title: "Devolutiva revisada",
        body: "O profissional revisou seu feedback de treino.",
        priority: "normal",
      };

    default: {
      const neverEvent: never = payload.event;
      return neverEvent;
    }
  }
}
