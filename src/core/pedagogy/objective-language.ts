export type KnowledgeDimension = "conceitual" | "procedimental" | "atitudinal";

export type LessonType =
  | "introducao"
  | "pratica-guiada"
  | "revisao"
  | "aplicacao"
  | "mini-jogo"
  | "consolidacao"
  | "sociocultural";

export type ResolveLearningObjectivesInput = {
  generalObjective?: string;
  specificObjective?: string;
  title?: string;
  theme?: string;
  technicalFocus?: string;
  weeklyFocus?: string;
  pedagogicalRule?: string;
  pedagogicalApproach?: string;
  sportProfile?: string;
  ageBand?: string;
};

export type ResolveLearningObjectivesResult = {
  generalObjective: string;
  specificObjective: string;
  lessonType: LessonType;
  dimension: KnowledgeDimension;
};

const CONCEPTUAL_VERBS = ["compreender", "identificar", "relacionar", "explicar", "comparar", "interpretar", "analisar"];
const PROCEDURAL_VERBS = ["praticar", "aplicar", "demonstrar", "organizar", "executar", "adaptar", "resolver", "experimentar"];
const ATTITUDINAL_VERBS = ["colaborar", "respeitar", "participar", "cooperar", "responsabilizar-se", "valorizar", "comunicar-se"];

const normalize = (value: string | null | undefined) => String(value ?? "").replace(/\s+/g, " ").trim();

const isYoungAgeBand = (ageBand: string | undefined) => {
  const value = normalize(ageBand).toLowerCase();
  if (!value) return false;

  if (/(sub\s*-?\s*0?9|sub\s*-?\s*1[01]|0?7\s*[-/]\s*0?9|0?8\s*[-/]\s*1[01])/.test(value)) {
    return true;
  }

  const numbers = (value.match(/\d{1,2}/g) ?? [])
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));

  return numbers.some((item) => item >= 7 && item <= 11);
};

const sentence = (value: string) => {
  const cleaned = normalize(value).replace(/[.;,\s]+$/, "");
  return cleaned ? cleaned.charAt(0).toLowerCase() + cleaned.slice(1) : "";
};

const KNOWN_FUNDAMENTALS = [
  "toque",
  "passe",
  "manchete",
  "levantamento",
  "saque",
  "ataque",
  "bloqueio",
  "defesa",
  "recepcao",
  "recepção",
  "transicao",
  "transição",
];

const formatListPtBr = (items: string[]) => {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
};

const polishPtBrText = (value: string) =>
  value
    .replace(/\bde os\b/gi, "dos")
    .replace(/\bde as\b/gi, "das")
    .replace(/\bde o\b/gi, "do")
    .replace(/\bde a\b/gi, "da")
    .replace(/\bem os\b/gi, "nos")
    .replace(/\bem as\b/gi, "nas")
    .replace(/\bem o\b/gi, "no")
    .replace(/\bem a\b/gi, "na")
    .replace(/\ba os\b/gi, "aos")
    .replace(/\ba as\b/gi, "as")
    .replace(/\s+/g, " ")
    .trim();

const extractFundamentals = (value: string) => {
  const text = sentence(value);
  const found: Array<{ term: string; index: number }> = [];
  const seen = new Set<string>();

  for (const term of KNOWN_FUNDAMENTALS) {
    const idx = text.indexOf(term);
    if (idx >= 0) {
      const canonical = term
        .replace("recepção", "recepcao")
        .replace("transição", "transicao");
      if (!seen.has(canonical)) {
        seen.add(canonical);
        found.push({ term: canonical, index: idx });
      }
    }
  }

  return found.sort((a, b) => a.index - b.index).map((item) => item.term);
};

const formatContentWithFundamentals = (value: string) => {
  const fundamentals = extractFundamentals(value);
  if (fundamentals.length < 2) return sentence(value);

  const formatted = formatListPtBr(fundamentals);
  if (/fundamentos?/i.test(value)) {
    return `os fundamentos de ${formatted}`;
  }
  return formatted;
};

const pickContent = (input: ResolveLearningObjectivesInput) => {
  const raw = normalize(input.weeklyFocus || input.technicalFocus || input.theme || input.title);
  if (!raw) return "os conteudos tecnico-taticos da modalidade";

  const withoutParenthesis = raw.replace(/\(([^)]+)\)/g, " $1 ").replace(/\s+/g, " ").trim();
  const lowered = formatContentWithFundamentals(withoutParenthesis);

  if (/^os |^as |^o |^a /i.test(lowered)) return lowered;
  if (/fundamentos?/i.test(lowered)) return lowered;
  if (/jogo|tecnica|habilidade|movimento|controle|cooperacao|participacao/i.test(lowered)) return lowered;
  return `os fundamentos de ${lowered}`;
};

const detectLessonType = (input: ResolveLearningObjectivesInput): LessonType => {
  const text = normalize([
    input.title,
    input.theme,
    input.weeklyFocus,
    input.technicalFocus,
    input.pedagogicalRule,
    input.pedagogicalApproach,
  ].join(" ")).toLowerCase();

  if (/(sociocultural|cultura|participacao|cooperacao|inclus|conviv|respeito|cidadania)/i.test(text)) return "sociocultural";
  if (/(mini jogo|jogo reduzido|jogo curto|situacao de jogo)/i.test(text)) return "mini-jogo";
  if (/(introdu|inic|primeiro contato|explorar|reconhecer)/i.test(text)) return "introducao";
  if (/(revis|retom|recap|recuper)/i.test(text)) return "revisao";
  if (/(aplic|transfer|integr)/i.test(text)) return "aplicacao";
  if (/(consolid|autonomia|fixa|estabiliz)/i.test(text)) return "consolidacao";
  return "pratica-guiada";
};

const detectDimension = (input: ResolveLearningObjectivesInput): KnowledgeDimension => {
  const text = normalize([
    input.generalObjective,
    input.specificObjective,
    input.title,
    input.theme,
    input.weeklyFocus,
    input.pedagogicalRule,
    input.pedagogicalApproach,
  ].join(" ")).toLowerCase();

  if (/(humanist|sociocultural|cooper|respeit|particip|atitud|conviv|responsab|valor)/i.test(text)) return "atitudinal";
  if (/(cognitiv|compreend|analis|interpret|conceit|estrateg|relacion)/i.test(text)) return "conceitual";
  return "procedimental";
};

const chooseVerbFromDimension = (dimension: KnowledgeDimension, fallback: string) => {
  if (dimension === "conceitual") return CONCEPTUAL_VERBS[0];
  if (dimension === "atitudinal") return ATTITUDINAL_VERBS[0];
  if (PROCEDURAL_VERBS.includes(fallback)) return fallback;
  return PROCEDURAL_VERBS[0];
};

const lessonGeneralVerbOptions: Record<LessonType, string[]> = {
  "introducao": ["introduzir", "reconhecer", "explorar"],
  "pratica-guiada": ["desenvolver", "fortalecer", "aprimorar"],
  "revisao": ["revisar", "retomar", "consolidar"],
  "aplicacao": ["aplicar", "ampliar", "integrar"],
  "mini-jogo": ["ampliar", "organizar", "aplicar"],
  "consolidacao": ["consolidar", "fortalecer", "aprimorar"],
  "sociocultural": ["problematizar", "relacionar", "valorizar"],
};

const lessonSpecificVerbOptions: Record<LessonType, string[]> = {
  "introducao": ["experimentar", "vivenciar", "reconhecer"],
  "pratica-guiada": ["praticar", "executar", "ajustar"],
  "revisao": ["praticar", "ajustar", "demonstrar"],
  "aplicacao": ["utilizar", "resolver", "organizar"],
  "mini-jogo": ["aplicar", "cooperar", "decidir"],
  "consolidacao": ["demonstrar", "colaborar", "participar"],
  "sociocultural": ["adaptar", "participar", "respeitar"],
};

const pickGeneralVerb = (lessonType: LessonType) => lessonGeneralVerbOptions[lessonType][0];

const pickSpecificVerb = (
  lessonType: LessonType,
  dimension: KnowledgeDimension,
  generalVerb: string
) => {
  const lessonCandidates = lessonSpecificVerbOptions[lessonType];
  const dimensionCandidates =
    dimension === "conceitual"
      ? CONCEPTUAL_VERBS
      : dimension === "atitudinal"
        ? ATTITUDINAL_VERBS
        : PROCEDURAL_VERBS;

  const merged = [...lessonCandidates, ...dimensionCandidates];
  const chosen = merged.find((verb) => verb !== generalVerb);
  return chosen ?? lessonCandidates[0];
};

const generalVerbByLessonType: Record<LessonType, string> = {
  "introducao": "introduzir",
  "pratica-guiada": "fortalecer",
  "revisao": "revisar",
  "aplicacao": "aplicar",
  "mini-jogo": "ampliar",
  "consolidacao": "consolidar",
  "sociocultural": "problematizar",
};

const specificVerbByLessonType: Record<LessonType, string> = {
  "introducao": "experimentar",
  "pratica-guiada": "praticar",
  "revisao": "praticar",
  "aplicacao": "utilizar",
  "mini-jogo": "aplicar",
  "consolidacao": "demonstrar",
  "sociocultural": "adaptar",
};

const isTooGenericGeneral = (value: string) =>
  /desenvolver\s+.+progress(iva|ivas|ivo|ivos)|progress(oes|oes pedag)/i.test(value) ||
  /progress(oes|oes pedagogicas aplicadas)/i.test(value);

const isListLikeSpecific = (value: string) => {
  const cleaned = normalize(value);
  if (!cleaned) return true;
  if (/^(praticar|aplicar|demonstrar|organizar|resolver|adaptar|experimentar|colaborar|respeitar|participar|utilizar)\b/i.test(cleaned)) {
    return false;
  }
  return /,|\be\b/.test(cleaned) && !/[.!?]/.test(cleaned);
};

const buildGeneralObjective = (
  lessonType: LessonType,
  dimension: KnowledgeDimension,
  content: string,
  youngAgeBand: boolean
) => {
  const resolvedVerb = pickGeneralVerb(lessonType);

  if (youngAgeBand) {
    if (lessonType === "introducao") {
      return polishPtBrText(`Introduzir ${content} com atividades curtas, simples e em pequenos grupos.`);
    }
    if (lessonType === "mini-jogo") {
      return polishPtBrText(`Aplicar ${content} em mini jogos curtos com regras simples e apoio do professor.`);
    }
    return polishPtBrText(`${resolvedVerb.charAt(0).toUpperCase() + resolvedVerb.slice(1)} ${content} com propostas progressivas e linguagem simples.`);
  }

  if (lessonType === "introducao") {
    return polishPtBrText(`${resolvedVerb.charAt(0).toUpperCase() + resolvedVerb.slice(1)} ${content} por meio de atividades simples e progressivas.`);
  }
  if (lessonType === "revisao") {
    return polishPtBrText(`${resolvedVerb.charAt(0).toUpperCase() + resolvedVerb.slice(1)} ${content} em atividades progressivas e situacoes simples de jogo.`);
  }
  if (lessonType === "aplicacao") {
    return polishPtBrText(`${resolvedVerb.charAt(0).toUpperCase() + resolvedVerb.slice(1)} ${content} em situacoes simples de jogo.`);
  }
  if (lessonType === "consolidacao") {
    return polishPtBrText(`${resolvedVerb.charAt(0).toUpperCase() + resolvedVerb.slice(1)} ${content}, favorecendo maior autonomia durante as atividades.`);
  }
  if (lessonType === "mini-jogo") {
    return polishPtBrText(`${resolvedVerb.charAt(0).toUpperCase() + resolvedVerb.slice(1)} a aplicacao de ${content} em jogos reduzidos e situacoes de decisao.`);
  }
  if (lessonType === "sociocultural") {
    return polishPtBrText(`Problematizar a participacao e a cooperacao nas praticas corporais, relacionando ${content} as experiencias da turma.`);
  }
  return polishPtBrText(`${resolvedVerb.charAt(0).toUpperCase() + resolvedVerb.slice(1)} ${content} em atividades guiadas e progressivas.`);
};

const buildSpecificObjective = (
  lessonType: LessonType,
  dimension: KnowledgeDimension,
  content: string,
  youngAgeBand: boolean
) => {
  const resolvedVerb = pickSpecificVerb(lessonType, dimension, pickGeneralVerb(lessonType));

  if (youngAgeBand) {
    if (lessonType === "introducao") {
      return polishPtBrText(`Experimentar ${content} em duplas e trios, buscando controle da bola e participacao de toda a turma.`);
    }
    if (lessonType === "mini-jogo") {
      return polishPtBrText(`Aplicar ${content} em jogos curtos, com mudancas simples de regra e cooperacao entre colegas.`);
    }
    return polishPtBrText(`${resolvedVerb.charAt(0).toUpperCase() + resolvedVerb.slice(1)} ${content} com orientacoes curtas, repeticao guiada e desafios simples.`);
  }

  if (lessonType === "introducao") {
    return polishPtBrText(`${resolvedVerb.charAt(0).toUpperCase() + resolvedVerb.slice(1)} movimentos iniciais de ${content}, buscando controle e participacao nas atividades em grupo.`);
  }
  if (lessonType === "revisao") {
    return polishPtBrText(`${resolvedVerb.charAt(0).toUpperCase() + resolvedVerb.slice(1)} ${content} com mais controle, corrigindo movimentos durante tarefas em dupla ou grupo.`);
  }
  if (lessonType === "aplicacao") {
    return polishPtBrText(`${resolvedVerb.charAt(0).toUpperCase() + resolvedVerb.slice(1)} ${content} durante jogos reduzidos, escolhendo melhor como agir em cada situacao.`);
  }
  if (lessonType === "consolidacao") {
    return polishPtBrText(`${resolvedVerb.charAt(0).toUpperCase() + resolvedVerb.slice(1)} maior controle de ${content} e colaborar com os colegas durante as situacoes de jogo.`);
  }
  if (lessonType === "mini-jogo") {
    return polishPtBrText(`${resolvedVerb.charAt(0).toUpperCase() + resolvedVerb.slice(1)} ${content} em jogos curtos, tomando decisoes e cooperando com a equipe.`);
  }
  if (lessonType === "sociocultural") {
    return polishPtBrText(`Adaptar regras e participar das atividades coletivas, respeitando diferentes niveis de habilidade.`);
  }
  return polishPtBrText(`${resolvedVerb.charAt(0).toUpperCase() + resolvedVerb.slice(1)} ${content}, ajustando execucao e tomada de decisao durante as atividades.`);
};

export const resolveLearningObjectives = (
  input: ResolveLearningObjectivesInput
): ResolveLearningObjectivesResult => {
  const lessonType = detectLessonType(input);
  const dimension = detectDimension(input);
  const content = pickContent(input);
  const youngAgeBand = isYoungAgeBand(input.ageBand);

  const generalInput = normalize(input.generalObjective);
  const specificInput = normalize(input.specificObjective);

  const generalObjective =
    !generalInput || isTooGenericGeneral(generalInput)
      ? buildGeneralObjective(lessonType, dimension, content, youngAgeBand)
      : generalInput;

  const specificObjective =
    !specificInput || isListLikeSpecific(specificInput)
      ? buildSpecificObjective(lessonType, dimension, content, youngAgeBand)
      : specificInput;

  return {
    generalObjective,
    specificObjective,
    lessonType,
    dimension,
  };
};

// Backward-compatible alias for existing call sites.
export const resolvePedagogicalObjectives = resolveLearningObjectives;
