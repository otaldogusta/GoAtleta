import type {
  AttendanceRecord,
  ClassGroup,
  DecisionReason,
  SessionLog,
  TrainingSessionAttendance,
} from "../../../core/models";
import type {
  StudentContextCategory,
  StudentContextSeverity,
} from "../../../core/student-context-events";

export type StudentPlanningContextInput = {
  classId: string;
  category: StudentContextCategory;
  severity: StudentContextSeverity;
  eventDate: string;
};

export type StudentPlanningContextSummary = {
  activeSignals: number;
  attentionSignals: number;
  urgentSignals: number;
  categories: Partial<Record<StudentContextCategory, number>>;
};

export type UnifiedPlanningContext = {
  attendance: TrainingSessionAttendance[];
  sessionLogs: SessionLog[];
  dimensionGuidelines: string[];
  decisionReasons: DecisionReason[];
  studentContext: StudentPlanningContextSummary;
};

const toIsoDate = (value: string | null | undefined) =>
  String(value ?? "").slice(0, 10);

const countByCategory = (contexts: StudentPlanningContextInput[]) =>
  contexts.reduce<StudentPlanningContextSummary["categories"]>(
    (counts, context) => ({
      ...counts,
      [context.category]: (counts[context.category] ?? 0) + 1,
    }),
    {},
  );

const buildStudentGuidelines = (
  summary: StudentPlanningContextSummary,
): string[] => {
  const guidelines: string[] = [];
  if (summary.categories.health) {
    guidelines.push(
      "Valide a prontidão da turma antes de elevar impacto ou intensidade e ofereça uma variação de menor exigência física.",
    );
  }
  if (summary.categories.wellbeing) {
    guidelines.push(
      "Priorize acolhimento, comunicação segura e tarefas cooperativas sem exposição individual.",
    );
  }
  if (summary.categories.withdrawal_risk || summary.categories.absence) {
    guidelines.push(
      "Facilite a reintegração de quem retorna, com instruções curtas, pares de apoio e progressão gradual.",
    );
  }
  if (summary.categories.logistics || summary.categories.return_expected) {
    guidelines.push(
      "Organize a aula para acomodar entradas, retornos ou disponibilidade irregular sem quebrar a continuidade do grupo.",
    );
  }
  if (summary.urgentSignals) {
    guidelines.push(
      "Antes da aula, confira os acompanhamentos prioritários registrados para a turma e adapte a proposta quando necessário.",
    );
  }
  return guidelines;
};

export function buildUnifiedPlanningContext(params: {
  classGroup: ClassGroup;
  referenceDate: string;
  recentAttendance?: AttendanceRecord[];
  recentSessionLogs?: SessionLog[];
  studentContexts?: StudentPlanningContextInput[];
}): UnifiedPlanningContext {
  const referenceDate = toIsoDate(params.referenceDate);
  const attendanceRecords = (params.recentAttendance ?? []).filter(
    (record) =>
      record.classId === params.classGroup.id &&
      (!referenceDate || toIsoDate(record.date) <= referenceDate),
  );
  const sessionLogs = (params.recentSessionLogs ?? []).filter(
    (log) =>
      log.classId === params.classGroup.id &&
      (!referenceDate || toIsoDate(log.createdAt) <= referenceDate),
  );
  const studentContexts = (params.studentContexts ?? []).filter(
    (context) =>
      context.classId === params.classGroup.id &&
      (!referenceDate || toIsoDate(context.eventDate) <= referenceDate),
  );
  const studentContext: StudentPlanningContextSummary = {
    activeSignals: studentContexts.length,
    attentionSignals: studentContexts.filter(
      (context) => context.severity === "attention",
    ).length,
    urgentSignals: studentContexts.filter(
      (context) => context.severity === "urgent",
    ).length,
    categories: countByCategory(studentContexts),
  };

  const decisionReasons: DecisionReason[] = [];
  if (studentContext.activeSignals) {
    decisionReasons.push({
      kind: "context",
      source: "attendance",
      confidence: "high",
      message:
        "O plano considera sinais ativos e confirmados de acompanhamento da turma.",
      evidence: `${studentContext.activeSignals} sinal(is) agregado(s), sem dados pessoais no contexto de geração.`,
    });
  }
  if (studentContext.categories.health || studentContext.urgentSignals) {
    decisionReasons.push({
      kind: "safety",
      source: "health_summary",
      confidence: "high",
      message:
        "A proposta deve permitir ajuste de intensidade após checagem de prontidão.",
      evidence: `${studentContext.categories.health ?? 0} sinal(is) de saúde e ${studentContext.urgentSignals} prioritário(s).`,
    });
  }

  return {
    attendance: attendanceRecords.map((record) => ({
      id: record.id,
      sessionId: `attendance_${record.classId}_${record.date}`,
      studentId: record.studentId,
      classId: record.classId,
      organizationId: params.classGroup.organizationId,
      status: record.status === "presente" ? "present" : "absent",
      note: record.note ? "Observação registrada na chamada." : "",
      painScore: record.painScore,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
    })),
    sessionLogs,
    dimensionGuidelines: buildStudentGuidelines(studentContext),
    decisionReasons,
    studentContext,
  };
}
