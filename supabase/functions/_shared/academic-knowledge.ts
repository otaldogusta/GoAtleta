export const DEFAULT_ACADEMIC_DRIVE_FOLDER_ID =
  "1TtqVOgnLXeDqvGr6885s-KABA4tsJ5QE";

export const ACADEMIC_AREAS = [
  "didatica",
  "curriculo",
  "politicas_educacionais",
  "planejamento_pedagogico",
  "avaliacao",
  "desenvolvimento_infantil",
  "inclusao",
  "acessibilidade",
  "libras",
  "metodologias_ensino",
  "abordagens_pedagogicas",
  "gestao_educacional",
  "legislacao",
  "etica",
  "conhecimento_cientifico_tecnico",
  "nao_classificado",
] as const;

export const ACADEMIC_MATERIAL_TYPES = [
  "official_norm",
  "scientific_article",
  "book_or_chapter",
  "university_handout",
  "lecture_presentation",
  "student_summary",
  "personal_note",
  "unknown",
] as const;

export const ACADEMIC_EVIDENCE_KINDS = [
  "official_norm",
  "scientific_research",
  "published_book",
  "institutional_academic_material",
  "classroom_academic_material",
  "student_authored_summary",
  "personal_note",
  "unknown_support",
] as const;

export const ACADEMIC_DISCIPLINES = [
  "gestao_trabalho_pedagogico",
  "pratica_ensino_educacao_infantil",
  "curriculo_fundamentos_cultura",
  "educacao_basica_politica_legislacao",
  "libras",
  "tendencias_pedagogicas_didatica",
  "unknown",
] as const;

export const ACADEMIC_KNOWLEDGE_LAYERS = [
  "academic",
  "institutional",
  "unknown",
] as const;

export type AcademicArea = (typeof ACADEMIC_AREAS)[number];
export type AcademicMaterialType = (typeof ACADEMIC_MATERIAL_TYPES)[number];
export type AcademicEvidenceKind = (typeof ACADEMIC_EVIDENCE_KINDS)[number];
export type AcademicDiscipline = (typeof ACADEMIC_DISCIPLINES)[number];
export type AcademicKnowledgeLayer =
  (typeof ACADEMIC_KNOWLEDGE_LAYERS)[number];

export type AcademicClassification = {
  discipline: AcademicDiscipline;
  academicArea: AcademicArea;
  materialType: AcademicMaterialType;
  evidenceKind: AcademicEvidenceKind;
  knowledgeLayer: AcademicKnowledgeLayer;
  confidence: number;
};

const DISCIPLINES = [
  {
    label: "Gestão e Organização do Trabalho Pedagógico",
    code: "gestao_trabalho_pedagogico" as const,
    phrases: ["gestao e organizacao do trabalho pedagogico"],
    keywords: ["gestao", "organizacao", "trabalho pedagogico"],
    area: "gestao_educacional" as const,
  },
  {
    label: "Prática de Ensino na Educação Infantil",
    code: "pratica_ensino_educacao_infantil" as const,
    phrases: ["pratica de ensino na educacao infantil"],
    keywords: [
      "educacao infantil",
      "infancia",
      "ludicidade",
      "desenvolvimento infantil",
    ],
    area: "desenvolvimento_infantil" as const,
  },
  {
    label: "Currículo na Escola: Fundamentos e Cultura",
    code: "curriculo_fundamentos_cultura" as const,
    phrases: ["curriculo na escola fundamentos e cultura"],
    keywords: ["curriculo", "cultura escolar", "fundamentos do curriculo"],
    area: "curriculo" as const,
  },
  {
    label: "Educação Básica: Fundamentos, Política e Legislação",
    code: "educacao_basica_politica_legislacao" as const,
    phrases: ["educacao basica fundamentos politica e legislacao"],
    keywords: [
      "educacao basica",
      "politica educacional",
      "legislacao educacional",
    ],
    area: "politicas_educacionais" as const,
  },
  {
    label: "Língua Brasileira de Sinais",
    code: "libras" as const,
    phrases: ["lingua brasileira de sinais", "libras"],
    keywords: ["libras", "surdez", "pessoa surda", "lingua de sinais"],
    area: "libras" as const,
  },
  {
    label: "Tendências Pedagógicas e Didática",
    code: "tendencias_pedagogicas_didatica" as const,
    phrases: ["tendencias pedagogicas e didatica"],
    keywords: [
      "tendencias pedagogicas",
      "didatica",
      "resolucao de problemas",
      "abordagem cognitivista",
      "abordagem sociocultural",
    ],
    area: "didatica" as const,
  },
] as const;

const PROMPT_INJECTION_PATTERNS = [
  /\b(ignore|ignorar|desconsidere|desconsiderar)\b.*\b(instrucoes?|regras?|prompt|mensagem)\b/i,
  /\b(system prompt|prompt do sistema|developer message|mensagem do desenvolvedor)\b/i,
  /\b(execute|executar|rode|rodar|chame|chamar)\b.*\b(ferramenta|tool|funcao|function|comando|script|shell)\b/i,
  /\b(altere|alterar|mude|mudar|eleve|conceda)\b.*\b(permissoes?|acesso|role|privilegios?|workspace|organizacao)\b/i,
  /\b(revele|mostrar|mostre|exponha|vaze)\b.*\b(segredo|token|chave|prompt|credencial)\b/i,
  /\b(begin|inicio)\s+(system|developer)\s+(prompt|message)\b/i,
  /\bauth(?:entication|orization)?\s*[:=]\s*bearer\b/i,
  /\b(supabase_service_role|openai_api_key)\b/i,
] as const;

const DOI_PATTERN = /\b10\.\d{4,9}\/[-._;()/:a-z0-9]+\b/i;
const ISBN_PATTERN =
  /\bISBN(?:-1[03])?\s*:?\s*(?:97[89][-\s]?)?[\dX][\dX\-\s]{8,}\b/i;

export const normalizeAcademicText = (value: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s./_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeAcademicContentForHash = (value: string) =>
  String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();

export function parseGoogleDriveFolderId(value: string) {
  const candidate = String(value ?? "").trim();
  if (/^[A-Za-z0-9_-]{20,}$/.test(candidate)) return candidate;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("Pasta do Google Drive inválida.");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== "drive.google.com") {
    throw new Error("A pasta acadêmica deve usar um domínio oficial do Google Drive.");
  }

  const folderMatch = parsed.pathname.match(/\/folders\/([A-Za-z0-9_-]{20,})/);
  const queryId = parsed.searchParams.get("id");
  const id = folderMatch?.[1] ?? queryId ?? "";
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) {
    throw new Error("Não foi possível identificar a pasta do Google Drive.");
  }
  return id;
}

const inferMaterial = (params: {
  name: string;
  mimeType: string;
  content: string;
  institution?: string;
  sourceUrl?: string;
}) => {
  const normalized = normalizeAcademicText(`${params.name} ${params.content.slice(0, 16_000)}`);
  const raw = `${params.name}\n${params.content.slice(0, 16_000)}\n${params.sourceUrl ?? ""}`;

  if (
    params.mimeType === "application/vnd.google-apps.presentation" ||
    /\.(ppt|pptx|odp)$/i.test(params.name) ||
    /\b(slides?|apresentacao de aula|material de aula)\b/.test(normalized)
  ) {
    return {
      materialType: "lecture_presentation" as const,
      evidenceKind: "classroom_academic_material" as const,
      confidence: 0.74,
    };
  }

  if (
    /\b(resumo do aluno|resumo produzido pelo estudante|fichamento|resenha academica|trabalho do estudante)\b/.test(
      normalized
    )
  ) {
    return {
      materialType: "student_summary" as const,
      evidenceKind: "student_authored_summary" as const,
      confidence: 0.72,
    };
  }

  if (
    /\b(anotacao pessoal|anotacoes pessoais|meus apontamentos|caderno de anotacoes)\b/.test(
      normalized
    )
  ) {
    return {
      materialType: "personal_note" as const,
      evidenceKind: "personal_note" as const,
      confidence: 0.7,
    };
  }

  if (
    /\b(lei|decreto|resolucao|portaria)\b.{0,40}\b(?:n|no|numero)?\s*\d+(?:[./-]\d+)*/i.test(
      normalized
    ) ||
    /(?:gov\.br|planalto\.gov\.br)/i.test(params.sourceUrl ?? "")
  ) {
    return {
      materialType: "official_norm" as const,
      evidenceKind: "official_norm" as const,
      confidence: 0.9,
    };
  }

  const hasScientificStructure =
    DOI_PATTERN.test(raw) ||
    (/\bartigo cientifico\b/.test(normalized) &&
      /\b(metodo|metodologia da pesquisa|resultados|discussao|referencias)\b/.test(
        normalized
      ));
  if (hasScientificStructure) {
    return {
      materialType: "scientific_article" as const,
      evidenceKind: "scientific_research" as const,
      confidence: 0.9,
    };
  }

  if (
    ISBN_PATTERN.test(raw) ||
    (/\b(capitulo|livro)\b/.test(normalized) &&
      /\b(editora|edicao|referencias bibliograficas)\b/.test(normalized))
  ) {
    return {
      materialType: "book_or_chapter" as const,
      evidenceKind: "published_book" as const,
      confidence: 0.82,
    };
  }

  if (
    Boolean(params.institution?.trim()) ||
    /\b(universidade|faculdade|disciplina|ementa|apostila universitaria)\b/.test(
      normalized
    )
  ) {
    return {
      materialType: "university_handout" as const,
      evidenceKind: "institutional_academic_material" as const,
      confidence: 0.72,
    };
  }

  return {
    materialType: "unknown" as const,
    evidenceKind: "unknown_support" as const,
    confidence: 0.35,
  };
};

export function classifyAcademicDriveItem(params: {
  name: string;
  path: string[];
  mimeType: string;
  content?: string;
  institution?: string;
  sourceUrl?: string;
}): AcademicClassification {
  const heading = normalizeAcademicText(`${params.path.join(" ")} ${params.name}`);
  const normalized = normalizeAcademicText(
    `${heading} ${(params.content ?? "").slice(0, 12_000)}`
  );
  const exactDiscipline = DISCIPLINES.find((candidate) =>
    candidate.phrases.some((phrase) => heading.includes(phrase))
  );
  const rankedDisciplines = DISCIPLINES.map((candidate) => ({
    candidate,
    matches: candidate.keywords.filter((keyword) => normalized.includes(keyword))
      .length,
  })).sort((left, right) => right.matches - left.matches);
  const inferredDiscipline =
    exactDiscipline ??
    (rankedDisciplines[0]?.matches ? rankedDisciplines[0].candidate : undefined);
  const disciplineConfidence = exactDiscipline
    ? 0.98
    : (rankedDisciplines[0]?.matches ?? 0) >= 2
      ? 0.86
      : inferredDiscipline
        ? 0.68
        : 0.45;
  const material = inferMaterial({
    name: params.name,
    mimeType: params.mimeType,
    content: params.content ?? "",
    institution: params.institution,
    sourceUrl: params.sourceUrl,
  });

  const institutionalRecord =
    /\brede esperanca\b/.test(normalized) &&
    /\b(regra institucional|orientacao institucional|planejamento mensal|procedimento obrigatorio)\b/.test(
      normalized
    );
  const knowledgeLayer: AcademicKnowledgeLayer = institutionalRecord
    ? "institutional"
    : inferredDiscipline ||
        /\b(universidade|faculdade|disciplina|ementa|material academico)\b/.test(
          normalized
        )
      ? "academic"
      : "unknown";

  let academicArea: AcademicArea =
    inferredDiscipline?.area ?? "nao_classificado";
  if (/\b(avaliacao|criterio|observacao|acompanhamento)\b/.test(normalized)) {
    academicArea = "avaliacao";
  } else if (/\b(inclusao|educacao especial)\b/.test(normalized)) {
    academicArea = "inclusao";
  } else if (/\b(acessibilidade|libras)\b/.test(normalized)) {
    academicArea = normalized.includes("libras") ? "libras" : "acessibilidade";
  } else if (/\b(metodologia|metodologias)\b/.test(normalized)) {
    academicArea = "metodologias_ensino";
  } else if (/\b(abordagem|tendencia pedagogica|teoria da aprendizagem)\b/.test(normalized)) {
    academicArea = "abordagens_pedagogicas";
  } else if (/\b(planejamento|plano de aula)\b/.test(normalized)) {
    academicArea = "planejamento_pedagogico";
  } else if (/\b(etica|fair play|convivencia)\b/.test(normalized)) {
    academicArea = "etica";
  }

  return {
    discipline: inferredDiscipline?.code ?? "unknown",
    academicArea,
    ...material,
    knowledgeLayer,
    confidence: Math.min(disciplineConfidence, material.confidence),
  };
}

export function sanitizeUntrustedAcademicContent(value: string) {
  const normalizedContent = normalizeAcademicContentForHash(value);
  const warnings: string[] = [];
  let blockedInstructionCount = 0;
  const sanitized = normalizedContent
    .split("\n")
    .filter((line) => {
      const normalizedLine = normalizeAcademicText(line);
      if (
        normalizedLine &&
        PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(normalizedLine))
      ) {
        blockedInstructionCount += 1;
        return false;
      }
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (blockedInstructionCount > 0) warnings.push("possible_prompt_injection");
  if (sanitized.length > 250_000) warnings.push("content_truncated");

  return {
    content: sanitized.slice(0, 250_000),
    warnings: [...new Set(warnings)],
    blockedInstructionCount,
  };
}

export function chunkAcademicContent(
  content: string,
  options: { maxChars?: number; overlapChars?: number } = {}
) {
  const maxChars = Math.max(240, Math.min(options.maxChars ?? 2_800, 6_000));
  const overlapChars = Math.max(
    0,
    Math.min(options.overlapChars ?? 280, Math.floor(maxChars / 3))
  );
  const normalizedContent = String(content ?? "")
    .split(/\n{2,}/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");

  const chunks: { text: string; startOffset: number; endOffset: number }[] = [];
  let startOffset = 0;

  while (startOffset < normalizedContent.length && chunks.length < 160) {
    const hardEndOffset = Math.min(
      startOffset + maxChars,
      normalizedContent.length
    );
    let endOffset = hardEndOffset;
    if (endOffset < normalizedContent.length) {
      const minimumBoundary = startOffset + Math.floor(maxChars * 0.55);
      const paragraphBoundary = normalizedContent.lastIndexOf(
        "\n\n",
        endOffset - 1
      );
      const sentenceBoundary = Math.max(
        normalizedContent.lastIndexOf(". ", endOffset - 1),
        normalizedContent.lastIndexOf("! ", endOffset - 1),
        normalizedContent.lastIndexOf("? ", endOffset - 1)
      );
      const preferredBoundary = Math.max(paragraphBoundary, sentenceBoundary);
      if (preferredBoundary >= minimumBoundary) {
        endOffset = Math.min(
          hardEndOffset,
          preferredBoundary + (preferredBoundary === paragraphBoundary ? 0 : 1)
        );
      }
    }

    const rawSlice = normalizedContent.slice(startOffset, endOffset);
    const leadingWhitespace = rawSlice.length - rawSlice.trimStart().length;
    const trailingWhitespace = rawSlice.length - rawSlice.trimEnd().length;
    const actualStart = startOffset + leadingWhitespace;
    const actualEnd = endOffset - trailingWhitespace;
    const text = normalizedContent.slice(actualStart, actualEnd);
    if (text) {
      chunks.push({ text, startOffset: actualStart, endOffset: actualEnd });
    }
    if (endOffset >= normalizedContent.length) break;

    let nextStart = Math.max(startOffset + 1, actualEnd - overlapChars);
    while (
      nextStart < actualEnd &&
      nextStart < normalizedContent.length &&
      /\S/.test(normalizedContent[nextStart] ?? "")
    ) {
      nextStart += 1;
    }
    while (
      nextStart < normalizedContent.length &&
      /\s/.test(normalizedContent[nextStart] ?? "")
    ) {
      nextStart += 1;
    }
    startOffset = nextStart > startOffset ? nextStart : endOffset;
  }

  return chunks;
}
