import { normalizeDisplayText } from "../../../utils/text-normalization";

const preserveCase = (match: string, replacement: string) => {
  if (!match) return replacement;
  if (match === match.toUpperCase()) return replacement.toUpperCase();
  if (match[0] === match[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
};

const replaceWord = (value: string, pattern: RegExp, replacement: string) =>
  value.replace(pattern, (match) => preserveCase(match, replacement));

export const formatTrainingPlanDisplayText = (value: string | null | undefined) => {
  let current = normalizeDisplayText(value).trim();
  if (!current) return "";

  current = current
    .replace(/\bvolta\s+a\s+calma\b/gi, (match) => preserveCase(match, "volta à calma"))
    .replace(/\bsaque\s+recepcao\b/gi, (match) => preserveCase(match, "saque-recepção"));

  const replacements: Array<[RegExp, string]> = [
    [/\badaptacao\b/gi, "adaptação"],
    [/\badaptacoes\b/gi, "adaptações"],
    [/\bcoordenacao\b/gi, "coordenação"],
    [/\bcooperacao\b/gi, "cooperação"],
    [/\borganizacao\b/gi, "organização"],
    [/\btransicao\b/gi, "transição"],
    [/\brecepcao\b/gi, "recepção"],
    [/\bdecisao\b/gi, "decisão"],
    [/\bpressao\b/gi, "pressão"],
    [/\bacoes\b/gi, "ações"],
    [/\bacao\b/gi, "ação"],
    [/\bespecifico\b/gi, "específico"],
    [/\bespecifica\b/gi, "específica"],
    [/\btecnico\b/gi, "técnico"],
    [/\btecnica\b/gi, "técnica"],
    [/\bpedagogico\b/gi, "pedagógico"],
    [/\bpedagogica\b/gi, "pedagógica"],
    [/\bcatalogo\b/gi, "catálogo"],
    [/\bvolei\b/gi, "vôlei"],
    [/\blancar\b/gi, "lançar"],
    [/\blancamento\b/gi, "lançamento"],
    [/\bmax\b/gi, "máx."],
  ];

  for (const [pattern, replacement] of replacements) {
    current = replaceWord(current, pattern, replacement);
  }

  return current.replace(/\s{2,}/g, " ").trim();
};
