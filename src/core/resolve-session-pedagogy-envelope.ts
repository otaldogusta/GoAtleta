import type { PedagogicalApproachDetection } from "./methodology/pedagogical-approach-detector";
import type {
    TrainingPlanDevelopmentStage,
    TrainingPlanGenerationHistoryMode,
    TrainingPlanObjectiveType,
    VolleyballSkill,
} from "./models";
import type {
    PedagogicalActivity,
    PedagogicalPlanBlock,
    PedagogicalPlanPackage,
} from "./pedagogical-planning";

export type SessionPedagogyEnvelope = {
  tone: "ludico" | "guiado" | "desafio_progressivo" | "jogo_aplicado";
  warmupStyle: string[];
  mainStyle: string[];
  cooldownStyle: string[];
  feedbackStyle: "positivo_curto" | "pergunta_guiada" | "reflexao_rapida";
  languageProfile: "infantil" | "juvenil" | "tecnico";
  avoidPatterns: string[];
};

export type SessionPedagogyEnvelopeDiagnostics = {
  tone: SessionPedagogyEnvelope["tone"];
  languageProfile: SessionPedagogyEnvelope["languageProfile"];
  feedbackStyle: SessionPedagogyEnvelope["feedbackStyle"];
  mainStyle: string[];
  cooldownStyle: string[];
};

type ResolveSessionPedagogyEnvelopeParams = {
  ageBand: string;
  developmentStage: TrainingPlanDevelopmentStage;
  pedagogicalApproach?: PedagogicalApproachDetection | null;
  objectiveType?: TrainingPlanObjectiveType;
  historyMode?: TrainingPlanGenerationHistoryMode;
};

type ApplySessionPedagogyEnvelopeParams = {
  plan: PedagogicalPlanPackage;
  envelope: SessionPedagogyEnvelope;
  primarySkill: VolleyballSkill;
  secondarySkill?: VolleyballSkill;
};

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const parseAgeBandStart = (value: string) => {
  const match = String(value ?? "").match(/(\d{1,2})/);
  return match ? Number(match[1]) : null;
};

const skillKeywords: Record<VolleyballSkill, RegExp> = {
  passe: /(passe|recepc|manchete)/,
  levantamento: /(levant|segunda bola|toque)/,
  ataque: /(ataque|cortada|finaliz)/,
  bloqueio: /(bloqueio|bloco)/,
  defesa: /(defesa|cobertura|dig)/,
  saque: /(saque|servico|servi[cç]o)/,
  transicao: /(transic|continuidade|reorganiz)/,
};

const avoidPatternsDefault = [
  "sem dor reportada",
  "ativação de core",
  "ativação de ombro",
  "estabilização",
];

const primarySkillLabel: Record<VolleyballSkill, string> = {
  passe: "passe",
  levantamento: "levantamento",
  ataque: "ataque",
  bloqueio: "bloqueio",
  defesa: "defesa",
  saque: "saque",
  transicao: "transição",
};

const buildMainSummary = (skill: VolleyballSkill, language: SessionPedagogyEnvelope["languageProfile"]) => {
  if (language === "infantil") {
    return `Desafio guiado de ${primarySkillLabel[skill]} com alvo simples, repetições curtas e feedback imediato.`;
  }
  if (language === "juvenil") {
    return `Bloco principal com foco em ${primarySkillLabel[skill]}, buscando consistência técnica e tomada de decisão progressiva.`;
  }
  return `Bloco principal orientado a ${primarySkillLabel[skill]}, com critérios técnicos observáveis e progressão contextual.`;
};

const buildCooldownSummary = (
  skill: VolleyballSkill,
  feedbackStyle: SessionPedagogyEnvelope["feedbackStyle"],
  language: SessionPedagogyEnvelope["languageProfile"]
) => {
  if (language === "infantil") {
    return `Fechamento com reflexão curta sobre o ${primarySkillLabel[skill]}, respiração leve e celebração do progresso.`;
  }
  if (feedbackStyle === "pergunta_guiada") {
    return `Volta à calma com pergunta guiada sobre o ${primarySkillLabel[skill]}, organização final e recuperação leve.`;
  }
  return `Volta à calma com síntese do ${primarySkillLabel[skill]}, recuperação e organização final da sessão.`;
};

const fallbackMainActivitiesBySkill: Record<VolleyballSkill, Array<{ name: string; description: string }>> = {
  saque: [
    {
      name: "Saque com alvo em zonas simples",
      description: "Saque com alvo em zonas marcadas, priorizando controle, direção e rotina curta de execução.",
    },
    {
      name: "Desafio em dupla: 3 acertos no alvo",
      description: "Em duplas, cada aluno busca 3 acertos no alvo com feedback imediato do professor.",
    },
    {
      name: "Rodízio curto com ajuste técnico",
      description: "Rodízio curto com foco em contato, direção e repetição correta do saque.",
    },
  ],
  passe: [
    {
      name: "Passe orientado para alvo",
      description: "Passe para alvo em duplas, com controle de plataforma e direção da bola.",
    },
    {
      name: "Desafio de sequência em trio",
      description: "Em trios, manter sequência de passes corretos com feedback curto entre tentativas.",
    },
    {
      name: "Rodízio com ajuste de base",
      description: "Rodízio com ajuste de base corporal e precisão no primeiro contato.",
    },
  ],
  levantamento: [
    {
      name: "Levantamento para zona-alvo",
      description: "Levantamento com controle de trajetória e direção para zona-alvo definida.",
    },
    {
      name: "Desafio de tempo de bola",
      description: "Desafio em duplas para sincronizar tempo de bola e estabilidade no toque.",
    },
    {
      name: "Rodízio com variação de alvo",
      description: "Rodízio curto com variação de alvo mantendo qualidade técnica do levantamento.",
    },
  ],
  ataque: [
    {
      name: "Ataque direcionado por alvo",
      description: "Ataque com direção definida, ajustando aproximação, tempo e finalização.",
    },
    {
      name: "Desafio de finalização em dupla",
      description: "Em duplas, buscar sequência de finalizações corretas com feedback imediato.",
    },
    {
      name: "Rodízio de decisão ofensiva",
      description: "Rodízio curto com escolha de direção e ajuste rápido entre repetições.",
    },
  ],
  bloqueio: [
    {
      name: "Bloqueio com tempo de salto",
      description: "Bloqueio com foco no tempo de salto e posicionamento de mãos no corredor.",
    },
    {
      name: "Desafio lateral em dupla",
      description: "Em duplas, ajustar deslocamento lateral e fechamento de espaço com repetição curta.",
    },
    {
      name: "Rodízio com leitura do atacante",
      description: "Rodízio com leitura simples do atacante e resposta coordenada no bloqueio.",
    },
  ],
  defesa: [
    {
      name: "Defesa com direção ao alvo",
      description: "Defesa com base ativa e direcionamento da bola para alvo de continuidade.",
    },
    {
      name: "Desafio de recuperação em dupla",
      description: "Em dupla, recuperar bolas difíceis com ajuste rápido e feedback positivo.",
    },
    {
      name: "Rodízio de cobertura",
      description: "Rodízio com foco em cobertura e resposta coordenada após o primeiro contato.",
    },
  ],
  transicao: [
    {
      name: "Transição defesa-ataque guiada",
      description: "Transição com reposicionamento rápido e continuidade da jogada em sequência curta.",
    },
    {
      name: "Desafio de reorganização em trio",
      description: "Em trio, reorganizar a jogada após defesa com comunicação simples e objetiva.",
    },
    {
      name: "Rodízio com decisão de continuidade",
      description: "Rodízio com escolha rápida da melhor opção para manter a jogada viva.",
    },
  ],
};

const activityLooksGeneric = (value: string) => {
  const text = normalizeText(value);
  if (!text) return true;
  return /(atividade principal|exercicio principal|tarefa principal|feedback simples|celebracao de progresso|fechar com)/.test(text);
};

const hasSkillSignal = (value: string, skill: VolleyballSkill) => {
  const text = normalizeText(value);
  if (!text) return false;
  return skillKeywords[skill].test(text);
};

const detectExplicitSkill = (value: string): VolleyballSkill | null => {
  const text = normalizeText(value);
  if (!text) return null;
  const orderedSkills: VolleyballSkill[] = [
    "saque",
    "levantamento",
    "ataque",
    "bloqueio",
    "defesa",
    "transicao",
    "passe",
  ];
  return orderedSkills.find((skill) => skillKeywords[skill].test(text)) ?? null;
};

const normalizeByAvoidPatterns = (value: string, envelope: SessionPedagogyEnvelope) => {
  let next = String(value ?? "").trim();
  if (!next) return next;

  envelope.avoidPatterns.forEach((pattern) => {
    const normalizedPattern = normalizeText(pattern);
    if (!normalizedPattern) return;
    if (!normalizeText(next).includes(normalizedPattern)) return;
    next = next
      .replace(/sem dor reportada/gi, "com execução confortável")
      .replace(/ativa[cç][aã]o de core/gi, "coordenação corporal")
      .replace(/ativa[cç][aã]o de ombro/gi, "preparação de movimento")
      .replace(/estabiliza[cç][aã]o/gi, "controle corporal");
  });
  return next;
};

const adaptMainBlock = (
  block: PedagogicalPlanBlock,
  envelope: SessionPedagogyEnvelope,
  primarySkill: VolleyballSkill,
  secondarySkill?: VolleyballSkill
) => {
  const baseTemplates = fallbackMainActivitiesBySkill[primarySkill];
  const blockText = [block.summary, ...block.activities.map((a) => `${a.name}. ${a.description}`)].join(" ");
  const firstActivitySkill = detectExplicitSkill(block.activities[0]?.name || "");
  const hasCompetingLeadSkill =
    Boolean(firstActivitySkill) &&
    firstActivitySkill !== primarySkill &&
    firstActivitySkill !== secondarySkill;
  const shouldRewriteMain =
    !hasSkillSignal(blockText, primarySkill) ||
    activityLooksGeneric(block.summary || "") ||
    hasCompetingLeadSkill;

  const activities = block.activities.length
    ? block.activities.map((activity, index) => {
        const template = baseTemplates[index % baseTemplates.length];
        const current = `${activity.name}. ${activity.description}`;
        const competingSkill = detectExplicitSkill(activity.name);
        const keepName =
          hasSkillSignal(activity.name, primarySkill) &&
          !activityLooksGeneric(activity.name) &&
          (!competingSkill || competingSkill === primarySkill || competingSkill === secondarySkill);
        const keepDescription = hasSkillSignal(current, primarySkill) && !activityLooksGeneric(activity.description);

        const nextName = shouldRewriteMain && !keepName ? template.name : activity.name;
        const nextDescription = shouldRewriteMain && !keepDescription
          ? template.description
          : normalizeByAvoidPatterns(activity.description, envelope);

        return {
          ...activity,
          name: nextName,
          description: nextDescription,
        } satisfies PedagogicalActivity;
      })
    : baseTemplates.map((template, index) => ({
        id: `main_env_${index + 1}`,
        name: template.name,
        description: template.description,
      }));

  return {
    ...block,
    summary: normalizeByAvoidPatterns(
      shouldRewriteMain ? buildMainSummary(primarySkill, envelope.languageProfile) : String(block.summary || ""),
      envelope
    ),
    activities,
  };
};

const adaptCooldownBlock = (
  block: PedagogicalPlanBlock,
  envelope: SessionPedagogyEnvelope,
  primarySkill: VolleyballSkill
) => {
  const summary = String(block.summary || "").trim();
  const shouldRewriteSummary =
    activityLooksGeneric(summary) || !hasSkillSignal(summary, primarySkill);

  const activities = (block.activities.length ? block.activities : [{
    id: "cooldown_env_1",
    name: "Roda rápida de fechamento",
    description: "Compartilhar o que ajudou na execução e organizar os materiais da sessão.",
  }]).map((activity, index) => {
    if (index > 0) {
      return {
        ...activity,
        description: normalizeByAvoidPatterns(activity.description, envelope),
      };
    }

    const shouldRewriteDescription =
      activityLooksGeneric(activity.description) || !hasSkillSignal(activity.description, primarySkill);
    const shouldRewriteName =
      activityLooksGeneric(activity.name) || !hasSkillSignal(`${activity.name} ${activity.description}`, primarySkill);
    const guidedPrompt =
      envelope.feedbackStyle === "pergunta_guiada"
        ? `Roda rápida: o que ajudou mais no ${primarySkillLabel[primarySkill]} hoje?`
        : envelope.feedbackStyle === "positivo_curto"
        ? `Fechamento com reforço positivo do ${primarySkillLabel[primarySkill]} e organização leve da turma.`
        : `Reflexão rápida sobre o ${primarySkillLabel[primarySkill]}, respiração leve e fechamento da sessão.`;

    return {
      ...activity,
      name: shouldRewriteName ? "Roda rápida de fechamento" : activity.name,
      description: shouldRewriteDescription
        ? guidedPrompt
        : normalizeByAvoidPatterns(activity.description, envelope),
    };
  });

  return {
    ...block,
    summary: shouldRewriteSummary
      ? buildCooldownSummary(primarySkill, envelope.feedbackStyle, envelope.languageProfile)
      : normalizeByAvoidPatterns(summary, envelope),
    activities,
  };
};

export const resolveSessionPedagogyEnvelope = (
  params: ResolveSessionPedagogyEnvelopeParams
): SessionPedagogyEnvelope => {
  const ageStart = parseAgeBandStart(params.ageBand);
  const isYoungerBand = params.developmentStage === "fundamental" || (ageStart !== null && ageStart <= 11);

  if (isYoungerBand) {
    return {
      tone: params.pedagogicalApproach?.approach === "tradicional" ? "guiado" : "ludico",
      warmupStyle: ["movimento", "coordenação", "bola", "duplas", "brincadeira"],
      mainStyle: ["desafio simples", "alvo", "pares", "repetição curta", "feedback imediato"],
      cooldownStyle: ["roda rápida", "feedback positivo", "respiração leve", "celebração"],
      feedbackStyle: "positivo_curto",
      languageProfile: "infantil",
      avoidPatterns: avoidPatternsDefault,
    };
  }

  if (params.developmentStage === "especializado") {
    return {
      tone: params.objectiveType === "tatico" ? "jogo_aplicado" : "desafio_progressivo",
      warmupStyle: ["mobilidade dinâmica", "ativação específica", "coordenação"],
      mainStyle: ["sequência progressiva", "alvo técnico", "decisão situacional"],
      cooldownStyle: ["síntese curta", "regulação respiratória", "organização"],
      feedbackStyle: "pergunta_guiada",
      languageProfile: "juvenil",
      avoidPatterns: avoidPatternsDefault,
    };
  }

  return {
    tone: "jogo_aplicado",
    warmupStyle: ["ativação específica", "prontidão", "preparação para jogo"],
    mainStyle: ["cenário aplicado", "decisão", "execução sob pressão"],
    cooldownStyle: ["síntese técnica", "recuperação", "organização final"],
    feedbackStyle: params.historyMode === "bootstrap" ? "pergunta_guiada" : "reflexao_rapida",
    languageProfile: "tecnico",
    avoidPatterns: avoidPatternsDefault,
  };
};

export const toSessionPedagogyEnvelopeDiagnostics = (
  envelope: SessionPedagogyEnvelope
): SessionPedagogyEnvelopeDiagnostics => ({
  tone: envelope.tone,
  languageProfile: envelope.languageProfile,
  feedbackStyle: envelope.feedbackStyle,
  mainStyle: envelope.mainStyle.slice(0, 3),
  cooldownStyle: envelope.cooldownStyle.slice(0, 2),
});

export const applySessionPedagogyEnvelope = (
  params: ApplySessionPedagogyEnvelopeParams
): PedagogicalPlanPackage => {
  const nextDraftMain = adaptMainBlock(
    params.plan.draft.main,
    params.envelope,
    params.primarySkill,
    params.secondarySkill
  );
  const nextGeneratedMain = adaptMainBlock(
    params.plan.generated.main,
    params.envelope,
    params.primarySkill,
    params.secondarySkill
  );
  const nextFinalMain = adaptMainBlock(
    params.plan.final.main,
    params.envelope,
    params.primarySkill,
    params.secondarySkill
  );

  const nextDraftCooldown = adaptCooldownBlock(
    params.plan.draft.cooldown,
    params.envelope,
    params.primarySkill
  );
  const nextGeneratedCooldown = adaptCooldownBlock(
    params.plan.generated.cooldown,
    params.envelope,
    params.primarySkill
  );
  const nextFinalCooldown = adaptCooldownBlock(
    params.plan.final.cooldown,
    params.envelope,
    params.primarySkill
  );

  return {
    ...params.plan,
    draft: {
      ...params.plan.draft,
      main: nextDraftMain,
      cooldown: nextDraftCooldown,
    },
    generated: {
      ...params.plan.generated,
      main: nextGeneratedMain,
      cooldown: nextGeneratedCooldown,
    },
    final: {
      ...params.plan.final,
      main: nextFinalMain,
      cooldown: nextFinalCooldown,
    },
  };
};
