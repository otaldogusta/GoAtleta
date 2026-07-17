import {
  createEdgeFunction,
  createError,
  createSuccess,
} from "../_shared/framework.ts";
import {
  ACADEMIC_AREAS,
  ACADEMIC_EVIDENCE_KINDS,
  ACADEMIC_MATERIAL_TYPES,
  normalizeAcademicText,
  type AcademicArea,
  type AcademicEvidenceKind,
  type AcademicMaterialType,
} from "../_shared/academic-knowledge.ts";

type RetrievalRequest = {
  organizationId?: string;
  classId?: string;
  modality?: string;
  ageBand?: string;
  objective?: string;
  skill?: string;
  pedagogicalApproach?: string;
  situationProblem?: string;
  classNeed?: string;
  documentTypes?: string[];
  evidenceKinds?: string[];
  academicAreas?: string[];
  limit?: number;
};

type AcademicRow = {
  id?: string;
  source_document_id?: string;
  source_revision_id?: string;
  content_hash?: string;
  source_scope?: string;
  title?: string;
  discipline?: string;
  academic_area?: string;
  material_type?: string;
  evidence_kind?: string;
  author?: string;
  institution?: string;
  source_excerpt?: string;
  chunk?: string;
  source_location?: string;
  confidence?: number;
  similarity?: number;
  lexical_matches?: number;
  tags?: unknown;
};

const textValue = (value: unknown, max = 400) =>
  String(value ?? "").trim().slice(0, max);

const stringArray = (value: unknown, max = 12) =>
  Array.isArray(value)
    ? value
        .map((item) => textValue(item, 80))
        .filter(Boolean)
        .slice(0, max)
    : [];

const clampLimit = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.max(1, Math.min(Math.floor(parsed), 6));
};

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

const academicAreaSet = new Set<string>(ACADEMIC_AREAS);
const academicMaterialTypeSet = new Set<string>(ACADEMIC_MATERIAL_TYPES);
const academicEvidenceKindSet = new Set<string>(ACADEMIC_EVIDENCE_KINDS);

const taxonomyArray = <T extends string>(
  value: unknown,
  allowed: Set<string>,
  max = 12
) =>
  unique(stringArray(value, max)).filter((item): item is T => allowed.has(item));

const buildQueryText = (body: RetrievalRequest) =>
  unique([
    textValue(body.modality, 80),
    textValue(body.ageBand, 80),
    textValue(body.objective, 500),
    textValue(body.skill, 80),
    textValue(body.pedagogicalApproach, 120),
    textValue(body.situationProblem, 500),
    textValue(body.classNeed, 500),
  ]).join(" · ");

const embedQuery = async (queryText: string) => {
  const apiKey = textValue(Deno.env.get("OPENAI_API_KEY"), 500);
  if (!apiKey || !queryText) return null;
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: queryText,
      dimensions: 1536,
    }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    data?: { embedding?: number[] }[];
  };
  const embedding = payload.data?.[0]?.embedding;
  return Array.isArray(embedding) &&
    embedding.length === 1536 &&
    embedding.every(Number.isFinite)
    ? embedding
    : null;
};

const STOPWORDS = new Set([
  "aula",
  "aluno",
  "alunos",
  "anos",
  "como",
  "com",
  "das",
  "dos",
  "para",
  "pela",
  "pelo",
  "que",
  "sem",
  "turma",
  "uma",
]);

const tokenize = (value: string) =>
  unique(
    normalizeAcademicText(value)
      .replace(/[_/-]+/g, " ")
      .split(" ")
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
  );

const lexicalScore = (row: AcademicRow, queryText: string) => {
  const queryTokens = tokenize(queryText);
  if (!queryTokens.length) return { score: 0, matches: 0 };
  const haystackTokens = new Set(
    tokenize(
    [
      row.title,
      row.discipline,
      row.academic_area,
      row.material_type,
      row.evidence_kind,
      row.source_excerpt,
      row.chunk,
      Array.isArray(row.tags) ? row.tags.join(" ") : "",
    ].join(" ")
    )
  );
  const matches = queryTokens.filter((token) => haystackTokens.has(token)).length;
  return {
    score: matches / queryTokens.length,
    matches,
  };
};

const influenceForArea = (area: string) => {
  const normalized = normalizeAcademicText(area);
  if (normalized.includes("avaliacao")) {
    return "Apoiou critérios observáveis de acompanhamento e avaliação.";
  }
  if (
    normalized.includes("inclusao") ||
    normalized.includes("acessibilidade") ||
    normalized.includes("libras")
  ) {
    return "Apoiou adaptações de participação, inclusão e acessibilidade.";
  }
  if (
    normalized.includes("didatica") ||
    normalized.includes("metodolog") ||
    normalized.includes("abordagens")
  ) {
    return "Apoiou a situação-problema, a organização e as intervenções da aula.";
  }
  if (
    normalized.includes("infantil") ||
    normalized.includes("desenvolvimento")
  ) {
    return "Apoiou a adequação da linguagem e da tarefa à faixa etária.";
  }
  if (
    normalized.includes("politicas") ||
    normalized.includes("legislacao")
  ) {
    return "Apoiou cuidados pedagógicos e normativos aplicáveis ao contexto.";
  }
  return "Apoiou a redação e a justificativa pedagógica do plano.";
};

const toReference = (row: AcademicRow) => {
  const title = textValue(row.title, 260) || "Material acadêmico";
  const origin =
    [textValue(row.institution, 180), textValue(row.author, 180)]
      .filter(Boolean)
      .join(" · ") ||
    textValue(row.discipline, 180) ||
    title;
  return {
    id: textValue(row.id, 180),
    sourceDocumentId: textValue(row.source_document_id, 180),
    sourceRevisionId: textValue(row.source_revision_id, 180) || undefined,
    contentHash: textValue(row.content_hash, 80) || undefined,
    sourceScope: "user_academic",
    title,
    origin,
    discipline: textValue(row.discipline, 180) || undefined,
    materialType: textValue(row.material_type, 80) || "unknown",
    evidenceLevel: textValue(row.evidence_kind, 80) || "unknown_support",
    sourceLocation: textValue(row.source_location, 260) || undefined,
    excerpt: textValue(row.source_excerpt || row.chunk, 900),
    influence: influenceForArea(textValue(row.academic_area, 80)),
  };
};

Deno.serve(
  createEdgeFunction<RetrievalRequest>({
    name: "academic-knowledge-retrieve",
    requireAuth: true,
    parseJson: true,
    handler: async ({ user, body, supabase }) => {
      if (!user) return createError(401, "UNAUTHORIZED", "Sessão inválida.");
      const organizationId = textValue(body?.organizationId, 128);
      if (!organizationId) {
        return createError(
          400,
          "BAD_REQUEST",
          "organizationId é obrigatório."
        );
      }

      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("role_level")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (
        membershipError ||
        !membership ||
        Number(membership.role_level ?? 0) < 10
      ) {
        return createError(
          403,
          "FORBIDDEN",
          "Usuário sem perfil de professor neste workspace."
        );
      }

      const classId = textValue(body?.classId, 128);
      if (classId) {
        const { data: scopedClass, error: classScopeError } = await supabase
          .from("classes")
          .select("id")
          .eq("id", classId)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (classScopeError || !scopedClass) {
          return createError(
            403,
            "INVALID_CLASS_SCOPE",
            "Turma fora do workspace atual."
          );
        }
      }

      const academicAreas = taxonomyArray<AcademicArea>(
        body?.academicAreas,
        academicAreaSet
      );
      const evidenceKinds = taxonomyArray<AcademicEvidenceKind>(
        body?.evidenceKinds,
        academicEvidenceKindSet
      );
      const documentTypes = taxonomyArray<AcademicMaterialType>(
        body?.documentTypes,
        academicMaterialTypeSet
      );
      const contextualQueryText = buildQueryText(body ?? {});
      const queryText =
        contextualQueryText || academicAreas.map((area) => area.replace(/_/g, " ")).join(" ");
      if (!queryText) {
        return createSuccess({
          status: "ready",
          references: [],
          reason: "empty_context",
        });
      }

      const matchCount = clampLimit(body?.limit);
      const minimumLexicalMatches = Math.min(
        2,
        Math.max(1, tokenize(queryText).length)
      );
      const queryEmbedding = await embedQuery(queryText);
      let retrievalMode: "semantic" | "lexical_fallback" = queryEmbedding
        ? "semantic"
        : "lexical_fallback";
      const rpcMatchCount = documentTypes.length
        ? Math.min(20, Math.max(matchCount * 4, matchCount))
        : matchCount;

      let rows: AcademicRow[] = [];
      const { data: matched, error: matchError } = await supabase.rpc(
        "match_academic_knowledge",
        {
          _organization_id: organizationId,
          _owner_user_id: user.id,
          _query_embedding: queryEmbedding,
          _query_text: queryText,
          _academic_areas: academicAreas.length ? academicAreas : null,
          _evidence_kinds: evidenceKinds.length ? evidenceKinds : null,
          _match_count: rpcMatchCount,
        }
      );

      if (!matchError && Array.isArray(matched)) {
        rows = matched as AcademicRow[];
        if (!queryEmbedding) {
          rows = rows
            .map((row) => {
              const lexical = lexicalScore(row, queryText);
              return {
                ...row,
                similarity: lexical.score,
                lexical_matches: lexical.matches,
              };
            })
            .filter(
              (row) =>
                Number(row.lexical_matches ?? 0) >= minimumLexicalMatches
            );
        }
      } else {
        retrievalMode = "lexical_fallback";
        let fallback = supabase
          .from("kb_documents")
          .select(
            "id, source_document_id, source_revision_id, content_hash, source_scope, title, discipline, academic_area, material_type, evidence_kind, author, institution, source_excerpt, chunk, source_location, confidence, tags"
          )
          .eq("organization_id", organizationId)
          .eq("owner_user_id", user.id)
          .eq("source_scope", "user_academic")
          .eq("available", true)
          .is("class_id", null)
          .limit(120);
        if (academicAreas.length) {
          fallback = fallback.in("academic_area", academicAreas);
        }
        if (evidenceKinds.length) {
          fallback = fallback.in("evidence_kind", evidenceKinds);
        }
        if (documentTypes.length) {
          fallback = fallback.in("material_type", documentTypes);
        }
        const { data: fallbackRows, error: fallbackError } = await fallback;
        if (fallbackError) {
          return createSuccess({
            status: "unavailable",
            references: [],
            reason: "academic_base_unavailable",
          });
        }
        rows = ((fallbackRows ?? []) as AcademicRow[])
          .map((row) => {
            const lexical = lexicalScore(row, queryText);
            return {
              ...row,
              similarity: lexical.score,
              lexical_matches: lexical.matches,
            };
          })
          .filter((row) => {
            return (
              Number(row.lexical_matches ?? 0) >= minimumLexicalMatches
            );
          })
          .sort(
            (left, right) =>
              Number(right.similarity ?? 0) - Number(left.similarity ?? 0)
          )
          .slice(0, matchCount);
      }

      const references = rows
        .filter(
          (row) =>
            !documentTypes.length ||
            documentTypes.includes(row.material_type as AcademicMaterialType)
        )
        .filter((row) => textValue(row.source_excerpt || row.chunk, 900))
        .filter((row) => {
          if (retrievalMode === "lexical_fallback") {
            return (
              Number(row.lexical_matches ?? 0) >= minimumLexicalMatches
            );
          }
          return Number(row.similarity ?? 0) >= 0.25;
        })
        .slice(0, matchCount)
        .map(toReference);

      return createSuccess({
        status: "ready",
        sourceScope: "user_academic",
        classBindingCreated: false,
        references,
        retrieval: {
          mode: retrievalMode,
          requested: matchCount,
          returned: references.length,
        },
      });
    },
  })
);
