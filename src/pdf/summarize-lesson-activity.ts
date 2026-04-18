export type LessonBlockType = "warmup" | "main" | "cooldown";

const clean = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/^(aquecimento|parte principal|volta\s*a\s*calma)\s*[:\-]\s*/i, "")
    .trim();

const firstClause = (value: string) => {
  const parts = value
    .split(/\.|;|\n|\||\u2022|\-|\:/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[0] ?? "";
};

const cap = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

const genericFallbackByBlock: Record<LessonBlockType, string> = {
  warmup: "Revisão em estações",
  main: "Estações de fundamentos + jogo curto",
  cooldown: "Roda de conversa",
};

const isGeneric = (value: string) =>
  /^(aquecimento|parte principal|volta\s*a\s*calma|mobilidade|ativacao|atividade|exercicio|treino)\b/i.test(
    value
  ) || /aquecimento\s+e\s+mobilidade\s+especifica/i.test(value);

const has = (text: string, pattern: RegExp) => pattern.test(text);

const resolveByKeywords = (text: string, blockType: LessonBlockType) => {
  const normalized = text.toLowerCase();

  if (blockType === "warmup") {
    if (has(normalized, /esta(ç|c)(õ|o)es?|circuito/)) return "Revisão em estações";
    if (has(normalized, /dupla|passes?|toque|manchete/)) return "Troca de passes em dupla";
    if (has(normalized, /ativ|mobilidade|coordena/)) return "Ativação técnica inicial";
  }

  if (blockType === "main") {
    if (has(normalized, /(esta(ç|c)(õ|o)es?|circuito).*(jogo|mini jogo)|jogo.*(esta(ç|c)(õ|o)es?|circuito)/)) {
      return "Estações de fundamentos + jogo curto";
    }
    if (has(normalized, /esta(ç|c)(õ|o)es?|circuito/)) return "Circuito em estações";
    if (has(normalized, /jogo|mini jogo|situa(ç|c)(ã|a)o de jogo/)) return "Jogo reduzido orientado";
    if (has(normalized, /saque|toque|manchete|levantamento|ataque|bloqueio/)) return "Fundamentos técnicos aplicados";
  }

  if (blockType === "cooldown") {
    if (has(normalized, /roda|conversa|feedback|compartilhar/)) return "Roda de conversa";
    if (has(normalized, /respira|along|desacelera|relax/)) return "Desaceleração guiada";
  }

  return "";
};

export const summarizeLessonActivity = (text: string | null | undefined, blockType: LessonBlockType): string => {
  const raw = clean(String(text ?? ""));
  if (!raw) return genericFallbackByBlock[blockType];

  const byKeyword = resolveByKeywords(raw, blockType);
  if (byKeyword) return byKeyword;

  const candidate = cap(firstClause(raw));
  if (!candidate) return genericFallbackByBlock[blockType];

  if (isGeneric(candidate)) return genericFallbackByBlock[blockType];
  return candidate;
};
