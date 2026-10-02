import { normalizeDisplayText } from "../../utils/text-normalization";

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

const formatProse = (value: string | null | undefined) => {
  let current = normalizeDisplayText(value).trim();
  if (!current) return "";

  current = current
    .replace(/\bvolta\s+a\s+calma\b/gi, (match) => preserveCase(match, "volta à calma"))
    .replace(/\bsaque\s+recepcao\b/gi, (match) => preserveCase(match, "saque-recepção"));

  const replacements: [RegExp, string][] = [
    [/\bconsistencia\b/gi, "consistência"],
    [/\bprecisao\b/gi, "precisão"],
    [/\bestabilizacao\b/gi, "estabilização"],
    [/\bexploracao\b/gi, "exploração"],
    [/\baceleracao\b/gi, "aceleração"],
    [/\btransferencia\b/gi, "transferência"],
    [/\boposicao\b/gi, "oposição"],
    [/\bintencao\b/gi, "intenção"],
    [/\bprogressao\b/gi, "progressão"],
    [/\bprogressoes\b/gi, "progressões"],
    [/\bsessao\b/gi, "sessão"],
    [/\bsessoes\b/gi, "sessões"],
    [/\bnao\b/gi, "não"],
    [/\bfamilias\b/gi, "famílias"],
    [/\bsecundaria\b/gi, "secundária"],
    [/\bobrigatoria\b/gi, "obrigatória"],
    [/\bexecucao\b/gi, "execução"],
    [/\bcorrecao\b/gi, "correção"],
    [/\bsituacoes\b/gi, "situações"],
    [/\bsituacao\b/gi, "situação"],
    [/\bpercepcao\b/gi, "percepção"],
    [/\bposicao\b/gi, "posição"],
    [/\bposicoes\b/gi, "posições"],
    [/\bdirecao\b/gi, "direção"],
    [/\bvariacao\b/gi, "variação"],
    [/\bvariacoes\b/gi, "variações"],
    [/\brepeticao\b/gi, "repetição"],
    [/\brepeticoes\b/gi, "repetições"],
    [/\bdecisoes\b/gi, "decisões"],
    [/\btecnicos\b/gi, "técnicos"],
    [/\btecnicas\b/gi, "técnicas"],
    [/\bprincipios\b/gi, "princípios"],
    [/\bprincipio\b/gi, "princípio"],
    [/\bcontinuacao\b/gi, "continuação"],
    [/\bprevencao\b/gi, "prevenção"],
    [/\brecuperacao\b/gi, "recuperação"],
    [/\bavaliacao\b/gi, "avaliação"],
    [/\bduracao\b/gi, "duração"],
    [/\bintensificacao\b/gi, "intensificação"],
    [/\bconsolidacao\b/gi, "consolidação"],
    [/\brapido\b/gi, "rápido"],
    [/\brapida\b/gi, "rápida"],

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

  current = current.replace(/\badaptação a pressão\b/gi, (match) => preserveCase(match, "adaptação à pressão"));
  current = current
    .replace(/\btomada decisão\b/gi, (match) => preserveCase(match, "tomada de decisão"))
    .replace(/\btransferência jogo\b/gi, (match) => preserveCase(match, "transferência para o jogo"))
    .replace(/\bpressão tempo\b/gi, (match) => preserveCase(match, "pressão de tempo"));
  const blocks: Record<string, string> = { main: "parte principal", warmup: "aquecimento", cooldown: "volta à calma" };
  current = current.replace(/(^|\/\s*|\bbloco\s+)(main|warmup|cooldown)(?=$|[\s.,;])/gi,
    (_, prefix: string, block: string) => `${prefix}${blocks[block.toLowerCase()]}`);
  return current.replace(/[^\S\r\n]{2,}/g, " ").trim();
};

export const formatPedagogicalDisplayText = (value: string | null | undefined): string =>
  normalizeDisplayText(value).split(/(https?:\/\/[^\s]+|`[^`]*`)/g)
    .map((part) => /^(https?:\/\/|`)/.test(part) ? part : part.replace(/\S[\s\S]*\S|\S/g, (text) => formatProse(text)))
    .join("").replace(/[^\S\r\n]{2,}/g, " ").trim();
