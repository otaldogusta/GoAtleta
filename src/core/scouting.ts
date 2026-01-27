import type { ScoutingLog } from "./models";

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
