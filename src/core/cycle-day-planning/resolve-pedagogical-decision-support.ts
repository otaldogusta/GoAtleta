import type {
  CycleDayPlanningContext,
  PedagogicalFeedbackSignal,
  PedagogicalFeedbackSignalConfidence,
  PedagogicalDecisionSupport,
  PedagogicalRiskFlag,
  SessionStrategy,
  VolleyballSkill,
} from "../models";

const skillLabel: Record<VolleyballSkill, string> = {
  passe: "passe",
  levantamento: "levantamento",
  ataque: "ataque",
  bloqueio: "bloqueio",
  defesa: "defesa",
  saque: "saque",
  transicao: "transição",
};

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const hasConflictSignal = (context: CycleDayPlanningContext) =>
  getRecentSignalEvidence(context, "emotional_conflict").some((signal) =>
    signal.confidence === "high" || signal.confidence === "medium"
  ) ||
  /conflit|briga|choro|emoc|conviv|respeito|fair play|fairplay/.test(
    normalizeText([context.classGoal, ...context.constraints, context.mustProgressFrom].join(" "))
  );

const getRecentSignalEvidence = (
  context: CycleDayPlanningContext,
  signal: PedagogicalFeedbackSignal
) =>
  context.recentSessions.flatMap((session) =>
    (session.pedagogicalFeedbackSignalEvidence ?? [])
      .filter((item) => item.type === signal)
  );

const hasRecentSignal = (
  context: CycleDayPlanningContext,
  signal: PedagogicalFeedbackSignal,
  minConfidence: PedagogicalFeedbackSignalConfidence = "medium"
) => {
  const order = { low: 1, medium: 2, high: 3 } as const;
  const evidence = getRecentSignalEvidence(context, signal);
  if (evidence.length) {
    return evidence.some((item) => order[item.confidence] >= order[minConfidence]);
  }
  return minConfidence === "low" && context.recentSessions.some((session) =>
    session.pedagogicalFeedbackSignals?.includes(signal)
  );
};

const firstSignalReason = (
  context: CycleDayPlanningContext,
  signal: PedagogicalFeedbackSignal
) => getRecentSignalEvidence(context, signal)[0]?.teacherFacingReason;

const hasFormalGameSignal = (context: CycleDayPlanningContext, strategy?: SessionStrategy) =>
  /6x6|seis contra seis|jogo formal/.test(
    normalizeText([
      context.classGoal,
      ...context.constraints,
      strategy?.drillFamilies.join(" "),
    ].join(" "))
  );

const resolveRiskFlags = (
  context: CycleDayPlanningContext,
  strategy?: SessionStrategy
): PedagogicalRiskFlag[] => {
  const risks: PedagogicalRiskFlag[] = [];
  const conflictSignal = hasConflictSignal(context);
  const formalGameSignal = hasFormalGameSignal(context, strategy);
  const highComplexity =
    strategy?.oppositionLevel === "high" ||
    strategy?.timePressureLevel === "high" ||
    strategy?.gameTransferLevel === "high";

  if (
    formalGameSignal &&
    (context.developmentStage === "fundamental" ||
      context.phaseIntent === "exploracao_fundamentos")
  ) {
    risks.push({
      code: "early_formal_game",
      severity: "high",
      reason: "Evitar 6x6 formal antes de consolidar regras e continuidade em jogos reduzidos.",
    });
  }

  if (
    strategy?.drillFamilies.includes("bloco_tecnico") &&
    !strategy.drillFamilies.includes("cooperacao") &&
    context.phaseIntent !== "pressao_competitiva"
  ) {
    risks.push({
      code: "excessive_technical_drill",
      severity: "medium",
      reason: "Evitar treino tecnicista longo sem problema de jogo ou interação entre alunos.",
    });
  }

  if (conflictSignal) {
    risks.push({
      code: "emotional_conflict",
      severity: "medium",
      reason: "Inserir regra de fair play, mediação curta e pausa de feedback coletivo.",
    });
  }

  if (hasRecentSignal(context, "low_participation") || hasRecentSignal(context, "low_frequency")) {
    risks.push({
      code: hasRecentSignal(context, "low_frequency") ? "low_frequency" : "low_participation",
      severity: "medium",
      reason: firstSignalReason(context, "low_participation") ??
        firstSignalReason(context, "low_frequency") ??
        "Baixa participação recente pede retomada simples, duplas/trios e meta de engajamento visível.",
    });
  }

  if (hasRecentSignal(context, "recurring_technical_difficulty")) {
    risks.push({
      code: "recurring_technical_difficulty",
      severity: "medium",
      reason: firstSignalReason(context, "recurring_technical_difficulty") ??
        "Dificuldade técnica recorrente pede regressão curta antes de nova complexidade.",
    });
  }

  if (hasRecentSignal(context, "excessive_competition")) {
    risks.push({
      code: "excessive_competition",
      severity: "medium",
      reason: firstSignalReason(context, "excessive_competition") ??
        "Competição excessiva recente pede pontuação cooperativa e pausa de mediação.",
    });
  }

  if (context.weeklyLoadIntent === "baixo" && highComplexity) {
    risks.push({
      code: "load_complexity_mismatch",
      severity: "medium",
      reason: "Carga baixa pede menor pressão, menos oposição e regras mais simples.",
    });
  }

  return risks;
};

const resolveApproachIntent = (
  context: CycleDayPlanningContext,
  strategy?: SessionStrategy
): PedagogicalDecisionSupport["pedagogicalApproachIntent"] => {
  const intent = strategy?.pedagogicalIntent ?? context.pedagogicalIntent;
  const families = strategy?.drillFamilies ?? context.allowedDrillFamilies;
  const conflictSignal = hasConflictSignal(context);
  const agitationSignal = hasRecentSignal(context, "class_agitation", "low");
  const cognitiveSignal =
    intent === "decision_making" ||
    intent === "game_reading" ||
    strategy?.progressionDimension === "tomada_decisao" ||
    strategy?.progressionDimension === "transferencia_jogo";
  const socioculturalSignal =
    conflictSignal ||
    intent === "team_organization" ||
    families.includes("cooperacao") ||
    context.weeklyOperationalDecision?.sessionRole === "sintese_fechamento";

  if (cognitiveSignal && socioculturalSignal) {
    return {
      primary: "combinada",
      rationale: "Combina problema de jogo com mediação coletiva e cooperação.",
      cues: uniqueStrings(["tomada de decisão", "jogo reduzido", "cooperação", conflictSignal ? "fair play" : null]),
    };
  }

  if (socioculturalSignal) {
    return {
      primary: "sociocultural",
      rationale: "Prioriza cooperação, linguagem comum e regras mediadas pela turma.",
      cues: uniqueStrings(["cooperação", "mediação", conflictSignal ? "fair play" : agitationSignal ? "organização da turma" : "convivência"]),
    };
  }

  return {
    primary: "cognitivista",
    rationale: "Organiza a aula como problema de percepção, escolha e ajuste técnico.",
    cues: uniqueStrings(["leitura de jogo", "tomada de decisão", "resolução de problemas"]),
  };
};

const resolveCapIntent = (
  context: CycleDayPlanningContext,
  strategy?: SessionStrategy
): PedagogicalDecisionSupport["capIntent"] => {
  const primarySkill = skillLabel[strategy?.primarySkill ?? context.primarySkill];
  const secondarySkill = strategy?.secondarySkill ? skillLabel[strategy.secondarySkill] : "";
  const skillPair = uniqueStrings([primarySkill, secondarySkill]).join(" e ");
  const progression = strategy?.progressionDimension ?? context.progressionDimensionTarget;
  const families = strategy?.drillFamilies ?? context.allowedDrillFamilies;
  const gameForm = families.includes("jogo_condicionado")
    ? "jogo reduzido"
    : families.includes("cooperacao")
      ? "tarefa cooperativa"
      : "atividade guiada";

  const conceitual =
    progression === "tomada_decisao" || progression === "transferencia_jogo"
      ? `Compreender quando usar ${skillPair} para resolver o problema do ${gameForm}.`
      : `Reconhecer os pontos-chave de ${skillPair} dentro da fase da semana.`;

  const procedimental =
    progression === "consistencia" || progression === "precisao"
      ? `Aplicar ${skillPair} com controle e repetição orientada.`
      : `Aplicar ${skillPair} em ${gameForm} com progressão de complexidade.`;

  const atitudinal = hasConflictSignal(context)
    ? "Praticar fair play, respeito ao erro e autorregulação durante as trocas."
    : families.includes("cooperacao")
      ? "Cooperar com colegas, comunicar combinados e sustentar a continuidade da tarefa."
      : "Manter atenção, escuta das orientações e responsabilidade pela execução.";

  return {
    conceitual: [conceitual],
    procedimental: [procedimental],
    atitudinal: [atitudinal],
  };
};

const resolveConstraintSuggestions = (
  context: CycleDayPlanningContext,
  strategy?: SessionStrategy
) => {
  const suggestions = [
    hasRecentSignal(context, "low_participation") || hasRecentSignal(context, "low_frequency")
      ? "Começar com duplas ou trios e meta de participação antes de aumentar oposição."
      : null,
    hasRecentSignal(context, "recurring_technical_difficulty")
      ? "Retomar um fundamento com alvo simples antes do jogo reduzido."
      : null,
    hasRecentSignal(context, "excessive_competition")
      ? "Usar ponto coletivo por comunicação ou três contatos antes de contar placar."
      : null,
    hasRecentSignal(context, "class_agitation", "low") && !hasConflictSignal(context)
      ? "Organizar combinados curtos antes da primeira rodada."
      : null,
    strategy?.drillFamilies.includes("jogo_condicionado")
      ? "Usar jogo reduzido com meta simples e regra visível para a turma."
      : null,
    strategy?.pedagogicalIntent === "decision_making"
      ? "Pausar entre rodadas para perguntar qual escolha resolveu melhor o ponto."
      : null,
    context.weeklyLoadIntent === "baixo" || strategy?.loadIntent === "baixo"
      ? "Reduzir pressão de tempo e aumentar pausas de orientação."
      : null,
    hasConflictSignal(context)
      ? "Pontuar fair play e combinar uma regra de convivência antes do jogo."
      : null,
  ];

  return uniqueStrings(suggestions).slice(0, 4);
};

export const resolvePedagogicalDecisionSupport = (params: {
  context: CycleDayPlanningContext;
  strategy?: SessionStrategy;
}): PedagogicalDecisionSupport => {
  const { context, strategy } = params;
  const approach = resolveApproachIntent(context, strategy);
  const capIntent = resolveCapIntent(context, strategy);
  const sourceCap = context.sourcePedagogicalDecisionSupport?.capIntent;
  const riskFlags = resolveRiskFlags(context, strategy);
  const primarySkill = skillLabel[strategy?.primarySkill ?? context.primarySkill];
  const loadIntent = strategy?.loadIntent ?? context.weeklyLoadIntent;
  const progression = String(strategy?.progressionDimension ?? context.progressionDimensionTarget).replace(/_/g, " ");
  const teacherFacingSummary =
    `Intenção: ${approach.primary}; ${primarySkill} com ${progression}; carga ${loadIntent}.`;

  return {
    capIntent: {
      conceitual: uniqueStrings([...(sourceCap?.conceitual ?? []), ...capIntent.conceitual]).slice(0, 3),
      procedimental: uniqueStrings([...(sourceCap?.procedimental ?? []), ...capIntent.procedimental]).slice(0, 3),
      atitudinal: uniqueStrings([...(sourceCap?.atitudinal ?? []), ...capIntent.atitudinal]).slice(0, 3),
    },
    pedagogicalApproachIntent: approach,
    decisionRationale:
      `A fase ${context.phaseIntent.replace(/_/g, " ")} e a carga ${loadIntent} direcionam ${primarySkill} para ${progression}.`,
    riskFlags,
    teacherFacingSummary,
    sessionConstraintSuggestions: resolveConstraintSuggestions(context, strategy),
  };
};
