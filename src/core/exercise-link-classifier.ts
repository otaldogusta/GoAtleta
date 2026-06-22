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
    keywords: ["jogo aplicado", "aplicacao", "aplicação", "small sided", "jogo reduzido", "mini jogo", "rally", "sideout", "side-out"],
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
    keywords: ["defesa", "defense", "dig", "cobertura", "coverage", "salvar bola"],
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
    keywords: ["agilidade", "agility", "sprint", "velocidade", "speed", "quickness"],
  },
  {
    tag: "core",
    keywords: ["core", "coreworkout", "corestrength", "coretraining", "abdomen", "abdominal", "prancha", "plank"],
  },
  {
    tag: "prevencao",
    keywords: ["prevencao", "prevenção", "prehab", "preventivo", "prevention", "injury prevention"],
  },
  {
    tag: "duplas",
    keywords: ["dupla", "duplas", "2x2", "pair", "partner"],
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
  exercise: Exercise,
  blockKey: TrainingPlanBlockKey
) => {
  const tags = new Set(getExerciseLinkSearchTags(exercise));
  const priorityTags = EXERCISE_LINK_PRIORITY_TAGS_BY_BLOCK[blockKey];
  return priorityTags.reduce((score, tag, index) => {
    if (!tags.has(tag)) return score;
    return score + priorityTags.length - index;
  }, 0);
};
