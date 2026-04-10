export type PedagogicalApproach = "tradicional" | "cognitivista" | "sociocultural" | "hibrido";

export type PedagogicalLearnerRole = "executar" | "pensar" | "interagir" | "misto";

export type PedagogicalIntent =
  | "reproducao"
  | "resolucao_problemas"
  | "colaboracao"
  | "misto";

type ApproachBucket = Exclude<PedagogicalApproach, "hibrido">;
type RoleBucket = Exclude<PedagogicalLearnerRole, "misto">;
type IntentBucket = Exclude<PedagogicalIntent, "misto">;
type TraditionalConductionRisk = "baixo" | "medio" | "alto";
type SignalLayer = "verbo-base" | "complemento-intencao" | "papel-aluno";
type PredominanceLevel = "fraca" | "moderada" | "alta";

type DetectionSignal = {
  pattern: RegExp;
  layer: SignalLayer;
  approach: ApproachBucket;
  weight: number;
  reason: string;
  tag?: string;
  role?: RoleBucket;
  intent?: IntentBucket;
};

export type PedagogicalApproachDetection = {
  hasObjectiveText: boolean;
  approach: PedagogicalApproach;
  label: string;
  confidence: "baixa" | "media" | "alta";
  profileLabel: string;
  predominanceLevel: PredominanceLevel;
  predominanceLabel: string;
  learnerRole: PedagogicalLearnerRole;
  learnerRoleLabel: string;
  primaryIntent: PedagogicalIntent;
  primaryIntentLabel: string;
  secondaryApproaches: ApproachBucket[];
  secondaryLabels: string[];
  traditionalConductionRisk: TraditionalConductionRisk;
  summary: string;
  reasons: string[];
  tags: string[];
  scores: Record<ApproachBucket, number>;
};

type PedagogicalApproachOverlay = {
  tags: string[];
  tips: string[];
  promptFragment: string;
};

const APPROACH_LABELS: Record<PedagogicalApproach, string> = {
  tradicional: "Tradicional",
  cognitivista: "Cognitivista",
  sociocultural: "Sociocultural",
  hibrido: "Híbrido",
};

const ROLE_LABELS: Record<PedagogicalLearnerRole, string> = {
  executar: "executar com critério",
  pensar: "pensar e decidir",
  interagir: "interagir em grupo",
  misto: "alternar execução, reflexão e interação",
};

const INTENT_LABELS: Record<PedagogicalIntent, string> = {
  reproducao: "reprodução orientada",
  resolucao_problemas: "resolucao de problemas",
  colaboracao: "construção coletiva",
  misto: "intenção combinada",
};

const APPROACH_SUMMARIES: Record<PedagogicalApproach, string> = {
  tradicional: "O objetivo pede reprodução orientada e estabilidade técnica observável.",
  cognitivista: "O objetivo pede leitura de contexto, autonomia e escolha de solução.",
  sociocultural: "O objetivo pede interação, negociação e construção coletiva da resposta.",
  hibrido: "O objetivo mistura execução, reflexão e colaboração sem um eixo único dominante.",
};

const APPROACH_TIPS: Record<PedagogicalApproach, string[]> = {
  tradicional: [
    "Defina o padrão técnico-alvo antes da repetição e mostre o critério de qualidade.",
    "Use feedback corretivo curto, direto e observável durante a execução.",
  ],
  cognitivista: [
    "Crie variações de contexto para o aluno decidir como resolver a tarefa.",
    "Pergunte o porquê da escolha antes de corrigir a resposta final.",
  ],
  sociocultural: [
    "Estruture duplas ou grupos com papéis claros e troca curta de argumentos.",
    "Use discussão guiada para construir critérios coletivos da ação.",
  ],
  hibrido: [
    "Combine demonstração curta com problema contextualizado e momento de troca entre pares.",
    "Não deixe o verbo do objetivo ditar sozinho a condução da atividade.",
  ],
};

const PREDOMINANCE_LABELS: Record<PredominanceLevel, string> = {
  fraca: "Predominância fraca",
  moderada: "Predominância moderada",
  alta: "Predominância alta",
};

const SIGNAL_LAYER_LABELS: Record<SignalLayer, string> = {
  "verbo-base": "verbo-base",
  "complemento-intencao": "intencao e complemento",
  "papel-aluno": "papel do aluno",
};

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const unique = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(value.trim());
  });
  return result;
};

const APPROACH_SIGNALS: DetectionSignal[] = [
  {
    layer: "verbo-base",
    pattern: /\b(executar|repetir|reproduzir|automatizar|memorizar|fixar|praticar|treinar|corrigir|aperfeicoar)\b/,
    approach: "tradicional",
    weight: 1,
    reason: "Verbo com foco em execucao ou reproducao.",
    tag: "execucao-orientada",
    role: "executar",
    intent: "reproducao",
  },
  {
    layer: "complemento-intencao",
    pattern: /\b(corretamente|tecnica correta|gesto tecnico|padrao tecnico|sem erro|modelo|demonstracao|mecanica|reproducao padronizada|sequencia correta|roteiro correto)\b/,
    approach: "tradicional",
    weight: 4,
    reason: "Complemento reforca fidelidade tecnica e padrao observavel.",
    tag: "padrao-tecnico",
    role: "executar",
    intent: "reproducao",
  },
  {
    layer: "complemento-intencao",
    pattern: /\b(repetic(?:ao|oes)|series?|fundamento|precisao|controle tecnico|estabilidade)\b/,
    approach: "tradicional",
    weight: 3,
    reason: "Tarefa centrada em consolidacao tecnica por repeticao.",
    tag: "repeticao-estruturada",
    role: "executar",
    intent: "reproducao",
  },
  {
    layer: "verbo-base",
    pattern: /\b(analisar|resolver|identificar|comparar|decidir|escolher|interpretar|adaptar|ajustar|experimentar|explorar|descobrir|criar|avaliar|perceber|ler)\b/,
    approach: "cognitivista",
    weight: 1,
    reason: "Verbo aponta para processamento, escolha ou analise.",
    tag: "tomada-de-decisao",
    role: "pensar",
    intent: "resolucao_problemas",
  },
  {
    layer: "complemento-intencao",
    pattern: /\b(autonomia|autonomo|independente|de forma independente|por conta propria|sem ajuda|sem ajuda direta)\b/,
    approach: "cognitivista",
    weight: 6,
    reason: "Complemento desloca o foco para autonomia do aluno.",
    tag: "autonomia",
    role: "pensar",
    intent: "resolucao_problemas",
  },
  {
    layer: "complemento-intencao",
    pattern: /\b(situac(?:ao|oes)|contexto|problema|cenario|variac(?:ao|oes)|oposic(?:ao|oes)|leitura(?: de jogo)?|tomada de decis(?:ao|oes)|estrateg(?:ia|ias)|solucao|resolvendo)\b/,
    approach: "cognitivista",
    weight: 5,
    reason: "O complemento exige leitura de situacao e adaptacao da resposta.",
    tag: "leitura-de-contexto",
    role: "pensar",
    intent: "resolucao_problemas",
  },
  {
    layer: "papel-aluno",
    pattern: /\b(testar diferentes formas|investigar|justificar|explicar a escolha|explicar por que|decidir a mais eficaz|avaliar a mais eficaz|formular|hipotetizar|propor)\b/,
    approach: "cognitivista",
    weight: 7,
    reason: "O papel do aluno e investigar, justificar e comparar solucoes.",
    tag: "investigacao-autonoma",
    role: "pensar",
    intent: "resolucao_problemas",
  },
  {
    pattern: /\b(discutir|negociar|compartilhar|cooperar|colaborar|dialogar|comunicar|liderar|argumentar)\b/,
    layer: "verbo-base",
    approach: "sociocultural",
    weight: 2,
    reason: "A acao depende de troca social e construcao compartilhada.",
    tag: "interacao-social",
    role: "interagir",
    intent: "colaboracao",
  },
  {
    layer: "complemento-intencao",
    pattern: /\b(grupo|equipe|dupla|trio|pares|colegas?|coletivo|em conjunto|junto|juntos)\b/,
    approach: "sociocultural",
    weight: 5,
    reason: "O complemento posiciona a aprendizagem no coletivo.",
    tag: "grupo",
    role: "interagir",
    intent: "colaboracao",
  },
  {
    layer: "papel-aluno",
    pattern: /\b(consenso|ajuda mutua|troca entre pares|organizacao da equipe|papel coletivo|co-responsabilidade|negociando|construir juntos|escuta coletiva|negociar criterios|avaliar coletivamente)\b/,
    approach: "sociocultural",
    weight: 7,
    reason: "Ha sinal forte de negociacao e organizacao coletiva.",
    tag: "negociacao-coletiva",
    role: "interagir",
    intent: "colaboracao",
  },
  {
    layer: "papel-aluno",
    pattern: /\b(seguir o modelo|copiar o modelo|reproduzir exatamente|obedecer ao comando|executar sem questionar)\b/,
    approach: "tradicional",
    weight: 6,
    reason: "O papel do aluno e reproduzir um modelo pronto com baixa autonomia.",
    tag: "aluno-receptor",
    role: "executar",
    intent: "reproducao",
  },
];

const topKey = <TKey extends string>(scores: Record<TKey, number>): TKey | null => {
  const entries = Object.entries(scores) as Array<[TKey, number]>;
  entries.sort((left, right) => right[1] - left[1]);
  return entries[0]?.[1] ? entries[0][0] : null;
};

const applySignal = (
  text: string,
  signal: DetectionSignal,
  scores: Record<ApproachBucket, number>,
  roleScores: Record<RoleBucket, number>,
  intentScores: Record<IntentBucket, number>,
  reasons: string[],
  tags: string[]
) => {
  if (!signal.pattern.test(text)) return;
  scores[signal.approach] += signal.weight;
  if (signal.role) roleScores[signal.role] += signal.weight;
  if (signal.intent) intentScores[signal.intent] += signal.weight;
  reasons.push(`${SIGNAL_LAYER_LABELS[signal.layer]}: ${signal.reason}`);
  if (signal.tag) tags.push(signal.tag);
};

const resolveSecondaryApproaches = (
  scores: Record<ApproachBucket, number>,
  primary: PedagogicalApproach
) => {
  const entries = (Object.entries(scores) as Array<[ApproachBucket, number]>)
    .filter(([approach, score]) => score > 0 && approach !== primary)
    .sort((left, right) => right[1] - left[1]);

  return entries
    .filter(([, score], index) => index === 0 || score >= 4)
    .slice(0, 2)
    .map(([approach]) => approach);
};

const resolveTraditionalConductionRisk = (
  scores: Record<ApproachBucket, number>,
  primary: PedagogicalApproach
): TraditionalConductionRisk => {
  const strongest = Math.max(scores.tradicional, scores.cognitivista, scores.sociocultural, 1);
  const ratio = scores.tradicional / strongest;

  if (primary === "tradicional") {
    return scores.tradicional >= 7 ? "alto" : "medio";
  }
  if (ratio >= 0.8) return "alto";
  if (ratio >= 0.45) return "medio";
  return "baixo";
};

const resolvePredominanceLevel = (topScore: number, secondScore: number): PredominanceLevel => {
  const diff = topScore - secondScore;
  if (topScore >= 9 && diff >= 4) return "alta";
  if (topScore >= 6 && diff >= 2) return "moderada";
  return "fraca";
};

const detectConfidence = (topScore: number, secondScore: number) => {
  const diff = topScore - secondScore;
  if (topScore >= 8 && diff >= 3) return "alta" as const;
  if (topScore >= 5 && diff >= 2) return "media" as const;
  return "baixa" as const;
};

const shouldUseHybrid = (topScore: number, secondScore: number) => {
  if (topScore <= 0) return true;
  if (topScore - secondScore <= 1) return true;
  if (secondScore >= 5 && secondScore >= topScore - 1) return true;
  return false;
};

export const detectPedagogicalApproach = (
  objectiveHint: string | null | undefined
): PedagogicalApproachDetection => {
  const text = normalizeText(objectiveHint);
  const scores: Record<ApproachBucket, number> = {
    tradicional: 0,
    cognitivista: 0,
    sociocultural: 0,
  };
  const roleScores: Record<RoleBucket, number> = {
    executar: 0,
    pensar: 0,
    interagir: 0,
  };
  const intentScores: Record<IntentBucket, number> = {
    reproducao: 0,
    resolucao_problemas: 0,
    colaboracao: 0,
  };
  const reasons: string[] = [];
  const tags: string[] = [];

  if (!text) {
    return {
      hasObjectiveText: false,
      approach: "hibrido",
      label: APPROACH_LABELS.hibrido,
      confidence: "baixa",
      profileLabel: "Perfil predominante indefinido",
      predominanceLevel: "fraca",
      predominanceLabel: PREDOMINANCE_LABELS.fraca,
      learnerRole: "misto",
      learnerRoleLabel: ROLE_LABELS.misto,
      primaryIntent: "misto",
      primaryIntentLabel: INTENT_LABELS.misto,
      secondaryApproaches: [],
      secondaryLabels: [],
      traditionalConductionRisk: "baixo",
      summary: "Sem objetivo textual suficiente para inferir abordagem com seguranca.",
      reasons: [],
      tags: [],
      scores,
    };
  }

  APPROACH_SIGNALS.forEach((signal) => {
    applySignal(text, signal, scores, roleScores, intentScores, reasons, tags);
  });

  if (/\bmemorizar\b/.test(text) && /\b(independente|autonomia|autonomo)\b/.test(text)) {
    scores.cognitivista += 6;
    roleScores.pensar += 6;
    intentScores.resolucao_problemas += 6;
    reasons.push("A autonomia do aluno pesa mais do que o verbo memorizar.");
    tags.push("autonomia-acima-do-verbo");
  }

  if (/\bexecutar\b/.test(text) && /\b(resolv|situac|context|adapt|decis|variac|jogo)\b/.test(text)) {
    scores.cognitivista += 6;
    roleScores.pensar += 6;
    intentScores.resolucao_problemas += 6;
    reasons.push("O complemento transforma execucao em resolucao contextualizada.");
    tags.push("execucao-contextualizada");
  }

  if (
    /\b(grupo|equipe|dupla|pares|colegas?)\b/.test(text) &&
    /\b(discut|negoci|organiz|resolver|decid|planej|colabor|comunica)\b/.test(text)
  ) {
    scores.sociocultural += 7;
    roleScores.interagir += 7;
    intentScores.colaboracao += 7;
    reasons.push("Grupo + acao conjunta indicam construcao coletiva da tarefa.");
    tags.push("co-construcao");
  }

  const rankedApproaches = (Object.entries(scores) as Array<[ApproachBucket, number]>).sort(
    (left, right) => right[1] - left[1]
  );
  const topApproach = rankedApproaches[0]?.[0] ?? "tradicional";
  const topScore = rankedApproaches[0]?.[1] ?? 0;
  const secondScore = rankedApproaches[1]?.[1] ?? 0;
  const approach: PedagogicalApproach = shouldUseHybrid(topScore, secondScore)
    ? "hibrido"
    : topApproach;
  const confidence = detectConfidence(topScore, secondScore);

  const topRole = topKey(roleScores);
  const topIntent = topKey(intentScores);
  const learnerRole: PedagogicalLearnerRole =
    approach === "hibrido" || !topRole ? "misto" : topRole;
  const primaryIntent: PedagogicalIntent =
    approach === "hibrido" || !topIntent ? "misto" : topIntent;
  const secondaryApproaches = resolveSecondaryApproaches(scores, approach);
  const secondaryLabels = secondaryApproaches.map((item) => APPROACH_LABELS[item]);
  const traditionalConductionRisk = resolveTraditionalConductionRisk(scores, approach);
  const predominanceLevel = resolvePredominanceLevel(topScore, secondScore);
  const profileLabel =
    approach === "hibrido"
      ? "Perfil predominante híbrido"
      : `Perfil predominante ${APPROACH_LABELS[approach].toLowerCase()}`;

  return {
    hasObjectiveText: true,
    approach,
    label: APPROACH_LABELS[approach],
    confidence,
    profileLabel,
    predominanceLevel,
    predominanceLabel: PREDOMINANCE_LABELS[predominanceLevel],
    learnerRole,
    learnerRoleLabel: ROLE_LABELS[learnerRole],
    primaryIntent,
    primaryIntentLabel: INTENT_LABELS[primaryIntent],
    secondaryApproaches,
    secondaryLabels,
    traditionalConductionRisk,
    summary: APPROACH_SUMMARIES[approach],
    reasons: unique(reasons).slice(0, 3),
    tags: unique([
      `abordagem-${approach}`,
      learnerRole === "misto" ? "" : `papel-${learnerRole}`,
      primaryIntent === "misto" ? "" : `intencao-${primaryIntent}`,
      ...tags,
    ]),
    scores,
  };
};

export const buildPedagogicalApproachOverlay = (
  detection: PedagogicalApproachDetection
): PedagogicalApproachOverlay => {
  if (!detection.hasObjectiveText) {
    return {
      tags: [],
      tips: [],
      promptFragment: "",
    };
  }

  const tips = unique([
    ...APPROACH_TIPS[detection.approach],
    ...detection.reasons.map((reason) => `Sinal lido: ${reason}`),
    detection.secondaryLabels.length
      ? `Traços secundários: ${detection.secondaryLabels.join(", ")}.`
      : "",
    `${detection.predominanceLabel}.`,
    `Risco de condução tradicional: ${detection.traditionalConductionRisk}.`,
  ]);

  return {
    tags: detection.tags,
    tips,
    promptFragment: `${detection.profileLabel}. ${detection.predominanceLabel}. Intenção dominante: ${detection.primaryIntentLabel}. Papel do aluno: ${detection.learnerRoleLabel}. ${detection.secondaryLabels.length ? `Traços secundários: ${detection.secondaryLabels.join(", ")}. ` : ""}Risco de condução tradicional: ${detection.traditionalConductionRisk}.`,
  };
};
