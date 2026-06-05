import type {
  ScoutingAction,
  ScoutingActionFundamental,
  ScoutingActionPhase,
  ScoutingLog,
  ScoutingSessionType,
  StudentScoutingLog,
} from "./models";

export type ScoutingSkill = "serve" | "receive" | "set" | "attack_send";
export type ScoutingScore = 0 | 1 | 2;
export type ScoreCounts = Record<ScoutingScore, number>;
export type ScoutingCounts = Record<ScoutingSkill, ScoreCounts>;

export const scoutingSkills: { id: ScoutingSkill; label: string }[] = [
  { id: "serve", label: "Saque" },
  { id: "receive", label: "Recepção" },
  { id: "set", label: "Toque" },
  { id: "attack_send", label: "Envio" },
];

export const scoutingSessionTypes: { id: ScoutingSessionType; label: string }[] = [
  { id: "treino", label: "Treino" },
  { id: "amistoso", label: "Amistoso" },
  { id: "jogo", label: "Jogo" },
];

export const scoutingActionFundamentals: {
  id: ScoutingActionFundamental;
  label: string;
}[] = [
  { id: "saque", label: "Saque" },
  { id: "recepcao", label: "Recepção" },
  { id: "levantamento", label: "Levantamento" },
  { id: "ataque", label: "Ataque" },
  { id: "bloqueio", label: "Bloqueio" },
  { id: "defesa", label: "Defesa" },
  { id: "cobertura", label: "Cobertura" },
  { id: "transicao", label: "Transição" },
  { id: "comunicacao", label: "Comunicação" },
];

export const scoutingActionPhases: { id: ScoutingActionPhase; label: string }[] = [
  { id: "saque", label: "Saque" },
  { id: "side_out", label: "Side-out" },
  { id: "transicao", label: "Transição" },
  { id: "pressao", label: "Pressão" },
  { id: "freeball", label: "Freeball" },
];

export type ScoutingResultOption = {
  key: string;
  label: string;
  level: 0 | 1 | 2 | 3;
};

const defaultResultOptions: ScoutingResultOption[] = [
  { key: "erro", label: "Erro", level: 0 },
  { key: "continuidade", label: "Continuidade", level: 1 },
  { key: "boa", label: "Boa", level: 2 },
  { key: "excelente", label: "Excelente", level: 3 },
];

export const scoutingResultOptionsByFundamental: Record<
  ScoutingActionFundamental,
  ScoutingResultOption[]
> = {
  saque: [
    { key: "erro", label: "Erro", level: 0 },
    { key: "entrou", label: "Entrou", level: 1 },
    { key: "dificultou", label: "Dificultou", level: 2 },
    { key: "ace", label: "Ace", level: 3 },
  ],
  recepcao: [
    { key: "erro", label: "Erro", level: 0 },
    { key: "c_baixo", label: "C/Baixo", level: 1 },
    { key: "b_medio", label: "B/Médio", level: 2 },
    { key: "a_alto", label: "A/Alto", level: 3 },
  ],
  levantamento: [
    { key: "erro", label: "Erro", level: 0 },
    { key: "manteve", label: "Manteve", level: 1 },
    { key: "organizou", label: "Organizou", level: 2 },
    { key: "decisivo", label: "Decisivo", level: 3 },
  ],
  ataque: [
    { key: "erro", label: "Erro", level: 0 },
    { key: "bloqueado", label: "Bloqueado", level: 1 },
    { key: "continuidade", label: "Continuidade", level: 2 },
    { key: "ponto", label: "Ponto", level: 3 },
  ],
  bloqueio: [
    { key: "erro", label: "Erro", level: 0 },
    { key: "tocou", label: "Tocou", level: 1 },
    { key: "amorteceu", label: "Amorteceu", level: 2 },
    { key: "ponto", label: "Ponto", level: 3 },
  ],
  defesa: [
    { key: "nao_defendeu", label: "Não defendeu", level: 0 },
    { key: "manteve_viva", label: "Manteve viva", level: 1 },
    { key: "defesa_boa", label: "Defesa boa", level: 2 },
    { key: "contra_ataque", label: "Contra-ataque", level: 3 },
  ],
  cobertura: [
    { key: "falhou", label: "Falhou", level: 0 },
    { key: "presente", label: "Presente", level: 1 },
    { key: "recuperou", label: "Recuperou", level: 2 },
    { key: "virou_ponto", label: "Virou ponto", level: 3 },
  ],
  transicao: [
    { key: "quebrou", label: "Quebrou", level: 0 },
    { key: "lenta", label: "Lenta", level: 1 },
    { key: "organizada", label: "Organizada", level: 2 },
    { key: "efetiva", label: "Efetiva", level: 3 },
  ],
  comunicacao: [
    { key: "falhou", label: "Falhou", level: 0 },
    { key: "tardia", label: "Tardia", level: 1 },
    { key: "clara", label: "Clara", level: 2 },
    { key: "lideranca", label: "Liderança", level: 3 },
  ],
};

export const getScoutingResultOptions = (
  fundamental: ScoutingActionFundamental
): ScoutingResultOption[] =>
  scoutingResultOptionsByFundamental[fundamental] ?? defaultResultOptions;

export const getScoutingResultOption = (
  fundamental: ScoutingActionFundamental,
  resultKey: string
) =>
  getScoutingResultOptions(fundamental).find((option) => option.key === resultKey) ??
  getScoutingResultOptions(fundamental)[0];

export const studentScoutingLimits: Record<ScoutingSkill, number> = {
  serve: 20,
  receive: 20,
  set: 15,
  attack_send: 15,
};

export const scoutingSkillHelp: Record<ScoutingSkill, string[]> = {
  serve: [
    "0 = erro (fora/rede)",
    "1 = entrou",
    "2 = entrou e dificultou (direcionado/difícil)",
  ],
  receive: [
    "0 = não controlou",
    "1 = controlou e manteve vivo",
    "2 = controlou bem (bola jogável)",
  ],
  set: [
    "0 = não deu continuidade",
    "1 = manteve vivo",
    "2 = direcionou bem (preparou continuidade/alvo)",
  ],
  attack_send: [
    "0 = erro (fora/rede/não passa)",
    "1 = enviou fácil (sem direção)",
    "2 = enviou com direção/qualidade (zona/dificultou)",
  ],
};

export const scoutingInitiationNote =
  "Registre o scouting no jogo reduzido/jogo final (últimos 10-15 min) para comparar melhor as aulas.";

export const scoutingPriorityNote =
  "Prioridade: Saque + Recepção. Depois Toque + Envio.";

export const scoutingEnvioTooltip =
  "Envio = devolver a bola para o outro lado (toque/manchete/lançamento permitido em regras adaptadas).";

export const createEmptyCounts = (): ScoutingCounts => ({
  serve: { 0: 0, 1: 0, 2: 0 },
  receive: { 0: 0, 1: 0, 2: 0 },
  set: { 0: 0, 1: 0, 2: 0 },
  attack_send: { 0: 0, 1: 0, 2: 0 },
});

export const countsFromLog = (log: ScoutingLog): ScoutingCounts => ({
  serve: { 0: log.serve0, 1: log.serve1, 2: log.serve2 },
  receive: { 0: log.receive0, 1: log.receive1, 2: log.receive2 },
  set: { 0: log.set0, 1: log.set1, 2: log.set2 },
  attack_send: { 0: log.attackSend0, 1: log.attackSend1, 2: log.attackSend2 },
});

export const countsFromStudentLog = (log: StudentScoutingLog): ScoutingCounts => ({
  serve: { 0: log.serve0, 1: log.serve1, 2: log.serve2 },
  receive: { 0: log.receive0, 1: log.receive1, 2: log.receive2 },
  set: { 0: log.set0, 1: log.set1, 2: log.set2 },
  attack_send: { 0: log.attackSend0, 1: log.attackSend1, 2: log.attackSend2 },
});

export const buildLogFromCounts = (
  base: Omit<ScoutingLog, "serve0" | "serve1" | "serve2" | "receive0" | "receive1" | "receive2" | "set0" | "set1" | "set2" | "attackSend0" | "attackSend1" | "attackSend2">,
  counts: ScoutingCounts
): ScoutingLog => ({
  ...base,
  serve0: counts.serve[0],
  serve1: counts.serve[1],
  serve2: counts.serve[2],
  receive0: counts.receive[0],
  receive1: counts.receive[1],
  receive2: counts.receive[2],
  set0: counts.set[0],
  set1: counts.set[1],
  set2: counts.set[2],
  attackSend0: counts.attack_send[0],
  attackSend1: counts.attack_send[1],
  attackSend2: counts.attack_send[2],
});

export const getSkillMetrics = (counts: ScoreCounts) => {
  const total = counts[0] + counts[1] + counts[2];
  if (!total) {
    return { total: 0, avg: 0, goodPct: 0 };
  }
  const avg = (counts[1] + counts[2] * 2) / total;
  const goodPct = counts[2] / total;
  return { total, avg, goodPct };
};

export const getTotalActions = (counts: ScoutingCounts) =>
  scoutingSkills.reduce((sum, skill) => {
    const metrics = getSkillMetrics(counts[skill.id]);
    return sum + metrics.total;
  }, 0);

export const getTechnicalPerformanceScore = (counts: ScoutingCounts) => {
  const weights: Record<ScoutingSkill, number> = {
    serve: 25,
    receive: 25,
    set: 20,
    attack_send: 20,
  };
  const weightedSum = scoutingSkills.reduce((sum, skill) => {
    const metrics = getSkillMetrics(counts[skill.id]);
    return sum + metrics.avg * weights[skill.id];
  }, 0);
  // metrics.avg is 0..2, normalize to 0..100
  return Math.round((weightedSum / 2) * 10) / 10;
};

export const getFocusSuggestion = (
  counts: ScoutingCounts,
  minActions = 10
) => {
  const totalActions = getTotalActions(counts);
  if (totalActions < minActions) return null;
  const scored = scoutingSkills
    .map((skill) => ({
      skill,
      metrics: getSkillMetrics(counts[skill.id]),
    }))
    .filter((entry) => entry.metrics.total > 0);
  if (!scored.length) return null;
  scored.sort((a, b) => a.metrics.avg - b.metrics.avg);
  const weakest = scored[0].skill.id;
  const suggestionMap: Record<ScoutingSkill, string> = {
    receive: "Recepção/manchete direcionada + jogos guiados",
    serve: "Saque por baixo curto e por zonas + jogo iniciando com saque",
    set: "Toque para alvo e em dupla + sequência manchete->toque",
    attack_send: "Envio direcional para zonas + jogo reduzido",
  };
  return {
    skill: weakest,
    label: scoutingSkills.find((skill) => skill.id === weakest)?.label ?? "",
    text: suggestionMap[weakest],
  };
};

const legacySkillByFundamental: Partial<Record<ScoutingActionFundamental, ScoutingSkill>> = {
  saque: "serve",
  recepcao: "receive",
  levantamento: "set",
  ataque: "attack_send",
};

export const scoreFromScoutingResultLevel = (level: ScoutingAction["resultLevel"]): ScoutingScore => {
  if (level >= 3) return 2;
  if (level >= 1) return 1;
  return 0;
};

export const aggregateScoutingActionsToCounts = (
  actions: ScoutingAction[]
): ScoutingCounts => {
  const counts = createEmptyCounts();
  actions.forEach((action) => {
    const legacySkill = legacySkillByFundamental[action.fundamental];
    if (!legacySkill) return;
    const score = scoreFromScoutingResultLevel(action.resultLevel);
    counts[legacySkill][score] += 1;
  });
  return counts;
};

type FundamentalSummary = {
  fundamental: ScoutingActionFundamental;
  label: string;
  total: number;
  average: number;
  positiveRate: number;
};

const summarizeFundamentals = (actions: ScoutingAction[]): FundamentalSummary[] => {
  const grouped = new Map<ScoutingActionFundamental, { total: number; sum: number; positive: number }>();
  actions.forEach((action) => {
    const current = grouped.get(action.fundamental) ?? { total: 0, sum: 0, positive: 0 };
    current.total += 1;
    current.sum += action.resultLevel;
    if (action.resultLevel >= 2) current.positive += 1;
    grouped.set(action.fundamental, current);
  });
  return scoutingActionFundamentals
    .map((fundamental) => {
      const current = grouped.get(fundamental.id);
      if (!current) return null;
      return {
        fundamental: fundamental.id,
        label: fundamental.label,
        total: current.total,
        average: current.sum / current.total,
        positiveRate: current.positive / current.total,
      };
    })
    .filter((item): item is FundamentalSummary => Boolean(item));
};

export type ScoutingTeamSignal = {
  title: string;
  description: string;
  tone: "danger" | "warning" | "success";
};

export const buildScoutingTeamSignals = (
  actions: ScoutingAction[],
  minActions = 8
): ScoutingTeamSignal[] => {
  if (actions.length < minActions) return [];
  return summarizeFundamentals(actions)
    .filter((item) => item.total >= 3)
    .flatMap((item): ScoutingTeamSignal[] => {
      if (item.average < 1.15) {
        return [
          {
            title: `${item.label} em atenção`,
            description: "Amostra recente indica baixa efetividade.",
            tone: "danger",
          },
        ];
      }
      if (item.average < 1.75) {
        return [
          {
            title: `${item.label} instável`,
            description: "Há ações positivas, mas a consistência ainda oscila.",
            tone: "warning",
          },
        ];
      }
      if (item.average >= 2.35) {
        return [
          {
            title: `${item.label} sustentando`,
            description: "Ações recentes mostram bom aproveitamento.",
            tone: "success",
          },
        ];
      }
      return [];
    })
    .slice(0, 3);
};

export type ScoutingPriority = {
  title: string;
  description: string;
};

export const buildScoutingWeeklyPriorities = (
  actions: ScoutingAction[],
  minActions = 8
): ScoutingPriority[] => {
  if (actions.length < minActions) return [];
  return summarizeFundamentals(actions)
    .filter((item) => item.total >= 3 && item.average < 1.85)
    .sort((a, b) => a.average - b.average)
    .map((item) => ({
      title: item.label,
      description:
        item.average < 1.15
          ? "Priorizar consistência e tomada de decisão."
          : "Reforçar execução sob pressão.",
    }))
    .slice(0, 3);
};

export type ScoutingAthleteHighlight = {
  studentId: string | null;
  name: string;
  actions: number;
  positiveActions: number;
  score: number;
};

export const buildScoutingAthleteHighlights = (
  actions: ScoutingAction[],
  minActions = 2
): ScoutingAthleteHighlight[] => {
  const grouped = new Map<
    string,
    { studentId: string | null; name: string; actions: number; positive: number; sum: number }
  >();
  actions.forEach((action) => {
    const name = (action.athleteName ?? "").trim();
    if (!name) return;
    const key = action.studentId?.trim() || name;
    const current = grouped.get(key) ?? {
      studentId: action.studentId ?? null,
      name,
      actions: 0,
      positive: 0,
      sum: 0,
    };
    current.actions += 1;
    current.sum += action.resultLevel;
    if (action.resultLevel >= 2) current.positive += 1;
    grouped.set(key, current);
  });
  return Array.from(grouped.values())
    .filter((item) => item.actions >= minActions)
    .map((item) => ({
      studentId: item.studentId,
      name: item.name,
      actions: item.actions,
      positiveActions: item.positive,
      score: Math.round((item.sum / (item.actions * 3)) * 100),
    }))
    .sort((a, b) => b.score - a.score || b.positiveActions - a.positiveActions)
    .slice(0, 3);
};
