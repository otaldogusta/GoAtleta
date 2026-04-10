import type {
  ProgressionDimension,
  ProgressionSessionPlan,
  SessionSkillSnapshot,
  VolleyballLessonPlan,
  VolleyballSkill,
} from "./models";
import { resolveLadderTransition } from "./volleyball/skill-ladders";

export type PedagogicalProfile = "fundamental" | "transicao" | "especializacao";

export type ProgressionRequest = {
  className: string;
  objective: string;
  focusSkills: VolleyballSkill[];
  pedagogicalProfile?: PedagogicalProfile;
  previousSnapshot: Pick<
    SessionSkillSnapshot,
    "consistencyScore" | "successRate" | "decisionQuality" | "notes"
  >;
};

export type VolleyballLessonPlanRequest = ProgressionRequest & {
  classId: string;
  unitId: string;
  mesoWeek?: number;
  microDay?: string;
  lastRpeGroup?: number;
  lastAttendanceCount?: number;
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
  focusSkills: VolleyballSkill[],
  profile: PedagogicalProfile
) => {
  const firstSkill = focusSkills[0] ?? "passe";
  const criteriaByProfile: Record<
    PedagogicalProfile,
    Record<ProgressionDimension, string[]>
  > = {
    fundamental: {
      consistencia: [
        "Conseguir 3 execuções corretas seguidas em cada estação.",
        `Manter foco em ${skillCue[firstSkill]} com pausas curtas para ajuste.`,
      ],
      precisao: [
        "Acertar um alvo grande 2 vezes seguidas.",
        "Variar a direção mantendo controle básico da bola.",
      ],
      pressao_tempo: [
        "Concluir a sequência técnica com tempo confortável e boa postura.",
        "Manter qualidade em séries curtas de até 4 repetições.",
      ],
      oposicao: [
        "Executar com oposição leve em pelo menos 40% das ações.",
        "Manter controle do primeiro contato em jogo cooperativo.",
      ],
      tomada_decisao: [
        "Escolher a melhor opção em pelo menos metade das jogadas observadas.",
        "Reconhecer quando simplificar a jogada para manter a bola em jogo.",
      ],
      transferencia_jogo: [
        "Aplicar o foco da sessão em jogo reduzido com continuidade do rally.",
        "Manter participação ativa em trocas de bola cooperativas.",
      ],
    },
    transicao: {
      consistencia: [
        "Alcançar ao menos 5 execuções corretas seguidas por estação.",
        `Manter foco em ${skillCue[firstSkill]} com erro não forçado abaixo de 40%.`,
      ],
      precisao: [
        "Atingir 55% de bolas na zona-alvo definida para a tarefa.",
        "Reduzir erro de direção nas repetições finais em relação ao início da sessão.",
      ],
      pressao_tempo: [
        "Concluir sequência técnica no tempo-alvo sem queda brusca de qualidade.",
        "Manter tomada de decisão funcional em séries com tempo reduzido.",
      ],
      oposicao: [
        "Sustentar execução técnica com oposição ativa em pelo menos 50% das ações.",
        "Controlar o primeiro contato após intervenção de bloqueio/defesa.",
      ],
      tomada_decisao: [
        "Realizar leitura correta de contexto em pelo menos 60% dos rallies monitorados.",
        "Selecionar solução tática coerente com o estímulo da jogada.",
      ],
      transferencia_jogo: [
        "Aplicar o foco da sessão em jogo condicionado com continuidade de rally.",
        "Manter organização coletiva em transição em pelo menos 60% dos pontos.",
      ],
    },
    especializacao: {
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
    },
  };

  return criteriaByProfile[profile][dimension];
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
  const profile = request.pedagogicalProfile ?? "especializacao";

  return {
    objective:
      request.objective ||
      `Evoluir ${request.className} em ${skills.join(", ")} com foco em ${dimension.replace("_", " ")}.`,
    progressionDimension: dimension,
    warmup: [
      profile === "fundamental"
        ? "Aquecimento lúdico com bola + ativação leve (8-10 min)."
        : "Mobilidade dinâmica + ativação de core e cintura escapular (8-10 min).",
      `Sequência técnica guiada de baixa complexidade focando ${skillSummary[0]}.`,
    ],
    technicalTactical: [
      `Drill principal com progressão por ${dimension.replace("_", " ")} para ${skills.join(" + ")}.`,
      profile === "fundamental"
        ? "Feedback curto com demonstração prática e reforço positivo."
        : "Bloco de correção por feedback curto (1 ponto forte + 1 ajuste por atleta).",
    ],
    conditionedGame: [
      profile === "fundamental"
        ? "Jogo cooperativo 2x2/3x3 com regra de manter a bola em jogo."
        : "Jogo reduzido 4x4 ou 6x6 com regra de pontuação vinculada ao objetivo técnico.",
      "Fechamento com rotação de papéis para ampliar leitura de jogo.",
    ],
    successCriteria: buildSuccessCriteria(dimension, skills, profile),
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

export const buildNextVolleyballLessonPlan = (
  request: VolleyballLessonPlanRequest
): VolleyballLessonPlan => {
  const dimension = resolveProgressionDimension(
    request.previousSnapshot.consistencyScore,
    request.previousSnapshot.successRate,
    request.previousSnapshot.decisionQuality
  );

  const skills = request.focusSkills.length
    ? request.focusSkills
    : (["passe", "levantamento"] as VolleyballSkill[]);
  const primarySkill = skills[0] ?? "passe";
  const secondarySkill = skills[1] ?? skills[0] ?? "levantamento";
  const primaryLadder = resolveLadderTransition(primarySkill, dimension);
  const secondaryLadder = resolveLadderTransition(secondarySkill, dimension);
  const lastRpe = Number(request.lastRpeGroup ?? 6);
  const profile = request.pedagogicalProfile ?? "especializacao";

  const loadIntent: VolleyballLessonPlan["loadIntent"] =
    profile === "fundamental"
      ? "low"
      : lastRpe >= 8
        ? "low"
        : dimension === "transferencia_jogo" || dimension === "oposicao"
          ? "high"
          : "moderate";

  const rulesTriggered = [
    `R1_progression_dimension:${dimension}`,
    `R2_load_intent:${loadIntent}`,
    `R3_focus_primary:${primarySkill}`,
    `R4_focus_secondary:${secondarySkill}`,
    `R5_preventive_block:mandatory`,
    `R6_pedagogical_profile:${profile}`,
  ];

  const adaptations: VolleyballLessonPlan["adaptations"] = [
    {
      if: "attendanceCount < 8",
      change: "Reduzir tamanho da quadra e priorizar duplas com mais contatos por atleta.",
    },
    {
      if: "lastSession.quality == low",
      change: "Voltar um degrau no ladder de habilidade e manter oposição passiva no bloco técnico.",
    },
    {
      if: "rpeGroup >= 8",
      change: "Diminuir volume de saltos e acelerar transição para jogo condicionado com pausas curtas.",
    },
  ];

  return {
    sport: "volleyball_indoor",
    classId: request.classId,
    unitId: request.unitId,
    cycle: {
      mesoWeek: request.mesoWeek ?? 1,
      microDay: request.microDay ?? "D1",
    },
    primaryFocus: {
      skill: primarySkill,
      ladderFrom: primaryLadder.from,
      ladderTo: primaryLadder.to,
    },
    secondaryFocus: {
      skill: secondarySkill,
      ladderFrom: secondaryLadder.from,
      ladderTo: secondaryLadder.to,
    },
    loadIntent,
    rulesTriggered,
    blocks: [
      {
        type: "warmup_preventive",
        minutes: profile === "fundamental" ? 10 : 12,
        drillIds: ["vwv_warmup_preventive_01"],
        successCriteria: ["Todos os atletas completam ativação de ombro/core sem dor reportada."],
      },
      {
        type: "skill",
        minutes: profile === "fundamental" ? 18 : 22,
        drillIds: ["vwv_skill_primary_01", "vwv_skill_secondary_01"],
        successCriteria: buildSuccessCriteria(dimension, skills, profile),
        notes:
          profile === "fundamental"
            ? "Exploração guiada com reforço positivo e ajustes simples."
            : `Progressão orientada por ${dimension.replace("_", " ")}.`,
      },
      {
        type: "game_conditioned",
        minutes: profile === "fundamental" ? 16 : 20,
        drillIds: ["vwv_game_conditioned_01"],
        scoring:
          profile === "fundamental"
            ? "Ponto extra por manter a bola em jogo por 3 toques."
            : "Ponto extra quando o foco técnico aparece com execução qualificada.",
      },
      {
        type: "cooldown_feedback",
        minutes: profile === "fundamental" ? 8 : 6,
        drillIds: ["vwv_cooldown_feedback_01"],
        notes:
          profile === "fundamental"
            ? "Fechar com feedback simples e celebração de progresso."
            : "Fechar com autoavaliação rápida e um ajuste objetivo para próxima sessão.",
      },
    ],
    adaptations,
    evidence: {
      lastSession: {
        rpeGroup: lastRpe,
        quality:
          request.previousSnapshot.consistencyScore < 0.45 ||
          request.previousSnapshot.successRate < 0.45
            ? "low"
            : request.previousSnapshot.consistencyScore > 0.75 &&
                request.previousSnapshot.successRate > 0.75
              ? "high"
              : "medium",
        attendanceCount: Number(request.lastAttendanceCount ?? 0),
        focusTags: skills,
      },
    },
    citations: [
      {
        docId: "ltd-3.0-volleyball",
        pages: "pp. 11-18",
        why: "Progressao por estagios e criterios observaveis por faixa de desenvolvimento.",
      },
      {
        docId: "volleyveilig-v1",
        pages: "pp. 6-9",
        why: "Inclusao obrigatoria de bloco preventivo em aquecimento.",
      },
      {
        docId: "joel_smith_spt_notes",
        pages: "pp. 22-24",
        why: "Ajuste de carga via percepcao subjetiva de esforco coletiva.",
      },
    ],
  };
};
