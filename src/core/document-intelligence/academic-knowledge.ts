import type {
  AcademicArea,
  AcademicChunkingInput,
  AcademicContentSanitizationResult,
  AcademicDiscipline,
  AcademicDocumentClassification,
  AcademicDocumentClassificationInput,
  AcademicEvidenceLevel,
  AcademicKnowledgeChunk,
  AcademicMaterialType,
  AcademicPlanSnapshot,
  AcademicPlanningRecommendation,
  AcademicReconciliationResult,
  AcademicReferencePresentation,
  AcademicReportEvidence,
  AcademicRetrievalContext,
  AcademicRetrievedChunk,
  AcademicSourceScope,
  AcademicSupportResolution,
  AcademicTeacherMemoryProposal,
  AppliedPedagogicalReference,
  ConfirmedAcademicTeacherFact,
} from "./types";

const GOOGLE_DRIVE_FOLDER_PATH = /drive\/folders\/([a-zA-Z0-9_-]+)/i;
const GOOGLE_DRIVE_FOLDER_QUERY = /[?&]id=([a-zA-Z0-9_-]+)/i;
const RAW_GOOGLE_DRIVE_ID = /^[a-zA-Z0-9_-]{10,}$/;
const DOI_PATTERN = /\b10\.\d{4,9}\/[-._;()/:a-z0-9]+\b/i;
const ISBN_PATTERN = /\bISBN(?:-1[03])?\s*:?\s*(?:97[89][-\s]?)?[\dX][\dX\-\s]{8,}\b/i;

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const STOPWORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "como",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "ou",
  "para",
  "por",
  "que",
  "se",
  "sem",
  "um",
  "uma",
  "aula",
  "aluno",
  "alunos",
  "turma",
]);

const tokenize = (value: string) =>
  normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));

const unique = <T>(values: T[]) => [...new Set(values)];

const clampConfidence = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

const hashText = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const DISCIPLINE_DEFINITIONS: {
  discipline: AcademicDiscipline;
  phrases: string[];
  keywords: string[];
  areas: AcademicArea[];
}[] = [
  {
    discipline: "gestao_trabalho_pedagogico",
    phrases: ["gestao e organizacao do trabalho pedagogico"],
    keywords: ["gestao", "organizacao", "trabalho pedagogico"],
    areas: ["gestao_educacional", "planejamento_pedagogico", "avaliacao"],
  },
  {
    discipline: "pratica_ensino_educacao_infantil",
    phrases: ["pratica de ensino na educacao infantil"],
    keywords: ["educacao infantil", "infancia", "ludicidade", "desenvolvimento infantil"],
    areas: [
      "desenvolvimento_infantil",
      "metodologias_ensino",
      "planejamento_pedagogico",
      "avaliacao",
    ],
  },
  {
    discipline: "curriculo_fundamentos_cultura",
    phrases: ["curriculo na escola fundamentos e cultura"],
    keywords: ["curriculo", "cultura escolar", "fundamentos do curriculo"],
    areas: ["curriculo", "politicas_educacionais", "etica"],
  },
  {
    discipline: "educacao_basica_politica_legislacao",
    phrases: ["educacao basica fundamentos politica e legislacao"],
    keywords: ["educacao basica", "politica educacional", "legislacao educacional"],
    areas: ["politicas_educacionais", "legislacao", "curriculo"],
  },
  {
    discipline: "libras",
    phrases: ["lingua brasileira de sinais", "libras"],
    keywords: ["libras", "surdez", "pessoa surda", "lingua de sinais"],
    areas: ["libras", "acessibilidade", "inclusao"],
  },
  {
    discipline: "tendencias_pedagogicas_didatica",
    phrases: ["tendencias pedagogicas e didatica"],
    keywords: [
      "tendencias pedagogicas",
      "didatica",
      "resolucao de problemas",
      "abordagem cognitivista",
      "abordagem sociocultural",
    ],
    areas: ["didatica", "abordagens_pedagogicas", "metodologias_ensino", "avaliacao"],
  },
];

const AREA_KEYWORDS: Record<AcademicArea, string[]> = {
  didatica: ["didatica", "situacao problema", "intervencao docente", "ensino aprendizagem"],
  curriculo: ["curriculo", "cultura escolar", "base curricular"],
  politicas_educacionais: ["politica educacional", "educacao basica", "sistema educacional"],
  planejamento_pedagogico: ["planejamento pedagogico", "plano de ensino", "objetivo pedagogico"],
  avaliacao: ["avaliacao", "criterio de avaliacao", "observacao", "acompanhamento"],
  desenvolvimento_infantil: [
    "desenvolvimento infantil",
    "educacao infantil",
    "infancia",
    "ludicidade",
    "crianca",
  ],
  inclusao: ["inclusao", "participacao de todos", "necessidade educacional"],
  acessibilidade: ["acessibilidade", "barreira", "adaptacao de comunicacao"],
  libras: ["libras", "lingua brasileira de sinais", "pessoa surda", "surdez"],
  metodologias_ensino: [
    "metodologia",
    "resolucao de problemas",
    "aprendizagem cooperativa",
    "ensino por descoberta",
  ],
  abordagens_pedagogicas: [
    "abordagem pedagogica",
    "cognitivista",
    "sociocultural",
    "construtivista",
  ],
  gestao_educacional: ["gestao educacional", "organizacao do trabalho pedagogico"],
  legislacao: ["legislacao", "lei ", "decreto", "resolucao", "norma oficial"],
  etica: ["etica", "convivencia", "fair play", "respeito"],
  conhecimento_cientifico_tecnico: [
    "artigo cientifico",
    "metodo",
    "resultados",
    "doi",
    "revisao sistematica",
  ],
  nao_classificado: [],
};

const INSTRUCTION_PATTERNS = [
  /\b(ignore|ignorar|desconsidere|desconsiderar)\b.*\b(instrucoes?|regras?|prompt|mensagem)\b/i,
  /\b(system prompt|prompt do sistema|developer message|mensagem do desenvolvedor)\b/i,
  /\b(execute|executar|rode|rodar|chame|chamar)\b.*\b(ferramenta|tool|funcao|function|comando|script)\b/i,
  /\b(altere|alterar|mude|mudar|eleve|conceda)\b.*\b(permissoes?|acesso|role|privilegios?)\b/i,
  /\b(revele|mostrar|mostre|exponha|vaze)\b.*\b(segredo|token|chave|prompt|credencial)\b/i,
  /\b(begin|inicio)\s+(system|developer)\s+(prompt|message)\b/i,
];

const inferDiscipline = (input: AcademicDocumentClassificationInput) => {
  const headingText = normalizeText(`${input.filename} ${input.title ?? ""}`);
  const fullText = normalizeText(`${headingText} ${input.content.slice(0, 12_000)}`);

  for (const definition of DISCIPLINE_DEFINITIONS) {
    if (definition.phrases.some((phrase) => headingText.includes(phrase))) {
      return { definition, confidence: 0.98 };
    }
  }

  const ranked = DISCIPLINE_DEFINITIONS.map((definition) => ({
    definition,
    matches: definition.keywords.filter((keyword) => fullText.includes(keyword)).length,
  })).sort((left, right) => right.matches - left.matches);

  const best = ranked[0];
  if (!best || best.matches === 0) return null;
  return {
    definition: best.definition,
    confidence: best.matches >= 2 ? 0.86 : 0.68,
  };
};

const inferAreas = (
  value: string,
  baseAreas: AcademicArea[] = []
): AcademicArea[] => {
  const normalized = normalizeText(value);
  const inferred = (Object.entries(AREA_KEYWORDS) as [AcademicArea, string[]][])
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)))
    .map(([area]) => area);
  const areas = unique([...baseAreas, ...inferred]);
  return areas.length ? areas.filter((area) => area !== "nao_classificado") : ["nao_classificado"];
};

const inferMaterial = (
  input: AcademicDocumentClassificationInput
): { materialType: AcademicMaterialType; evidenceLevel: AcademicEvidenceLevel } => {
  const text = normalizeText(`${input.title ?? ""} ${input.content.slice(0, 16_000)}`);
  const raw = `${input.title ?? ""}\n${input.content.slice(0, 16_000)}\n${input.sourceUrl ?? ""}`;

  if (
    /\.(ppt|pptx|odp)$/i.test(input.filename) ||
    /\b(slides?|apresentacao de aula|material de aula)\b/.test(text)
  ) {
    return {
      materialType: "lecture_presentation",
      evidenceLevel: "classroom_academic_material",
    };
  }

  if (/\b(resumo do aluno|fichamento|resenha academica|trabalho do estudante)\b/.test(text)) {
    return { materialType: "student_summary", evidenceLevel: "student_authored_summary" };
  }

  if (
    /\b(anotacao pessoal|anotacoes pessoais|meus apontamentos|caderno de anotacoes)\b/.test(text)
  ) {
    return { materialType: "personal_note", evidenceLevel: "personal_note" };
  }

  if (
    /\b(lei|decreto|resolucao|portaria)\s+(?:n|no|numero)?\s*\d+/i.test(text) ||
    /(?:gov\.br|planalto\.gov\.br)/i.test(input.sourceUrl ?? "")
  ) {
    return { materialType: "official_norm", evidenceLevel: "official_norm" };
  }

  const hasScientificStructure =
    DOI_PATTERN.test(raw) ||
    (/\bartigo cientifico\b/.test(text) &&
      /\b(metodo|metodologia da pesquisa|resultados|discussao|referencias)\b/.test(text));
  if (hasScientificStructure) {
    return { materialType: "scientific_article", evidenceLevel: "scientific_research" };
  }

  if (
    ISBN_PATTERN.test(raw) ||
    (/\b(capitulo|livro)\b/.test(text) && /\b(editora|edicao|referencias bibliograficas)\b/.test(text))
  ) {
    return { materialType: "book_or_chapter", evidenceLevel: "published_book" };
  }

  if (
    Boolean(input.institution?.trim()) ||
    /\b(universidade|faculdade|disciplina|ementa|apostila universitaria)\b/.test(text)
  ) {
    return {
      materialType: "university_handout",
      evidenceLevel: "institutional_academic_material",
    };
  }

  return { materialType: "unknown", evidenceLevel: "unknown_support" };
};

const inferKnowledgeLayer = (
  input: AcademicDocumentClassificationInput,
  discipline: AcademicDiscipline
) => {
  if (discipline !== "unknown") return "academic" as const;
  const text = normalizeText(`${input.filename} ${input.title ?? ""} ${input.content.slice(0, 8_000)}`);
  if (
    /\brede esperanca\b/.test(text) &&
    /\b(regra institucional|orientacao institucional|planejamento mensal|procedimento obrigatorio)\b/.test(
      text
    )
  ) {
    return "institutional" as const;
  }
  if (/\b(universidade|faculdade|disciplina|ementa|material academico)\b/.test(text)) {
    return "academic" as const;
  }
  return "unknown" as const;
};

const normalizeAcademicSourceScope = (input: AcademicSourceScope): AcademicSourceScope => {
  if (input.kind === "user_academic") {
    const userId = input.userId.trim();
    if (!userId) throw new Error("userId é obrigatório para a base acadêmica pessoal.");
    return { kind: "user_academic", userId };
  }

  const organizationId = input.organizationId.trim();
  if (!organizationId) {
    throw new Error("organizationId é obrigatório para a base acadêmica do workspace.");
  }
  return {
    kind: "workspace_academic",
    organizationId,
    userId: input.userId?.trim() || undefined,
  };
};

export const extractGoogleDriveFolderId = (value: string): string | null => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (RAW_GOOGLE_DRIVE_ID.test(trimmed) && !trimmed.includes("/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (!/(^|\.)drive\.google\.com$/i.test(parsed.hostname)) return null;
    return (
      parsed.pathname.match(GOOGLE_DRIVE_FOLDER_PATH)?.[1] ??
      parsed.search.match(GOOGLE_DRIVE_FOLDER_QUERY)?.[1] ??
      null
    );
  } catch {
    return null;
  }
};

export const buildInitialAcademicSourceScope = (
  input:
    | { kind: "user_academic"; userId: string }
    | { kind: "workspace_academic"; organizationId: string; userId?: string }
): AcademicSourceScope => normalizeAcademicSourceScope(input);

export const sanitizeUntrustedAcademicContent = (
  content: string
): AcademicContentSanitizationResult => {
  const blockedInstructions: string[] = [];
  const sanitizedLines = String(content ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => {
      const originalLine = line.trim();
      if (!originalLine) return true;
      const normalizedLine = normalizeText(originalLine);
      const shouldBlock = INSTRUCTION_PATTERNS.some((pattern) => pattern.test(normalizedLine));
      if (shouldBlock) blockedInstructions.push(originalLine);
      return !shouldBlock;
    });

  return {
    sanitizedContent: sanitizedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    blockedInstructions,
  };
};

export const classifyAcademicDocument = (
  input: AcademicDocumentClassificationInput
): AcademicDocumentClassification => {
  const sanitized = sanitizeUntrustedAcademicContent(input.content);
  const safeInput = { ...input, content: sanitized.sanitizedContent };
  const disciplineMatch = inferDiscipline(safeInput);
  const discipline = disciplineMatch?.definition.discipline ?? "unknown";
  const baseAreas = disciplineMatch?.definition.areas ?? [];
  const areas = inferAreas(
    `${input.filename} ${input.title ?? ""} ${sanitized.sanitizedContent}`,
    baseAreas
  );
  const material = inferMaterial(safeInput);
  const knowledgeLayer = inferKnowledgeLayer(safeInput, discipline);
  const warnings: string[] = [];

  if (discipline === "unknown") {
    warnings.push("Disciplina acadêmica não identificada com confiança suficiente.");
  }
  if (material.evidenceLevel === "unknown_support") {
    warnings.push("Qualidade da fonte não identificada; manter como material de apoio.");
  }
  if (sanitized.blockedInstructions.length) {
    warnings.push(
      `${sanitized.blockedInstructions.length} instrução(ões) documental(is) bloqueada(s).`
    );
  }
  if (knowledgeLayer === "institutional") {
    warnings.push("Documento institucional deve permanecer fora da base acadêmica.");
  }

  const evidenceConfidence =
    material.evidenceLevel === "unknown_support" ? 0.35 : material.evidenceLevel === "scientific_research" ? 0.9 : 0.72;

  return {
    discipline,
    areas,
    materialType: material.materialType,
    evidenceLevel: material.evidenceLevel,
    confidence: clampConfidence(
      Math.min(disciplineMatch?.confidence ?? 0.45, evidenceConfidence)
    ),
    warnings,
    knowledgeLayer,
  };
};

const splitOversizedParagraph = (paragraph: string, maxChars: number): string[] => {
  if (paragraph.length <= maxChars) return [paragraph];
  const sentences = paragraph
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (sentences.length <= 1) {
    const pieces: string[] = [];
    for (let index = 0; index < paragraph.length; index += maxChars) {
      pieces.push(paragraph.slice(index, index + maxChars).trim());
    }
    return pieces.filter(Boolean);
  }

  const pieces: string[] = [];
  let current = "";
  sentences.forEach((sentence) => {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > maxChars && current) {
      pieces.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  });
  if (current) pieces.push(current);
  return pieces.flatMap((piece) =>
    piece.length > maxChars ? splitOversizedParagraph(piece, maxChars) : [piece]
  );
};

export const chunkAcademicDocument = (
  input: AcademicChunkingInput
): AcademicKnowledgeChunk[] => {
  const sanitized = sanitizeUntrustedAcademicContent(input.content);
  if (!sanitized.sanitizedContent) return [];

  const classification = classifyAcademicDocument({
    filename: input.filename,
    title: input.title,
    content: sanitized.sanitizedContent,
    author: input.author,
    institution: input.institution,
    sourceUrl: input.sourceUrl,
  });
  if (classification.knowledgeLayer === "institutional") {
    throw new Error("Documento institucional não pode ser ingerido como base acadêmica.");
  }
  const sourceScope = normalizeAcademicSourceScope(input.sourceScope);

  const maxChars = Math.max(240, Math.min(2_000, input.maxChunkChars ?? 900));
  const rawParagraphs = sanitized.sanitizedContent
    .split(/\n\s*\n/)
    .flatMap((paragraph) => splitOversizedParagraph(paragraph.replace(/\s+/g, " ").trim(), maxChars))
    .filter(Boolean);
  const chunks: { text: string; start: number; end: number }[] = [];
  let current = "";
  let start = 1;

  rawParagraphs.forEach((paragraph, index) => {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars && current) {
      chunks.push({ text: current, start, end: index });
      current = paragraph;
      start = index + 1;
    } else {
      current = candidate;
    }
  });
  if (current) {
    chunks.push({ text: current, start, end: rawParagraphs.length });
  }

  return chunks.map((chunk, index) => {
    const chunkAreas = inferAreas(chunk.text, classification.areas);
    const sourceLocation =
      chunk.start === chunk.end
        ? `parágrafo ${chunk.start}`
        : `parágrafos ${chunk.start}-${chunk.end}`;
    return {
      id: `academic_chunk_${hashText(
        `${input.sourceDocumentId}|${input.sourceRevisionId ?? ""}|${index}|${chunk.text}`
      )}`,
      text: chunk.text,
      areas: chunkAreas,
      keywords: unique(tokenize(chunk.text)).slice(0, 32),
      provenance: {
        sourceDocumentId: input.sourceDocumentId,
        sourceRevisionId: input.sourceRevisionId,
        contentHash: input.contentHash,
        folderId: input.folderId,
        filename: input.filename,
        title: input.title?.trim() || input.filename,
        author: input.author?.trim() || undefined,
        institution: input.institution?.trim() || undefined,
        sourceUrl: input.sourceUrl?.trim() || undefined,
        sourceScope,
        discipline: classification.discipline,
        materialType: classification.materialType,
        evidenceLevel: classification.evidenceLevel,
        sourceLocation,
      },
    };
  });
};

const buildRetrievalTerms = (context: AcademicRetrievalContext) =>
  unique(
    tokenize(
      [
        context.modality,
        context.ageBand,
        context.objective,
        context.skill,
        context.pedagogicalApproach,
        context.situationProblem,
        ...(context.classNeeds ?? []),
      ]
        .filter(Boolean)
        .join(" ")
    )
  );

export const retrieveAcademicChunks = (
  chunks: AcademicKnowledgeChunk[],
  context: AcademicRetrievalContext,
  options: { topK?: number; minimumScore?: number } = {}
): AcademicRetrievedChunk[] => {
  const queryText = [
    context.objective,
    context.skill,
    context.pedagogicalApproach,
    context.situationProblem,
    ...(context.classNeeds ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  const requestedAreas = unique([
    ...(context.requestedAreas ?? []),
    ...inferAreas(queryText).filter((area) => area !== "nao_classificado"),
  ]);
  const terms = buildRetrievalTerms(context);
  if (!terms.length && !requestedAreas.length) return [];

  const allowedLevels = context.allowedEvidenceLevels?.length
    ? new Set(context.allowedEvidenceLevels)
    : null;
  const minimumScore = options.minimumScore ?? 2;
  const topK = Math.max(1, Math.min(12, options.topK ?? 4));

  return chunks
    .filter((chunk) => !allowedLevels || allowedLevels.has(chunk.provenance.evidenceLevel))
    .map((chunk) => {
      const normalizedChunk = normalizeText(
        `${chunk.provenance.title} ${chunk.text} ${chunk.keywords.join(" ")}`
      );
      const matchedTerms = terms.filter((term) => normalizedChunk.includes(term));
      const matchedAreas = requestedAreas.filter((area) => chunk.areas.includes(area));
      let score = Math.min(6, matchedTerms.length);
      score += matchedAreas.length * 4;

      const ageText = normalizeText(context.ageBand);
      if (
        ageText &&
        chunk.areas.includes("desenvolvimento_infantil") &&
        /\b(0?[3-9]|1[01])\b/.test(ageText)
      ) {
        score += 2;
      }
      if (
        context.classNeeds?.some((need) => /inclus|acess|libras|surdo/i.test(need)) &&
        chunk.areas.some((area) => ["inclusao", "acessibilidade", "libras"].includes(area))
      ) {
        score += 3;
      }

      return { chunk, score, matchedTerms, matchedAreas };
    })
    .filter((item) => item.score >= minimumScore)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.chunk.id.localeCompare(right.chunk.id);
    })
    .slice(0, topK);
};

export const reconcileAcademicRecommendations = (params: {
  currentPlan: AcademicPlanSnapshot;
  previousReport?: AcademicReportEvidence | null;
  recommendations: AcademicPlanningRecommendation[];
}): AcademicReconciliationResult => {
  const recommendations = params.recommendations.map((recommendation) => {
    const confidence = clampConfidence(recommendation.confidence);
    if (confidence < 0.55) {
      return {
        ...recommendation,
        confidence,
        recommendation: "ignore" as const,
        reconciliationReason:
          "A recomendação acadêmica tem confiança insuficiente e não deve alterar o estado atual.",
      };
    }

    if (
      params.previousReport?.readiness === "not_mastered" &&
      recommendation.direction === "advance"
    ) {
      return {
        ...recommendation,
        confidence,
        recommendation: "keep_current" as const,
        reconciliationReason: `O histórico realizado tem prioridade: ${params.previousReport.evidence}`,
      };
    }

    return {
      ...recommendation,
      confidence,
      recommendation: "review" as const,
      reconciliationReason: params.currentPlan.confirmed
        ? "O planejamento confirmado foi preservado; a melhoria acadêmica exige revisão do professor."
        : "Conteúdo acadêmico é apoio e exige confirmação antes de compor o planejamento.",
    };
  });

  return {
    currentPlan: params.currentPlan,
    recommendations,
    warnings: [
      "Nenhuma recomendação acadêmica foi aplicada automaticamente.",
      ...(params.previousReport?.readiness === "not_mastered"
        ? ["Evidência realizada de não domínio foi priorizada."]
        : []),
    ],
  };
};

export const proposeAcademicTeacherMemory = (params: {
  userId: string;
  preference: string;
  evidenceChunkIds: string[];
  confidence: number;
}): AcademicTeacherMemoryProposal => {
  const userId = params.userId.trim();
  const preference = params.preference.trim();
  if (!userId) throw new Error("userId é obrigatório para propor memória global.");
  if (!preference) throw new Error("Preferência pedagógica não pode ser vazia.");
  if (!params.evidenceChunkIds.length) {
    throw new Error("A proposta de memória precisa preservar ao menos uma evidência.");
  }
  return {
    id: `academic_memory_${hashText(
      `${userId}|${preference}|${params.evidenceChunkIds.join("|")}`
    )}`,
    userId,
    preference,
    evidenceChunkIds: unique(params.evidenceChunkIds),
    confidence: clampConfidence(params.confidence),
    status: "pending_confirmation",
  };
};

export const confirmAcademicTeacherMemory = (
  proposal: AcademicTeacherMemoryProposal,
  decision: {
    confirmed: boolean;
    confirmedBy: string;
    confirmedAt: string;
  }
): {
  proposal: AcademicTeacherMemoryProposal;
  fact: ConfirmedAcademicTeacherFact | null;
} => {
  if (proposal.status !== "pending_confirmation") {
    throw new Error("A proposta de memória já foi decidida.");
  }
  const confirmedBy = decision.confirmedBy.trim();
  if (!confirmedBy) throw new Error("confirmedBy é obrigatório.");

  if (!decision.confirmed) {
    return {
      proposal: { ...proposal, status: "rejected" },
      fact: null,
    };
  }

  const confirmedProposal = { ...proposal, status: "confirmed" as const };
  return {
    proposal: confirmedProposal,
    fact: {
      id: `academic_fact_${hashText(`${proposal.id}|${decision.confirmedAt}`)}`,
      userId: proposal.userId,
      memoryScope: "user_global",
      factType: "coach_preference",
      content: { preference: proposal.preference },
      evidenceChunkIds: [...proposal.evidenceChunkIds],
      confidence: proposal.confidence,
      confirmedBy,
      confirmedAt: decision.confirmedAt,
    },
  };
};

export const toAppliedPedagogicalReference = (
  retrieved: AcademicRetrievedChunk,
  influence: string,
  appliedAt?: string
): AppliedPedagogicalReference => {
  const { chunk } = retrieved;
  const origin =
    [chunk.provenance.institution, chunk.provenance.author].filter(Boolean).join(" · ") ||
    chunk.provenance.filename;
  return {
    id: `applied_ref_${chunk.id}`,
    sourceDocumentId: chunk.provenance.sourceDocumentId,
    sourceRevisionId: chunk.provenance.sourceRevisionId,
    contentHash: chunk.provenance.contentHash,
    sourceScope: chunk.provenance.sourceScope.kind,
    title: chunk.provenance.title,
    origin,
    discipline:
      chunk.provenance.discipline === "unknown" ? undefined : chunk.provenance.discipline,
    materialType: chunk.provenance.materialType,
    evidenceLevel: chunk.provenance.evidenceLevel,
    sourceLocation: chunk.provenance.sourceLocation,
    excerpt: chunk.text.slice(0, 600),
    influence: influence.trim(),
    appliedAt,
  };
};

export const toAcademicReferencePresentation = (
  reference: AppliedPedagogicalReference
): AcademicReferencePresentation => ({
  id: reference.id,
  title: reference.title,
  origin: reference.origin,
  discipline: reference.discipline,
  materialType: reference.materialType,
  evidenceLevel: reference.evidenceLevel,
  sourceLocation: reference.sourceLocation,
  excerpt: reference.excerpt,
  influence: reference.influence,
});

export const resolveAcademicSupport = (params: {
  available: boolean;
  chunks: AcademicKnowledgeChunk[];
  context: AcademicRetrievalContext;
  topK?: number;
}): AcademicSupportResolution => {
  if (!params.available) {
    return {
      status: "unavailable",
      retrieved: [],
      warnings: [
        "Base acadêmica temporariamente indisponível; continuar com o contexto operacional.",
      ],
      canContinueWithoutAcademicSupport: true,
    };
  }

  const retrieved = retrieveAcademicChunks(params.chunks, params.context, {
    topK: params.topK,
  });
  if (!retrieved.length) {
    return {
      status: "no_relevant_content",
      retrieved: [],
      warnings: ["Nenhum trecho acadêmico relevante foi recuperado para este contexto."],
      canContinueWithoutAcademicSupport: true,
    };
  }

  return {
    status: "available",
    retrieved,
    warnings: [],
    canContinueWithoutAcademicSupport: true,
  };
};
