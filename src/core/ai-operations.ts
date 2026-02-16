import type {
    ProgressionSessionPlan,
    SessionLog,
    TrainingPlan,
    VolleyballLessonPlan,
    VolleyballSkill,
} from "./models";

export type SyncHealthLike = {
  pendingWrites: {
    total: number;
    highRetry: number;
    maxRetry: number;
    deadLetterCandidates: number;
    deadLetterStored: number;
  };
  recentQueueErrors: { id: string; kind: string; retryCount: number; lastError: string | null }[];
};

export type AutoFixSuggestion = {
  id: string;
  title: string;
  rationale: string;
  action: "reprocess_network" | "move_dead_letter";
  impact: string;
};

const avg = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const inferSkillsFromText = (text: string): VolleyballSkill[] => {
  const normalized = text.toLowerCase();
  const skills: VolleyballSkill[] = [];
  if (/(passe|recepção|manchete)/.test(normalized)) skills.push("passe");
  if (/(levantamento|levantador|set)/.test(normalized)) skills.push("levantamento");
  if (/(ataque|spike|cortada)/.test(normalized)) skills.push("ataque");
  if (/(bloqueio|block)/.test(normalized)) skills.push("bloqueio");
  if (/(defesa|dig|cobertura)/.test(normalized)) skills.push("defesa");
  if (/(saque|serve|serviço)/.test(normalized)) skills.push("saque");
  if (/(transição|transicao|virada de bola)/.test(normalized)) skills.push("transicao");
  return skills.length ? skills : ["passe", "levantamento"];
};

export const buildExecutiveSummary = (options: {
  className: string;
  trainingPlans: TrainingPlan[];
  sessionLogs: SessionLog[];
  syncHealth: SyncHealthLike;
}) => {
  const { className, trainingPlans, sessionLogs, syncHealth } = options;
  const attendanceAvg = avg(sessionLogs.map((log) => Number(log.attendance || 0)));
  const rpeAvg = avg(sessionLogs.map((log) => Number(log.PSE || 0)));

  const risks: string[] = [];
  if (syncHealth.pendingWrites.highRetry > 0) {
    risks.push(`Fila de sync com ${syncHealth.pendingWrites.highRetry} item(ns) de alto retry.`);
  }
  if (rpeAvg >= 7) {
    risks.push("Carga percebida elevada (PSE médio alto) nas sessões recentes.");
  }
  if (attendanceAvg < 0.7) {
    risks.push("Presença média abaixo de 70%, risco de baixa continuidade pedagógica.");
  }

  const actions = [
    "Priorizar progressão por critérios objetivos na próxima sessão.",
    "Inserir bloco preventivo de ombro/core no aquecimento (8-10 min).",
    "Fechar sessão com jogo condicionado vinculado ao objetivo técnico da semana.",
  ];

  return [
    `Resumo executivo - ${className}`,
    `- Sessões analisadas: ${sessionLogs.length}`,
    `- Planos salvos: ${trainingPlans.length}`,
    `- Presença média: ${(attendanceAvg * 100).toFixed(0)}%`,
    `- PSE médio: ${rpeAvg.toFixed(1)}`,
    risks.length ? `- Riscos: ${risks.join(" | ")}` : "- Riscos: sem alertas críticos no período.",
    `- Próximas ações: ${actions.join(" | ")}`,
  ].join("\n");
};

export const buildCommunicationDraft = (options: {
  className: string;
  nextObjective: string;
  criticalPoint: string;
}) => {
  const { className, nextObjective, criticalPoint } = options;
  return [
    `Turma ${className}, tudo certo?`,
    `Objetivo da próxima aula: ${nextObjective}.`,
    `Ponto de atenção: ${criticalPoint}.`,
    "Cheguem 10 min antes para o aquecimento preventivo e organização inicial.",
    "Boa semana e contamos com vocês em quadra!",
  ].join(" ");
};

export const buildSupportModeAnalysis = (health: SyncHealthLike) => {
  const { pendingWrites, recentQueueErrors } = health;
  const topError = recentQueueErrors[0]?.lastError ?? "Sem erro recente detalhado.";

  const probableCause =
    pendingWrites.highRetry > 0
      ? "Provável instabilidade de rede/sync com retries acumulados."
      : pendingWrites.total > 0
        ? "Fila ativa sem falha crítica; monitorar flush normal."
        : "Sem evidência de problema de sync no momento.";

  const safeAction =
    pendingWrites.highRetry > 0
      ? "Reprocessar falhas de rede e revisar itens em dead-letter candidatos."
      : "Manter monitoramento e exportar relatório de saúde quando necessário.";

  return [
    "Support mode - análise de sync",
    `- Pending total: ${pendingWrites.total}`,
    `- High retry: ${pendingWrites.highRetry}`,
    `- Dead-letter armazenado: ${pendingWrites.deadLetterStored}`,
    `- Causa provável: ${probableCause}`,
    `- Ação segura: ${safeAction}`,
    `- Último erro: ${topError}`,
  ].join("\n");
};

export const buildAutoFixSuggestions = (health: SyncHealthLike): AutoFixSuggestion[] => {
  const suggestions: AutoFixSuggestion[] = [];
  if (health.pendingWrites.highRetry > 0) {
    suggestions.push({
      id: "reprocess-network",
      title: "Reprocessar falhas de rede",
      rationale: "Existem itens com alto retry e erro transitório de conexão.",
      action: "reprocess_network",
      impact: "Tenta limpar fila sem alterar dados de negócio.",
    });
  }
  if (health.pendingWrites.deadLetterCandidates > 0) {
    suggestions.push({
      id: "move-dead-letter",
      title: "Mover candidatos para dead-letter",
      rationale: "Há itens com retry alto que podem estar bloqueando a fila.",
      action: "move_dead_letter",
      impact: "Isola casos problemáticos para análise manual posterior.",
    });
  }
  return suggestions;
};

export const progressionPlanToDraft = (
  plan: ProgressionSessionPlan,
  className: string
) => ({
  title: `Progressão - ${className}`,
  tags: ["progressao", "proxima-aula", plan.progressionDimension.replace("_", "-")],
  warmup: plan.warmup,
  main: [...plan.technicalTactical, ...plan.conditionedGame],
  cooldown: [
    ...plan.regressions.slice(0, 1),
    ...plan.riskAdjustments.slice(0, 1),
  ],
  warmupTime: "12 minutos",
  mainTime: "38 minutos",
  cooldownTime: "10 minutos",
});

export const volleyballLessonPlanToDraft = (
  plan: VolleyballLessonPlan,
  className: string
) => ({
  title: `Progressão - ${className}`,
  tags: [
    "progressao",
    "proxima-aula",
    plan.primaryFocus.skill,
    plan.secondaryFocus.skill,
    ...plan.rulesTriggered.slice(0, 2),
  ],
  warmup: plan.blocks
    .filter((block) => block.type === "warmup_preventive")
    .flatMap((block) => [
      `${block.minutes} min - ${block.drillIds.join(", ")}`,
      ...(block.successCriteria ?? []),
    ]),
  main: plan.blocks
    .filter((block) => block.type === "skill" || block.type === "game_conditioned")
    .flatMap((block) => [
      `${block.minutes} min - ${block.drillIds.join(", ")}`,
      ...(block.successCriteria ?? []),
      ...(block.notes ? [block.notes] : []),
      ...(block.scoring ? [`Pontuação: ${block.scoring}`] : []),
    ]),
  cooldown: plan.blocks
    .filter((block) => block.type === "cooldown_feedback")
    .flatMap((block) => [
      `${block.minutes} min - ${block.drillIds.join(", ")}`,
      ...(block.notes ? [block.notes] : []),
    ]),
  warmupTime: `${plan.blocks
    .filter((block) => block.type === "warmup_preventive")
    .reduce((acc, block) => acc + block.minutes, 0)} minutos`,
  mainTime: `${plan.blocks
    .filter((block) => block.type === "skill" || block.type === "game_conditioned")
    .reduce((acc, block) => acc + block.minutes, 0)} minutos`,
  cooldownTime: `${plan.blocks
    .filter((block) => block.type === "cooldown_feedback")
    .reduce((acc, block) => acc + block.minutes, 0)} minutos`,
});
