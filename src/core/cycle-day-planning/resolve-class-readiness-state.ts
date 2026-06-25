import type {
  ClassGroup,
  ClassReadinessRecommendation,
  ClassReadinessRiskFlag,
  ClassReadinessState,
  GameFormatLevel,
  HistoricalConfidence,
  ReadinessConfidence,
  RecentSessionSummary,
  SessionStrategy,
  Student,
} from "../models";
import {
  compareGameFormatLevels,
  getGameFormatLevelAtRank,
  getGameFormatLevelRank,
  minGameFormatLevel,
  shiftGameFormatLevel,
} from "./readiness-levels";

type ResolveClassReadinessStateParams = {
  classGroup: ClassGroup;
  sessionDate: string;
  historicalConfidence: HistoricalConfidence;
  recentSessions: RecentSessionSummary[];
  sourceStrategy: SessionStrategy;
  plannedGameLevel?: GameFormatLevel;
  students?: Student[] | null;
};

const unique = <T,>(values: T[]) => [...new Set(values)];

const parseDate = (value: string | null | undefined) => {
  const parsed = new Date(`${String(value ?? "").slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const daysBetween = (left: Date, right: Date) =>
  Math.round((left.getTime() - right.getTime()) / 86_400_000);

const hasRecentSignal = (
  recentSessions: RecentSessionSummary[],
  signal: NonNullable<RecentSessionSummary["pedagogicalFeedbackSignals"]>[number]
) =>
  recentSessions.slice(0, 4).some((session) =>
    session.pedagogicalFeedbackSignals?.includes(signal) ||
    session.pedagogicalFeedbackSignalEvidence?.some((item) => item.type === signal)
  );

const estimateClassBaseLevel = (classGroup: ClassGroup): GameFormatLevel => {
  if (classGroup.level >= 3) return "L6_3x3_introdutorio";
  if (classGroup.level === 2) return "L4_2x2_cooperativo";
  return "L2_1x1_facilitado";
};

const inferLevelFromProgression = (
  session: RecentSessionSummary
): GameFormatLevel | null => {
  switch (session.progressionDimension) {
    case "transferencia_jogo":
      return "L6_3x3_introdutorio";
    case "tomada_decisao":
      return "L5_2x2_decisao";
    case "oposicao":
    case "pressao_tempo":
      return "L4_2x2_cooperativo";
    case "precisao":
      return "L3_1x1_intencional";
    case "consistencia":
      return "L2_1x1_facilitado";
    default:
      return null;
  }
};

const estimateRecentLevel = (
  recentSessions: RecentSessionSummary[]
): GameFormatLevel | null => {
  const candidates = recentSessions
    .filter((session) => session.wasApplied || session.wasConfirmedExecuted || session.wasEditedByTeacher)
    .map(inferLevelFromProgression)
    .filter((level): level is GameFormatLevel => Boolean(level));
  if (!candidates.length) return null;
  const highest = candidates.reduce((best, current) =>
    getGameFormatLevelRank(current) > getGameFormatLevelRank(best) ? current : best
  );
  return highest;
};

const resolvePlannedGameLevel = (
  strategy: SessionStrategy
): GameFormatLevel => {
  if (strategy.gameTransferLevel === "high" && strategy.oppositionLevel === "high") {
    return strategy.progressionDimension === "transferencia_jogo" ||
      strategy.pedagogicalIntent === "game_reading" ||
      strategy.pedagogicalIntent === "team_organization"
      ? "L7_3x3_organizado"
      : "L6_3x3_introdutorio";
  }

  if (strategy.gameTransferLevel === "high") return "L6_3x3_introdutorio";

  if (strategy.oppositionLevel === "medium" && strategy.gameTransferLevel === "medium") {
    return strategy.progressionDimension === "tomada_decisao" ? "L5_2x2_decisao" : "L4_2x2_cooperativo";
  }

  if (strategy.gameTransferLevel === "medium") {
    return strategy.progressionDimension === "precisao" ||
      strategy.progressionDimension === "pressao_tempo"
      ? "L3_1x1_intencional"
      : "L2_1x1_facilitado";
  }

  return strategy.timePressureLevel === "medium" ? "L2_1x1_facilitado" : "L1_controle_individual";
};

const countNewStudents = (params: {
  students?: Student[] | null;
  sessionDate: string;
}) => {
  const sessionDate = parseDate(params.sessionDate);
  if (!sessionDate) return 0;
  return (params.students ?? []).filter((student) => {
    const createdAt = parseDate(student.createdAt);
    if (!createdAt) return false;
    const diff = daysBetween(sessionDate, createdAt);
    return diff >= 0 && diff <= 30;
  }).length;
};

const resolveConfidence = (params: {
  historicalConfidence: HistoricalConfidence;
  riskFlags: ClassReadinessRiskFlag[];
  recentSessions: RecentSessionSummary[];
}): ReadinessConfidence => {
  if (params.riskFlags.includes("alunos_novos") && params.riskFlags.includes("turma_heterogenea")) {
    return "critical";
  }
  if (params.historicalConfidence === "high" && params.riskFlags.length === 0) return "high";
  if (params.historicalConfidence === "none") return "low";
  if (params.riskFlags.includes("salto_de_complexidade") || params.riskFlags.includes("dificuldade_recorrente")) {
    return params.historicalConfidence === "high" ? "medium" : "low";
  }
  if (params.historicalConfidence === "medium") return "medium";
  return "low";
};

const resolveRecommendation = (params: {
  confidence: ReadinessConfidence;
  plannedGameLevel: GameFormatLevel;
  estimatedGameLevel: GameFormatLevel;
  appliedCoreLevel: GameFormatLevel;
}): ClassReadinessRecommendation => {
  if (params.confidence === "critical") return "diagnosticar";
  if (compareGameFormatLevels(params.appliedCoreLevel, params.estimatedGameLevel) < 0) return "regredir";
  if (params.appliedCoreLevel === params.plannedGameLevel) return "progredir";
  return "consolidar";
};

const buildReason = (riskFlags: ClassReadinessRiskFlag[]) =>
  unique([
    riskFlags.includes("historico_fraco") ? "Histórico recente insuficiente para liberar avanço amplo." : null,
    riskFlags.includes("dificuldade_recorrente") ? "Histórico recente pede retomada técnica curta." : null,
    riskFlags.includes("salto_de_complexidade") ? "A diferença entre alvo e prontidão pede ponte de progressão." : null,
    riskFlags.includes("alunos_novos") ? "Há alunos recentes que podem precisar de entrada guiada." : null,
    riskFlags.includes("baixa_frequencia") ? "Baixa frequência recente pede regras simples e repetição com bola." : null,
  ].filter((value): value is string => Boolean(value)));

const buildTeacherMessage = (params: {
  plannedGameLevel: GameFormatLevel;
  appliedCoreLevel: GameFormatLevel;
}) => {
  if (
    getGameFormatLevelRank(params.plannedGameLevel) >= getGameFormatLevelRank("L6_3x3_introdutorio") &&
    getGameFormatLevelRank(params.appliedCoreLevel) <= getGameFormatLevelRank("L4_2x2_cooperativo")
  ) {
    return "Hoje use 2x2 cooperativo. Evite 3x3 livre. Avance apenas se a turma sustentar comunicação e continuidade.";
  }
  return "Hoje mantenha o maior desafio seguro e avance somente quando a execução estiver estável.";
};

export const resolveClassReadinessState = (
  params: ResolveClassReadinessStateParams
): ClassReadinessState => {
  const plannedGameLevel = params.plannedGameLevel ?? resolvePlannedGameLevel(params.sourceStrategy);
  const recentLevel = estimateRecentLevel(params.recentSessions);
  let estimatedGameLevel = recentLevel ?? estimateClassBaseLevel(params.classGroup);
  const riskFlags: ClassReadinessRiskFlag[] = [];

  if (params.historicalConfidence === "none") {
    riskFlags.push("sem_relatorio", "historico_fraco");
    estimatedGameLevel = minGameFormatLevel(estimatedGameLevel, estimateClassBaseLevel(params.classGroup));
  } else if (params.historicalConfidence === "low") {
    riskFlags.push("historico_fraco");
  }

  if (hasRecentSignal(params.recentSessions, "recurring_technical_difficulty")) {
    riskFlags.push("dificuldade_recorrente");
    estimatedGameLevel = shiftGameFormatLevel(estimatedGameLevel, -1);
  }

  if (hasRecentSignal(params.recentSessions, "low_frequency") || hasRecentSignal(params.recentSessions, "low_participation")) {
    riskFlags.push("baixa_frequencia");
  }

  const newStudentCount = countNewStudents({
    students: params.students,
    sessionDate: params.sessionDate,
  });
  const totalStudents = params.students?.length ?? 0;
  if (newStudentCount > 0) {
    riskFlags.push("alunos_novos");
  }
  if (totalStudents > 0 && newStudentCount / totalStudents > 0.25) {
    riskFlags.push("turma_heterogenea");
    estimatedGameLevel = minGameFormatLevel(estimatedGameLevel, "L3_1x1_intencional");
  }

  const jumpSize = getGameFormatLevelRank(plannedGameLevel) - getGameFormatLevelRank(estimatedGameLevel);
  if (jumpSize >= 2) {
    riskFlags.push("salto_de_complexidade");
  }
  if (jumpSize >= 3 && getGameFormatLevelRank(plannedGameLevel) >= getGameFormatLevelRank("L6_3x3_introdutorio")) {
    riskFlags.push("periodizacao_agressiva");
  }

  const confidence = resolveConfidence({
    historicalConfidence: params.historicalConfidence,
    riskFlags: unique(riskFlags),
    recentSessions: params.recentSessions,
  });
  const maxOneStepChallenge = getGameFormatLevelAtRank(getGameFormatLevelRank(estimatedGameLevel) + 1);
  let appliedCoreLevel =
    confidence === "high" && riskFlags.length === 0
      ? plannedGameLevel
      : minGameFormatLevel(plannedGameLevel, maxOneStepChallenge);

  if (riskFlags.includes("salto_de_complexidade")) {
    appliedCoreLevel = minGameFormatLevel(appliedCoreLevel, maxOneStepChallenge);
  }

  const finalRiskFlags = unique(riskFlags);
  const recommendation = resolveRecommendation({
    confidence,
    plannedGameLevel,
    estimatedGameLevel,
    appliedCoreLevel,
  });

  return {
    classId: params.classGroup.id,
    plannedGameLevel,
    estimatedGameLevel,
    appliedCoreLevel,
    confidence,
    riskFlags: finalRiskFlags,
    recommendation,
    reason: buildReason(finalRiskFlags),
    teacherMessage: buildTeacherMessage({ plannedGameLevel, appliedCoreLevel }),
  };
};
