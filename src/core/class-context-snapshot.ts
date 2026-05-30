import type { ClassGroup, DecisionReason, Student } from "./models";
import type { PlannedSession } from "./session-calendar-engine";

export type ClassContextSnapshot = {
  schemaVersion: 1;
  classId: string;
  generatedAt: string;
  profile: {
    name: string;
    modality: string;
    ageBand: string;
    goal: string;
    level: number;
    mvLevel: string;
    unit: string;
    equipment: string;
  };
  calendar: {
    sessionCount: number;
    durationMinutes: number;
    daysOfWeek: number[];
    sessionDates: string[];
  };
  roster: {
    studentCount?: number;
  };
  reasons: DecisionReason[];
};

const reason = (
  source: DecisionReason["source"],
  confidence: DecisionReason["confidence"],
  message: string,
  evidence?: string
): DecisionReason => ({
  kind: "context",
  source,
  confidence,
  message,
  evidence,
});

export const buildClassContextSnapshot = (params: {
  classGroup: ClassGroup;
  sessions: PlannedSession[];
  students?: Student[];
  generatedAt?: string;
}): ClassContextSnapshot => {
  const classReasons = [
    reason(
      "class_profile",
      "high",
      "Contexto derivado do cadastro da turma.",
      params.classGroup.name
    ),
  ];
  const calendarReasons = params.sessions.length
    ? [
        reason(
          "calendar_engine",
          "high",
          "Agenda real usada para distribuir o planejamento.",
          `${params.sessions.length} sessoes`
        ),
      ]
    : [
        reason(
          "safe_default",
          "low",
          "Agenda real indisponivel; nao foram criadas sessoes presumidas."
        ),
      ];
  const rosterReasons =
    params.students && params.students.length >= 0
      ? [
          reason(
            "class_profile",
            "medium",
            "Quantidade de atletas considerada como contexto agregado.",
            `${params.students.length} atletas`
          ),
        ]
      : [];

  return {
    schemaVersion: 1,
    classId: params.classGroup.id,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    profile: {
      name: params.classGroup.name,
      modality: params.classGroup.modality,
      ageBand: params.classGroup.ageBand,
      goal: params.classGroup.goal,
      level: params.classGroup.level,
      mvLevel: params.classGroup.mvLevel,
      unit: params.classGroup.unit,
      equipment: params.classGroup.equipment,
    },
    calendar: {
      sessionCount: params.sessions.length,
      durationMinutes: Math.max(15, Number(params.classGroup.durationMinutes || 60)),
      daysOfWeek: params.classGroup.daysOfWeek ?? [],
      sessionDates: params.sessions.map((session) => session.date),
    },
    roster: {
      studentCount: params.students?.length,
    },
    reasons: [...classReasons, ...calendarReasons, ...rosterReasons],
  };
};

