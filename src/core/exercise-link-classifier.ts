import type { Exercise } from "./models";
import type { TrainingPlanBlockKey } from "./training-plan-blocks";

export type ExerciseLinkClassificationInput = Partial<
  Pick<Exercise, "title" | "description" | "notes" | "source" | "videoUrl" | "tags">
> & {
  publishedAt?: string | null;
  metadataTitle?: string | null;
  metadataDescription?: string | null;
  metadataAuthor?: string | null;
  metadataHost?: string | null;
};

const normalizeText = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const normalizeExerciseLinkTag = (value?: string | null) =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getSearchTokens = (value?: string | null) =>
  normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);

const uniqueTags = (tags: string[]) => {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const normalized = normalizeExerciseLinkTag(tag);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const includesKeyword = (text: string, tokens: Set<string>, keyword: string) => {
  const keywordTokens = getSearchTokens(keyword);
  if (!keywordTokens.length) return false;
  if (keywordTokens.length === 1) return tokens.has(keywordTokens[0]);
  return text.includes(keywordTokens.join(" "));
};

const includesAny = (text: string, keywords: string[]) => {
  const tokens = new Set(getSearchTokens(text));
  return keywords.some((keyword) => includesKeyword(text, tokens, keyword));
};

const inferProviderTag = (input: ExerciseLinkClassificationInput) => {
  const value = normalizeText(`${input.source ?? ""} ${input.metadataHost ?? ""} ${input.videoUrl ?? ""}`);
  if (value.includes("youtube") || value.includes("youtu.be")) return "youtube";
  if (value.includes("instagram")) return "instagram";
  if (value.includes("pinterest")) return "pinterest";
  if (value.includes("vimeo")) return "vimeo";
  return "link";
};

export type ExerciseLinkPresentation = {
  title: string;
  description: string;
  sourceLabel: string;
  tags: string[];
};

const PROVIDER_LABELS: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  pinterest: "Pinterest",
  vimeo: "Vimeo",
  link: "Vídeo/link",
};

const compactWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const stripDisplayNoise = (value?: string | null) =>
  compactWhitespace(
    (value ?? "")
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/#[^\s#]+/g, " ")
      .replace(/@\S+/g, " ")
      .replace(/\b\d+[,.]?\d*\s*[kKmM]?\s+likes?,?\s+\d+[,.]?\d*\s+comments?\s*-\s*/gi, " ")
      .replace(/\b(on|em)\s+[A-Za-zÀ-ÿ]+\s+\d{1,2},?\s+\d{4}:?\s*/gi, " ")
      .replace(/\b(handballcoach|instagram|pinterest|youtube)\b/gi, " ")
      .replace(/\s*["“”]\s*/g, " ")
      .replace(/\s+-\s+$/g, " ")
  );

const limitText = (value: string, maxLength: number) => {
  const compact = compactWhitespace(value);
  if (compact.length <= maxLength) return compact;
  const sliced = compact.slice(0, maxLength).replace(/\s+\S*$/, "");
  return `${sliced.trim()}...`;
};

const isNoisyDisplayText = (value?: string | null) => {
  const raw = value ?? "";
  const normalized = normalizeText(raw);
  return (
    /https?:\/\/|www\.|[#@]/i.test(raw) ||
    normalized.includes(" instagram") ||
    normalized.includes(" on instagram") ||
    normalized.includes("pinterest") ||
    normalized.includes("youtube") ||
    normalized.includes(" likes") ||
    normalized.includes(" comments") ||
    normalized.includes("encontre e salve") ||
    normalized.includes("seus proprios pins") ||
    normalized.startsWith("pin em ") ||
    normalized.startsWith("pin on ")
  );
};

const isLikelyForeignExerciseText = (value?: string | null) => {
  const normalized = normalizeText(value);
  return (
    normalized.includes("korperspannung") ||
    normalized.includes("kraft") ||
    normalized.includes("zweier") ||
    normalized.includes("muskel") ||
    normalized.includes("kurzes") ||
    normalized.includes(" ziel")
  );
};

const shouldUseCleanDisplayTitle = (rawTitle?: string | null, cleanedTitle?: string | null) =>
  Boolean(
    cleanedTitle &&
      cleanedTitle.length <= 72 &&
      !isNoisyDisplayText(rawTitle) &&
      !isLikelyForeignExerciseText(cleanedTitle)
  );

const shouldUseCleanDisplayDescription = (
  rawDescription?: string | null,
  cleanedDescription?: string | null
) =>
  Boolean(
    cleanedDescription &&
      cleanedDescription.length >= 18 &&
      !isNoisyDisplayText(rawDescription) &&
      !isLikelyForeignExerciseText(cleanedDescription)
  );

const getProviderFallbackTitle = (providerTag: string, sourceLabel: string) => {
  if (providerTag === "instagram") return "Referência do Instagram";
  if (providerTag === "pinterest") return "Referência do Pinterest";
  if (providerTag === "youtube") return "Referência do YouTube";
  if (sourceLabel && sourceLabel !== "Vídeo/link") return `Referência do ${sourceLabel}`;
  return "Vídeo/link";
};

const getProviderFallbackDescription = (providerTag: string) => {
  if (providerTag === "instagram" || providerTag === "pinterest") {
    return "Link salvo para consulta e uso no planejamento.";
  }
  return "Referência salva para consulta e uso no planejamento.";
};

const hasTag = (tags: Set<string>, tag: string) => tags.has(tag);

const getRuleBasedPresentation = (tags: Set<string>) => {
  if (hasTag(tags, "queimada") && hasTag(tags, "duplas")) {
    return {
      title: "Queimada reativa em duplas",
      description: "Jogo de queimada com proteção em duplas, reação e tomada de decisão.",
    };
  }
  if (hasTag(tags, "queimada")) {
    return {
      title: "Queimada reativa",
      description: "Jogo de oposição simples para reação, deslocamento e tomada de decisão.",
    };
  }
  if (hasTag(tags, "forca") && hasTag(tags, "core") && hasTag(tags, "duplas")) {
    return {
      title: "Força e core em duplas",
      description: "Fortalecimento em duplas para controle corporal e grandes grupos musculares.",
    };
  }
  if (hasTag(tags, "forca") && hasTag(tags, "duplas")) {
    return {
      title: "Fortalecimento em duplas",
      description: "Tarefa em dupla para força geral e controle corporal.",
    };
  }
  if (hasTag(tags, "forca") && hasTag(tags, "core")) {
    return {
      title: "Força e core",
      description: "Fortalecimento para estabilidade, postura e controle corporal.",
    };
  }
  if (hasTag(tags, "agilidade")) {
    return {
      title: "Agilidade e velocidade",
      description: "Atividade curta para aceleração, reação e deslocamento.",
    };
  }
  if (hasTag(tags, "mobilidade") && hasTag(tags, "aquecimento")) {
    return {
      title: "Mobilidade para aquecimento",
      description: "Preparação ativa para iniciar a aula com mais mobilidade e prontidão.",
    };
  }
  if (hasTag(tags, "passe") && hasTag(tags, "recepcao")) {
    return {
      title: "Passe e recepção",
      description: "Referência para primeiro contato, controle e continuidade.",
    };
  }
  if (hasTag(tags, "toque") && hasTag(tags, "levantamento")) {
    return {
      title: "Toque e levantamento",
      description: "Referência para segundo contato, organização e precisão.",
    };
  }
  if (hasTag(tags, "saque")) {
    return {
      title: "Saque",
      description: "Referência para saque, alvo e controle de direção.",
    };
  }
  if (hasTag(tags, "ataque")) {
    return {
      title: "Ataque",
      description: "Referência para finalização e tomada de decisão ofensiva.",
    };
  }
  if (hasTag(tags, "bloqueio")) {
    return {
      title: "Bloqueio",
      description: "Referência para leitura de rede, tempo e cobertura.",
    };
  }
  if (hasTag(tags, "defesa") && hasTag(tags, "transicao")) {
    return {
      title: "Defesa e transição",
      description: "Referência para salvar a bola e reorganizar o ataque.",
    };
  }
  if (hasTag(tags, "defesa")) {
    return {
      title: "Defesa",
      description: "Referência para controle defensivo e continuidade.",
    };
  }
  if (hasTag(tags, "transicao")) {
    return {
      title: "Transição",
      description: "Referência para reorganizar a jogada depois da primeira ação.",
    };
  }
  if (hasTag(tags, "aquecimento")) {
    return {
      title: "Aquecimento ativo",
      description: "Atividade simples para preparar a turma antes da parte principal.",
    };
  }
  if (hasTag(tags, "volta-calma")) {
    return {
      title: "Volta à calma",
      description: "Atividade leve para encerrar a aula com controle e recuperação.",
    };
  }
  return null;
};

const TAG_RULES: ReadonlyArray<{ tag: string; keywords: string[] }> = [
  {
    tag: "aquecimento",
    keywords: ["aquecimento", "warmup", "warm up", "activation", "ativacao", "pre treino", "pre-treino", "prep"],
  },
  {
    tag: "volta-calma",
    keywords: ["volta a calma", "volta à calma", "cooldown", "cool down", "relaxamento", "alongamento", "stretch"],
  },
  {
    tag: "jogo-aplicacao",
    keywords: [
      "jogo",
      "jogos",
      "jogo aplicado",
      "aplicacao",
      "aplicação",
      "small sided",
      "jogo reduzido",
      "mini jogo",
      "rally",
      "sideout",
      "side-out",
      "game",
    ],
  },
  {
    tag: "drill",
    keywords: ["drill", "exercicio", "exercício", "progressao", "progressão", "tarefa", "atividade"],
  },
  {
    tag: "passe",
    keywords: ["passe", "passing", "pass", "manchete", "recepcao", "recepção", "reception", "receive", "primeiro contato", "first contact"],
  },
  {
    tag: "recepcao",
    keywords: ["manchete", "recepcao", "recepção", "reception", "receive", "sideout", "side-out", "primeiro contato", "first contact"],
  },
  {
    tag: "toque",
    keywords: ["toque", "toques"],
  },
  {
    tag: "levantamento",
    keywords: ["toque", "levantamento", "levantador", "setting", "setter", "segundo contato", "second contact"],
  },
  {
    tag: "saque",
    keywords: ["saque", "servico", "serviço", "serve", "serving"],
  },
  {
    tag: "ataque",
    keywords: ["ataque", "attack", "spike", "cortada", "finalizacao", "finalização", "hitting"],
  },
  {
    tag: "bloqueio",
    keywords: ["bloqueio", "block", "blocking"],
  },
  {
    tag: "defesa",
    keywords: [
      "defesa",
      "defense",
      "dig",
      "cobertura",
      "coverage",
      "salvar bola",
      "defensor",
      "protecao",
      "proteção",
      "proteger",
      "interceptar",
    ],
  },
  {
    tag: "transicao",
    keywords: ["transicao", "transição", "transition", "contra ataque", "contra-ataque", "fora do sistema", "out of system", "out-of-system"],
  },
  {
    tag: "forca",
    keywords: [
      "forca",
      "força",
      "strength",
      "strengthtraining",
      "strenghttraining",
      "fortalecimento",
      "resistencia",
      "resistência",
      "krafttraining",
      "kraftigen",
      "kräftigen",
    ],
  },
  {
    tag: "mobilidade",
    keywords: ["mobilidade", "mobility", "alongamento", "stretch", "flexibilidade"],
  },
  {
    tag: "coordenacao",
    keywords: ["coordenacao", "coordenação", "coordination", "motora", "motor"],
  },
  {
    tag: "agilidade",
    keywords: ["agilidade", "agility", "sprint", "velocidade", "speed", "quickness", "reativa", "reacao", "reação"],
  },
  {
    tag: "core",
    keywords: [
      "core",
      "coreworkout",
      "corestrength",
      "coretraining",
      "abdomen",
      "abdominal",
      "prancha",
      "plank",
      "korperspannung",
      "körperspannung",
    ],
  },
  {
    tag: "prevencao",
    keywords: ["prevencao", "prevenção", "prehab", "preventivo", "prevention", "injury prevention"],
  },
  {
    tag: "duplas",
    keywords: ["dupla", "duplas", "2x2", "pair", "partner", "partnerworkout", "zweiergruppe", "zweier"],
  },
  {
    tag: "trios",
    keywords: ["trio", "trios", "3x3"],
  },
  {
    tag: "grupo",
    keywords: ["grupo", "grupos", "equipe", "equipes", "team"],
  },
  {
    tag: "circuito",
    keywords: ["circuito", "circuit", "estacao", "estação", "estacoes", "estações", "station"],
  },
  {
    tag: "jogo-reduzido",
    keywords: ["jogo reduzido", "mini jogo", "small sided", "2x2", "3x3"],
  },
  {
    tag: "queimada",
    keywords: ["queimada", "dodgeball", "corredor", "defensor", "interceptar", "intercepta"],
  },
];

export const MANAGED_EXERCISE_LINK_TAGS = new Set([
  "video-link",
  "youtube",
  "instagram",
  "pinterest",
  "vimeo",
  "link",
  "desenvolvimento",
  ...TAG_RULES.map((rule) => rule.tag),
]);

export const classifyExerciseLink = (input: ExerciseLinkClassificationInput): string[] => {
  const text = normalizeText(
    [
      input.title,
      input.description,
      input.notes,
      input.source,
      input.videoUrl,
      input.publishedAt,
      input.metadataTitle,
      input.metadataDescription,
      input.metadataAuthor,
      input.metadataHost,
    ].join(" ")
  );
  const tags = ["video-link", inferProviderTag(input)];

  TAG_RULES.forEach((rule) => {
    if (includesAny(text, rule.keywords)) {
      tags.push(rule.tag);
    }
  });

  const skillTags = ["passe", "levantamento", "saque", "ataque", "bloqueio", "defesa", "transicao"];
  const phaseTags = ["aquecimento", "desenvolvimento", "jogo-aplicacao", "volta-calma"];
  if (tags.some((tag) => skillTags.includes(tag)) && !tags.some((tag) => phaseTags.includes(tag))) {
    tags.push("desenvolvimento");
  }

  return uniqueTags(tags.map(normalizeExerciseLinkTag));
};

export const getExerciseLinkPresentation = (
  input: ExerciseLinkClassificationInput
): ExerciseLinkPresentation => {
  const tags = mergeInferredExerciseLinkTags(input, input.tags ?? []);
  const tagSet = new Set(tags);
  const providerTag = inferProviderTag(input);
  const sourceLabel =
    input.source?.trim() ||
    input.metadataAuthor?.trim() ||
    input.metadataHost?.trim() ||
    PROVIDER_LABELS[providerTag] ||
    "Vídeo/link";
  const ruleBased = getRuleBasedPresentation(tagSet);
  const cleanedTitle = stripDisplayNoise(input.title || input.metadataTitle);
  const cleanedDescription = stripDisplayNoise(
    input.description || input.metadataDescription || input.notes
  );
  const rawTitle = input.title || input.metadataTitle;
  const rawDescription = input.description || input.metadataDescription || input.notes;
  const useCleanTitle = shouldUseCleanDisplayTitle(rawTitle, cleanedTitle);
  const useCleanDescription = shouldUseCleanDisplayDescription(
    rawDescription,
    cleanedDescription
  );
  const preferRuleTitle = hasTag(tagSet, "queimada");

  if (ruleBased) {
    return {
      ...ruleBased,
      title: useCleanTitle && !preferRuleTitle ? limitText(cleanedTitle, 72) : ruleBased.title,
      sourceLabel,
      tags,
    };
  }

  const fallbackTitle = useCleanTitle
    ? cleanedTitle
    : getProviderFallbackTitle(providerTag, sourceLabel);
  const fallbackDescription = useCleanDescription
    ? cleanedDescription
    : getProviderFallbackDescription(providerTag);

  return {
    title: limitText(fallbackTitle, 72),
    description: limitText(fallbackDescription, 120),
    sourceLabel,
    tags,
  };
};

export const mergeInferredExerciseLinkTags = (
  input: ExerciseLinkClassificationInput,
  existingTags: string[] = []
) => {
  const customTags = existingTags
    .map(normalizeExerciseLinkTag)
    .filter((tag) => tag && !MANAGED_EXERCISE_LINK_TAGS.has(tag));
  return uniqueTags([...customTags, ...classifyExerciseLink(input)]);
};

export const getExerciseLinkSearchTags = (exercise: Exercise) =>
  mergeInferredExerciseLinkTags(exercise, exercise.tags ?? []);

export const shouldRefreshExerciseLinkMetadata = (
  input: ExerciseLinkClassificationInput
) => {
  const providerTag = inferProviderTag(input);
  if (!input.videoUrl?.trim()) return false;
  if (providerTag === "instagram" || providerTag === "pinterest") return true;
  return (
    isNoisyDisplayText(input.title) ||
    isNoisyDisplayText(input.description) ||
    isLikelyForeignExerciseText(input.title) ||
    isLikelyForeignExerciseText(input.description) ||
    !stripDisplayNoise(input.title).trim() ||
    !stripDisplayNoise(input.description).trim()
  );
};

const buildSearchText = (input: ExerciseLinkClassificationInput) =>
  normalizeText(
    [
      input.title,
      input.description,
      input.notes,
      input.source,
      input.videoUrl,
      input.publishedAt,
      input.metadataTitle,
      input.metadataDescription,
      input.metadataAuthor,
      input.metadataHost,
    ].join(" ")
  );

export const matchesExerciseLinkSearch = (
  input: ExerciseLinkClassificationInput,
  query: string
) => {
  const queryTokens = getSearchTokens(query);
  if (!queryTokens.length) return true;

  const queryTag = normalizeExerciseLinkTag(query);
  const tags = new Set(mergeInferredExerciseLinkTags(input, input.tags ?? []));
  if (queryTag && tags.has(queryTag)) return true;

  const text = buildSearchText(input);
  const tokens = new Set(getSearchTokens(text));
  if (queryTokens.length === 1) {
    const [token] = queryTokens;
    if (tokens.has(token)) return true;
    return token.length > 4 && text.includes(token);
  }

  return queryTokens.every((token) => tokens.has(token)) || text.includes(queryTokens.join(" "));
};

export const EXERCISE_LINK_PRIORITY_TAGS_BY_BLOCK: Record<TrainingPlanBlockKey, string[]> = {
  warmup: ["aquecimento", "mobilidade", "coordenacao", "agilidade", "prevencao", "forca"],
  main: [
    "desenvolvimento",
    "jogo-aplicacao",
    "drill",
    "passe",
    "toque",
    "levantamento",
    "saque",
    "ataque",
    "bloqueio",
    "defesa",
    "transicao",
    "recepcao",
    "jogo-reduzido",
  ],
  cooldown: ["volta-calma", "mobilidade", "prevencao", "core"],
};

export const scoreExerciseLinkForPlanningBlock = (
  exercise: ExerciseLinkClassificationInput,
  blockKey: TrainingPlanBlockKey
) => {
  const tags = new Set(mergeInferredExerciseLinkTags(exercise, exercise.tags ?? []));
  const priorityTags = EXERCISE_LINK_PRIORITY_TAGS_BY_BLOCK[blockKey];
  return priorityTags.reduce((score, tag, index) => {
    if (!tags.has(tag)) return score;
    return score + priorityTags.length - index;
  }, 0);
};
