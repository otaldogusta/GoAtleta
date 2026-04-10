import type { TrainingPlanPedagogy, VolleyballSkill } from "../models";
import { toVisibleCoachingText } from "./coaching-lexicon";
import type { PedagogicalApproachDetection } from "./pedagogical-approach-detector";

export type SessionMethodologyEvidence = {
  title: string;
  authors: string;
  sourceYear?: number | null;
  citationText: string;
  url?: string;
};

const approachSummaryByType: Record<PedagogicalApproachDetection["approach"], string> = {
  tradicional:
    "a aula puxa uma condução mais guiada, com referência clara do movimento e repetição orientada",
  cognitivista:
    "a aula puxa leitura da jogada, comparação de respostas e escolha da melhor saída",
  sociocultural:
    "a aula puxa conversa entre os atletas, ajuste em grupo e construção coletiva da jogada",
  hibrido:
    "a aula mistura referência do movimento, leitura da jogada e ajuste entre os atletas",
};

const predominanceSummaryByLevel: Record<PedagogicalApproachDetection["predominanceLevel"], string> = {
  alta: "Esse traço aparece com força na proposta.",
  moderada: "Esse traço aparece com boa clareza na proposta.",
  fraca: "Esse traço aparece misturado com outros sinais da aula.",
};

const primaryIntentByType: Record<PedagogicalApproachDetection["primaryIntent"], string> = {
  reproducao: "O treino tende a repetir o movimento com referência clara.",
  resolucao_problemas: "O treino pede ler a situação e escolher a melhor saída.",
  colaboracao: "O treino pede organizar a jogada junto com o grupo.",
  misto: "O treino alterna repetição, leitura da jogada e cooperação.",
};

const learnerRoleByType: Record<PedagogicalApproachDetection["learnerRole"], string> = {
  executar: "O aluno entra para executar com critério.",
  pensar: "O aluno entra para ler a jogada e decidir.",
  interagir: "O aluno entra para falar, combinar e ajustar com o grupo.",
  misto: "O aluno alterna execução, leitura da jogada e troca com o grupo.",
};

const secondaryApproachByType: Record<Exclude<PedagogicalApproachDetection["approach"], "hibrido">, string> = {
  tradicional: "correção mais direta do movimento",
  cognitivista: "leitura da jogada e escolha da melhor resposta",
  sociocultural: "ajuste e comunicação entre os atletas",
};

const traditionalRiskByLevel: Record<PedagogicalApproachDetection["traditionalConductionRisk"], string> = {
  baixo: "baixo: há pouco risco de a aula virar só repetição guiada.",
  medio: "médio: vale cuidar para a tarefa não virar só repetição.",
  alto: "alto: se a condução travar só na correção, a aula perde leitura da jogada e tomada de decisão.",
};

const signalByTag: Record<string, string> = {
  "execucao-orientada": "o objetivo puxa repetição e ajuste do movimento",
  "padrao-tecnico": "o texto cobra um movimento bem definido",
  "repeticao-estruturada": "a tarefa pede série e repetição",
  "tomada-de-decisao": "o objetivo pede leitura e escolha",
  autonomia: "o atleta precisa resolver mais por conta",
  "leitura-de-contexto": "a resposta muda conforme a situação da jogada",
  "investigacao-autonoma": "os atletas precisam testar e comparar saídas",
  "interacao-social": "a tarefa pede conversa e ajuste entre os atletas",
  grupo: "a dupla ou o grupo ficam no centro da ação",
  "negociacao-coletiva": "os atletas precisam combinar critérios e se organizar juntos",
  "aluno-receptor": "a condução puxa cópia do modelo e pouca decisão",
  "autonomia-acima-do-verbo": "mesmo com verbo mais fechado, a aula ainda pede autonomia",
  "execucao-contextualizada": "não é só executar, é ler a situação antes de agir",
  "co-construcao": "grupo e ação conjunta mostram ajuste coletivo da jogada",
};

const focusSkillByType: Record<VolleyballSkill, string> = {
  passe: "manchete e recepção",
  levantamento: "levantamento",
  ataque: "ataque",
  bloqueio: "bloqueio",
  defesa: "defesa",
  saque: "saque",
  transicao: "transição",
};

const methodologyApproachByType: Record<string, string> = {
  analitico: "treino mais analítico, com referência clara do movimento",
  global: "treino mais global, ligando fundamento e jogada",
  jogo: "jogo condicionado, aprendendo dentro da situação",
  hibrido: "mistura de referência do movimento com situação de jogo",
};

const scoreSummaryByRange = (score: number) => {
  if (score >= 130) return "encaixe forte com a turma";
  if (score >= 100) return "bom encaixe com a turma";
  if (score >= 70) return "encaixe parcial com a turma";
  return "encaixe fraco, vale revisar a proposta";
};

const adjustmentByType: Record<"increase" | "maintain" | "regress", string> = {
  increase: "subir a exigência",
  maintain: "manter a proposta",
  regress: "simplificar a tarefa",
};

const decisionReasonByType: Record<"health" | "readiness" | "context" | "other", string> = {
  health: "limitação física do dia",
  readiness: "resposta da turma",
  context: "contexto da aula",
  other: "outro ponto observado",
};

const unique = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

export const buildSessionPedagogicalPanelSummary = (
  detection: PedagogicalApproachDetection
) =>
  toVisibleCoachingText(
    `${approachSummaryByType[detection.approach]}. ${predominanceSummaryByLevel[detection.predominanceLevel]}`
  );

export const buildSessionPedagogicalPanelIntent = (
  detection: PedagogicalApproachDetection
) =>
  toVisibleCoachingText(
    `${primaryIntentByType[detection.primaryIntent]} ${learnerRoleByType[detection.learnerRole]}`
  );

export const buildSessionPedagogicalPanelSecondary = (
  detection: PedagogicalApproachDetection
) => {
  const items = unique(
    detection.secondaryApproaches
      .map((approach) => secondaryApproachByType[approach])
      .filter(Boolean)
  );
  if (!items.length) return "";
  return toVisibleCoachingText(`Também aparecem sinais de ${items.join(", ")}.`);
};

export const buildSessionPedagogicalPanelRisk = (
  detection: PedagogicalApproachDetection
) => toVisibleCoachingText(traditionalRiskByLevel[detection.traditionalConductionRisk]);

export const buildSessionPedagogicalPanelSignals = (
  detection: PedagogicalApproachDetection
) => {
  const items = unique(
    detection.tags
      .map((tag) => signalByTag[tag])
      .filter(Boolean)
  ).slice(0, 3);
  if (!items.length) return "";
  return toVisibleCoachingText(items.join(" • "));
};

export const formatSessionPedagogicalFocusSkill = (
  skill: VolleyballSkill | null | undefined
) => {
  if (!skill) return "";
  return focusSkillByType[skill] ?? skill;
};

export const formatSessionMethodologyApproachLabel = (value: string | undefined) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "método não identificado";
  const known = methodologyApproachByType[normalized];
  if (known) return toVisibleCoachingText(known);
  return toVisibleCoachingText(
    normalized
      .split(/[_\-\s]+/)
      .filter(Boolean)
      .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
      .join(" ")
  );
};

export const formatSessionMethodologyScoreSummary = (score: number) => {
  const safeScore = Math.max(0, Math.round(score));
  return `${safeScore}/150 • ${scoreSummaryByRange(score)}`;
};

export const formatSessionAdjustmentLabel = (
  value: "increase" | "maintain" | "regress"
) => adjustmentByType[value];

export const formatSessionDecisionReasonTypeLabel = (
  value: "health" | "readiness" | "context" | "other"
) => decisionReasonByType[value];

export const formatSessionOverrideSummary = (
  override: TrainingPlanPedagogy["override"] | null | undefined
) => {
  if (!override || override.type !== "methodology") return "";
  return toVisibleCoachingText(
    `o professor puxou a condução de ${formatSessionMethodologyApproachLabel(override.fromApproach)} para ${formatSessionMethodologyApproachLabel(override.toApproach)}.`
  );
};

export const formatSessionMethodologyEvidenceSource = (
  evidence: SessionMethodologyEvidence | null | undefined
) => {
  if (!evidence) return "";
  const title = String(evidence.title ?? "").trim();
  const authors = String(evidence.authors ?? "").trim();
  const year = typeof evidence.sourceYear === "number" ? String(evidence.sourceYear) : "";
  const meta = [authors, year].filter(Boolean).join(" • ");
  if (!title) return meta;
  if (!meta) return title;
  return `${title} • ${meta}`;
};

export const formatSessionMethodologyEvidenceExcerpt = (
  evidence: SessionMethodologyEvidence | null | undefined
) => {
  if (!evidence) return "";
  return toVisibleCoachingText(String(evidence.citationText ?? "").trim());
};
