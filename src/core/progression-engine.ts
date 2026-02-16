import type {
  ProgressionDimension,
  ProgressionSessionPlan,
  SessionSkillSnapshot,
  VolleyballSkill,
} from "./models";

export type ProgressionRequest = {
  className: string;
  objective: string;
  focusSkills: VolleyballSkill[];
  previousSnapshot: Pick<
    SessionSkillSnapshot,
    "consistencyScore" | "successRate" | "decisionQuality" | "notes"
  >;
};

const skillCue: Record<VolleyballSkill, string> = {
  passe: "qualidade de plataforma e direção do passe",
  levantamento: "tempo de bola e direção de levantamento",
  ataque: "escolha de golpe e controle de potência",
  bloqueio: "tempo de salto e fechamento de linha",
  defesa: "base defensiva e leitura da trajetória",
  saque: "consistência de zona e variação de alvo",
  transicao: "organização pós-contato e cobertura",
};

const resolveProgressionDimension = (
  consistencyScore: number,
  successRate: number,
  decisionQuality: number
): ProgressionDimension => {
  if (consistencyScore < 0.45 || successRate < 0.45) return "consistencia";
  if (successRate < 0.6) return "precisao";
  if (consistencyScore < 0.7) return "pressao_tempo";
  if (successRate < 0.78) return "oposicao";
  if (decisionQuality < 0.82) return "tomada_decisao";
  return "transferencia_jogo";
};

const buildSuccessCriteria = (
  dimension: ProgressionDimension,
  focusSkills: VolleyballSkill[]
) => {
  const firstSkill = focusSkills[0] ?? "passe";
  const criteriaByDimension: Record<ProgressionDimension, string[]> = {
    consistencia: [
      "Alcançar ao menos 8 execuções corretas seguidas por estação.",
      `Manter foco em ${skillCue[firstSkill]} com erro não forçado abaixo de 30%.`,
    ],
    precisao: [
      "Atingir 60% de bolas na zona-alvo definida para a tarefa.",
      "Reduzir erro de direção nas repetições finais em relação ao início da sessão.",
    ],
    pressao_tempo: [
      "Concluir sequência técnica dentro do tempo-alvo sem queda de qualidade.",
      "Manter tomada de decisão funcional em séries com tempo reduzido.",
    ],
    oposicao: [
      "Sustentar execução técnica com oposição ativa em pelo menos 55% das ações.",
      "Controlar o primeiro contato após intervenção de bloqueio/defesa.",
    ],
    tomada_decisao: [
      "Realizar leitura correta de contexto em pelo menos 65% dos rallies monitorados.",
      "Selecionar solução tática coerente com o estímulo da jogada.",
    ],
    transferencia_jogo: [
      "Aplicar o foco da sessão em jogo condicionado com continuidade de rally.",
      "Manter organização coletiva em transição por ao menos 70% dos pontos.",
    ],
  };
  return criteriaByDimension[dimension];
};

export const buildNextSessionProgression = (
  request: ProgressionRequest
): ProgressionSessionPlan => {
  const dimension = resolveProgressionDimension(
    request.previousSnapshot.consistencyScore,
    request.previousSnapshot.successRate,
    request.previousSnapshot.decisionQuality
  );

  const skills = request.focusSkills.length
    ? request.focusSkills
    : (["passe", "levantamento"] as VolleyballSkill[]);
  const skillSummary = skills.map((skill) => skillCue[skill]);

  return {
    objective:
      request.objective ||
      `Evoluir ${request.className} em ${skills.join(", ")} com foco em ${dimension.replace("_", " ")}.`,
    progressionDimension: dimension,
    warmup: [
      "Mobilidade dinâmica + ativação de core e cintura escapular (8-10 min).",
      `Sequência técnica guiada de baixa complexidade focando ${skillSummary[0]}.`,
    ],
    technicalTactical: [
      `Drill principal com progressão por ${dimension.replace("_", " ")} para ${skills.join(" + ")}.`,
      "Bloco de correção por feedback curto (1 ponto forte + 1 ajuste por atleta).",
    ],
    conditionedGame: [
      "Jogo reduzido 4x4 ou 6x6 com regra de pontuação vinculada ao objetivo técnico.",
      "Fechamento com rotação de papéis para ampliar leitura de jogo.",
    ],
    successCriteria: buildSuccessCriteria(dimension, skills),
    regressions: [
      "Reduzir oposição (sem bloqueio ativo) mantendo o mesmo objetivo técnico.",
      "Aumentar tempo entre repetições para preservar qualidade de execução.",
    ],
    progressions: [
      "Adicionar alvo secundário e tomada de decisão após primeiro contato.",
      "Introduzir oposição variável por rodadas curtas com placar objetivo.",
    ],
    riskAdjustments: [
      "Controlar volume de salto/ataque em blocos de alta intensidade.",
      "Inserir rotina preventiva de ombro e core no aquecimento.",
    ],
  };
};
