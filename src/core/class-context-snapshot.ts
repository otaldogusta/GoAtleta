import type { AttendanceRecord, ClassGroup, DecisionReason, SessionLog, Student } from "./models";
import type { PlannedSession } from "./session-calendar-engine";

export type RosterDensityProfile = "small" | "medium" | "large" | "unknown";

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
    skippedSessionCount: number;
    durationMinutes: number;
    daysOfWeek: number[];
    sessionDates: string[];
    skippedSessionDates: string[];
  };
  roster: {
    studentCount?: number;
    densityProfile: RosterDensityProfile;
  };
  health: {
    studentsWithHealthIssueCount?: number;
    studentsWithMedicationUseCount?: number;
    hasIncompleteHealthData: boolean;
  };
  evidenceQuality: {
    hasRosterData: boolean;
    hasCalendarData: boolean;
    hasRecentAttendanceData: boolean;
    hasRecentSessionLogs: boolean;
  };
  institutionalContext?: {
    setting: "escola" | "clube" | "projeto_social" | "outro";
    confidence: "low" | "medium" | "high";
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

const hasAnyText = (...values: (string | null | undefined)[]) =>
  values.some((value) => String(value ?? "").trim().length > 0);

const resolveDensityProfile = (studentCount: number | undefined): RosterDensityProfile => {
  if (typeof studentCount !== "number") return "unknown";
  if (studentCount <= 10) return "small";
  if (studentCount <= 22) return "medium";
  return "large";
};

const inferInstitutionalContext = (
  classGroup: ClassGroup
): ClassContextSnapshot["institutionalContext"] => {
  const text = [classGroup.unit, classGroup.goal, classGroup.modality]
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/escola|colegio|educ/.test(text)) return { setting: "escola", confidence: "low" };
  if (/clube|compet|rendimento/.test(text)) return { setting: "clube", confidence: "low" };
  if (/projeto|social|comunidade/.test(text)) return { setting: "projeto_social", confidence: "low" };
  return undefined;
};

export const buildClassContextSnapshot = (params: {
  classGroup: ClassGroup;
  sessions: PlannedSession[];
  skippedSessions?: PlannedSession[];
  students?: Student[];
  recentAttendance?: AttendanceRecord[];
  recentSessionLogs?: SessionLog[];
  generatedAt?: string;
}): ClassContextSnapshot => {
  const studentCount = params.students?.length;
  const densityProfile = resolveDensityProfile(studentCount);
  const studentsWithHealthIssueCount = params.students?.filter((student) => student.healthIssue).length;
  const studentsWithMedicationUseCount = params.students?.filter((student) => student.medicationUse).length;
  const hasIncompleteHealthData = params.students
    ? params.students.some(
        (student) =>
          !hasAnyText(
            student.healthIssueNotes,
            student.medicationNotes,
            student.healthObservations
          ) &&
          !student.healthIssue &&
          !student.medicationUse
      )
    : true;
  const institutionalContext = inferInstitutionalContext(params.classGroup);
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
    params.students
      ? [
          reason(
            "class_profile",
            "medium",
            "Quantidade de atletas considerada como contexto agregado.",
            `${params.students.length} atletas`
          ),
          ...(densityProfile === "large"
            ? [
                reason(
                  "class_profile",
                  "medium",
                  "Turma numerosa: manter organizacao e participacao como criterio de seguranca.",
                  `${params.students.length} atletas`
                ),
              ]
            : []),
        ]
      : [
          reason(
            "safe_default",
            "low",
            "Roster nao carregado; o planejamento nao assume tamanho da turma."
          ),
        ];
  const healthReasons = params.students
    ? [
        ...(studentsWithHealthIssueCount
          ? [
              reason(
                "health_summary",
                "medium",
                "Ha questoes de saude registradas no grupo; usar progressao conservadora.",
                `${studentsWithHealthIssueCount} atleta(s)`
              ),
            ]
          : []),
        ...(studentsWithMedicationUseCount
          ? [
              reason(
                "health_summary",
                "medium",
                "Ha uso de medicacao registrado no grupo; orientar acompanhamento docente.",
                `${studentsWithMedicationUseCount} atleta(s)`
              ),
            ]
          : []),
        ...(hasIncompleteHealthData
          ? [
              reason(
                "safe_default",
                "low",
                "Dados de saude incompletos: decisao conservadora."
              ),
            ]
          : []),
      ]
    : [
        reason(
          "safe_default",
          "low",
          "Dados de saude ausentes: decisao conservadora."
        ),
      ];
  const institutionalReasons = institutionalContext
    ? [
        reason(
          "safe_default",
          "low",
          "Contexto institucional inferido com baixa confianca.",
          institutionalContext.setting
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
      skippedSessionCount: params.skippedSessions?.length ?? 0,
      durationMinutes: Math.max(15, Number(params.classGroup.durationMinutes || 60)),
      daysOfWeek: params.classGroup.daysOfWeek ?? [],
      sessionDates: params.sessions.map((session) => session.date),
      skippedSessionDates: (params.skippedSessions ?? []).map((session) => session.date),
    },
    roster: {
      studentCount: params.students?.length,
      densityProfile,
    },
    health: {
      studentsWithHealthIssueCount,
      studentsWithMedicationUseCount,
      hasIncompleteHealthData,
    },
    evidenceQuality: {
      hasRosterData: Boolean(params.students),
      hasCalendarData: params.sessions.length > 0 || Boolean(params.skippedSessions?.length),
      hasRecentAttendanceData: Boolean(params.recentAttendance?.length),
      hasRecentSessionLogs: Boolean(params.recentSessionLogs?.length),
    },
    institutionalContext,
    reasons: [
      ...classReasons,
      ...calendarReasons,
      ...rosterReasons,
      ...healthReasons,
      ...institutionalReasons,
    ],
  };
};
