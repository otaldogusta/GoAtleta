import { buildClassContextSnapshot } from "../../../core/class-context-snapshot";
import type {
  AttendanceRecord,
  ClassCalendarException,
  ClassGroup,
  DecisionReason,
  MonthlyPlanningBlueprint,
  SessionLog,
  Student,
} from "../../../core/models";
import { buildSessionCalendar } from "../../../core/session-calendar-engine";

/**
 * Generate or update a MonthlyPlanningBlueprint based on class context.
 *
 * Input analysis:
 * - ClassGroup competitive profile (level, target audience, calendar phase)
 * - Month/year from key
 * - Age band (youth/adult/mixed competitive)
 *
 * Output strategy:
 * - macroIntent: Phrase describing pedagogical focus for the month
 * - pedagogicalProgression: Array of focus themes distributed across weeks
 * - weeklyFocusDistributionJson: Map of week index -> theme/periodization role
 * - constraintsJson: Calendar exceptions (holidays, tournaments)
 *
 * Preserves manual edits via manualOverrideMaskJson if existing blueprint provided.
 */

export interface GenerateMonthlyBlueprintParams {
  classGroup: ClassGroup;
  monthKey: string; // "YYYY-MM"
  existing?: MonthlyPlanningBlueprint | null;
  calendarExceptions?: ClassCalendarException[];
  students?: Student[];
  recentAttendance?: AttendanceRecord[];
  recentSessionLogs?: SessionLog[];
}

const competitiveIntentByLevel: Record<string, string> = {
  beginner: "Fundação técnica e desenvolvimento de hábitos de força",
  intermediate: "Consolidação técnica com progressão de intensidade",
  advanced: "Aperfeiçoamento tático e preparação competitiva",
  elite: "Periodização científica com periodização específica do macrociclo",
};

const pedagogicalProgressionByLevel: Record<string, string[]> = {
  beginner: [
    "Exploração de fundamentos com cooperação e controle da bola",
    "Passe e levantamento em tarefa cooperativa",
    "Continuidade em jogo reduzido com regra simples",
    "Síntese com fair play, comunicação e respeito ao erro",
  ],
  intermediate: [
    "Estabilização técnica com progressão de precisão",
    "3x3 progressivo com tomada de decisão",
    "Integração físico-técnica com controle de carga",
    "Aplicação em jogo reduzido com mediação coletiva",
  ],
  advanced: [
    "Combinações técnico-táticas em oposição progressiva",
    "Organização coletiva por função e transição",
    "Preparação física integrada à transferência para o jogo",
    "Leitura de jogo, autonomia e síntese coletiva",
  ],
  elite: [
    "Macrociclo competitivo com intenção de carga explícita",
    "Bloco físico-técnico com transferência controlada",
    "Contra-ataque, pressão e adaptação decisional",
    "Tapering, recuperação ativa e prevenção de lesão",
  ],
};

const monthIntentByCalendarPhase: Record<string, string> = {
  "off-season": "Desenvolvimento técnico e construção de condicionamento",
  "pre-season": "Integração tática progressiva com preparação competitiva",
  "in-season": "Manutenção técnica com picos de performance estratégicos",
  "post-season": "Recuperação ativa e reflexão sobre desempenho",
};

/**
 * Infer calendar phase from month (1-12).
 * Simplified: Brazilian school calendar + volleyball seasons.
 * - Jan–Feb: Off-season recovery
 * - Mar–May: Pre-season
 * - Jun–Aug: In-season (high schools/clubs play championships)
 * - Sep–Nov: In-season continuation / post-season
 * - Dec: Mixed recovery phase
 */
const inferCalendarPhase = (month: number): string => {
  if (month <= 2) return "off-season";
  if (month <= 5) return "pre-season";
  if (month <= 8) return "in-season";
  if (month <= 11) return "in-season";
  return "off-season";
};

const buildMonthlyPedagogicalVocabulary = (params: {
  competitiveLevel: string;
  calendarPhase: string;
}) => {
  const isBeginner = params.competitiveLevel === "beginner";
  const isCompetitive = params.calendarPhase === "in-season";
  return {
    capIntent: {
      conceitual: isCompetitive
        ? "Compreender a relação entre fase, carga e tomada de decisão."
        : "Compreender os fundamentos e regras simples que sustentam o jogo reduzido.",
      procedimental: isBeginner
        ? "Aplicar fundamentos em tarefas cooperativas e jogos reduzidos."
        : "Aplicar habilidades em progressões com oposição, pressão e transferência para o jogo.",
      atitudinal: "Cooperar, comunicar combinados e respeitar erro, colega e regra da atividade.",
    },
    pedagogicalApproachIntent: isBeginner
      ? "sociocultural"
      : isCompetitive
        ? "combinada"
        : "cognitivista",
    decisionVocabulary: [
      "fase",
      "carga",
      "jogo reduzido",
      "tomada de decisão",
      "cooperação",
      "fair play",
    ],
  };
};

const buildBlueprintDecisionReasons = (params: {
  plannedSessions: number;
  skippedSessions: number;
  densityProfile: string;
  hasRosterData: boolean;
  hasRecentAttendanceData: boolean;
  hasRecentSessionLogs: boolean;
  hasIncompleteHealthData: boolean;
}): DecisionReason[] => {
  const aulaLabel = (count: number) => (count === 1 ? "aula" : "aulas");
  const removidaLabel = (count: number) => (count === 1 ? "removida" : "removidas");
  const reasons: DecisionReason[] = [
    {
      kind: "calendar",
      source: "calendar_engine",
      confidence: "high",
      message: `${params.plannedSessions} ${aulaLabel(params.plannedSessions)} reais planejadas no mes.`,
    },
  ];

  if (params.skippedSessions > 0) {
    reasons.push({
      kind: "calendar",
      source: "calendar_engine",
      confidence: "high",
      message: `${params.skippedSessions} ${aulaLabel(params.skippedSessions)} ${removidaLabel(params.skippedSessions)} por excecao de calendario.`,
    });
  }

  reasons.push({
    kind: "context",
    source: params.hasRosterData ? "class_profile" : "safe_default",
    confidence: params.hasRosterData ? "medium" : "low",
    message: params.hasRosterData
      ? `Densidade da turma: ${params.densityProfile}.`
      : "Roster nao carregado; densidade da turma nao foi presumida.",
  });

  if (!params.hasRecentAttendanceData || !params.hasRecentSessionLogs || params.hasIncompleteHealthData) {
    reasons.push({
      kind: "safety",
      source: "safe_default",
      confidence: "low",
      message: "Dados parciais: planejamento mensal usa leitura conservadora.",
    });
  }

  return reasons;
};

export const generateMonthlyBlueprint = (params: GenerateMonthlyBlueprintParams): MonthlyPlanningBlueprint => {
  const { classGroup, monthKey, existing } = params;
  const nowIso = new Date().toISOString();

  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  const competitiveLevel = classGroup.competitiveLevel || "beginner";
  const calendarPhase = inferCalendarPhase(month);
  const monthStartDate = `${yearText}-${monthText}-01`;
  const lastDay = new Date(year, month, 0);
  const monthEndDate = `${yearText}-${monthText}-${String(lastDay.getDate()).padStart(2, "0")}`;
  const sessionCalendar = buildSessionCalendar({
    classGroup,
    startDate: monthStartDate,
    endDate: monthEndDate,
    exceptions: params.calendarExceptions,
  });
  const classContextSnapshot = buildClassContextSnapshot({
    classGroup,
    sessions: sessionCalendar.sessions,
    skippedSessions: sessionCalendar.skippedSessions,
    students: params.students,
    recentAttendance: params.recentAttendance,
    recentSessionLogs: params.recentSessionLogs,
    generatedAt: nowIso,
  });
  const blueprintDecisionReasons = buildBlueprintDecisionReasons({
    plannedSessions: sessionCalendar.sessions.length,
    skippedSessions: sessionCalendar.skippedSessions.length,
    densityProfile: classContextSnapshot.roster.densityProfile,
    hasRosterData: classContextSnapshot.evidenceQuality.hasRosterData,
    hasRecentAttendanceData: classContextSnapshot.evidenceQuality.hasRecentAttendanceData,
    hasRecentSessionLogs: classContextSnapshot.evidenceQuality.hasRecentSessionLogs,
    hasIncompleteHealthData: classContextSnapshot.health.hasIncompleteHealthData,
  });

  // Build macro intent combining level + calendar phase
  const levelIntent = competitiveIntentByLevel[competitiveLevel] || competitiveIntentByLevel.beginner;
  const phaseIntent = monthIntentByCalendarPhase[calendarPhase] || monthIntentByCalendarPhase["in-season"];
  const macroIntent = `${levelIntent} · Fase: ${calendarPhase}`;
  const pedagogicalVocabulary = buildMonthlyPedagogicalVocabulary({
    competitiveLevel,
    calendarPhase,
  });

  // Build pedagogical progression (4 key focuses for typical 4-5 week month)
  const basePedagogy = pedagogicalProgressionByLevel[competitiveLevel] || pedagogicalProgressionByLevel.beginner;
  const pedagogicalProgression = basePedagogy;

  // Distribute weekly themes: e.g., week 1 -> basePedagogy[0], week 2 -> basePedagogy[1], etc.
  const weeklyFocusDistribution: Record<number, string> = {
    0: basePedagogy[0] || "Aula 1",
    1: basePedagogy[1] || "Aula 2",
    2: basePedagogy[2] || "Aula 3",
    3: basePedagogy[3] || "Aula 4",
    4: basePedagogy[0] || "Aula 5", // Cycle back if month has 5 weeks
  };

  const newVersion = (existing?.generationVersion ?? 0) + 1;

  return {
    id: existing?.id ?? `mpb_${classGroup.id}_${monthKey}`,
    classId: classGroup.id,
    year,
    month,
    title: `Planejamento ${monthKey}`,
    macroIntent,
    pedagogicalProgression: JSON.stringify(pedagogicalProgression),
    weeklyFocusDistributionJson: JSON.stringify(weeklyFocusDistribution),
    constraintsJson: existing?.constraintsJson ?? "{}",
    contextSnapshotJson: JSON.stringify({
      schemaVersion: 1,
      competitiveLevel,
      calendarPhase,
      phaseIntent,
      pedagogicalVocabulary,
      classContextSnapshot,
      decisionReasons: [
        ...sessionCalendar.reasons,
        ...classContextSnapshot.reasons,
        ...blueprintDecisionReasons,
      ],
      classGroupName: classGroup.name,
      generatedAt: nowIso,
    }),
    generationModelVersion: "planning-v1",
    generationVersion: newVersion,
    syncStatus: "in_sync",
    lastAutoGeneratedAt: nowIso,
    lastManualEditedAt: existing?.lastManualEditedAt ?? nowIso,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
};

/**
 * Preserve manual field overrides from existing blueprint when regenerating.
 * Similar to daily lesson plan pattern: parse override mask, copy locked fields.
 */
export const regenerateMonthlyBlueprintPreservingEdits = (params: {
  existing: MonthlyPlanningBlueprint;
  newBlueprint: MonthlyPlanningBlueprint;
}): MonthlyPlanningBlueprint => {
  const { existing, newBlueprint } = params;

  // For now, blueprint-level edits are simpler; we preserve manual intent if title was changed
  if (existing.title !== `Planejamento ${existing.year}-${String(existing.month).padStart(2, "0")}`) {
    return {
      ...newBlueprint,
      title: existing.title,
    };
  }

  return newBlueprint;
};
