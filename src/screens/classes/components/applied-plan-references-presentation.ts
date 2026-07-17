export type AppliedPlanReferenceInput = {
  id?: string | null;
  sourceDocumentId?: string | null;
  sourceRevisionId?: string | null;
  contentHash?: string | null;
  sourceScope?: string | null;
  title?: string | null;
  documentTitle?: string | null;
  origin?: string | null;
  discipline?: string | null;
  materialType?: string | null;
  sourceKind?: string | null;
  evidenceLevel?: string | null;
  documentType?: string | null;
  sourceDate?: string | null;
  confidence?: number | null;
  period?: string | null;
  isPrimaryPlanningSource?: boolean | null;
  sourceLocation?: string | null;
  excerpt?: string | null;
  sourceText?: string | null;
  influence?: string | null;
  appliedAt?: string | null;
};

export type AppliedPlanReferencePresentation = {
  id: string;
  title: string;
  originLabel: string;
  scopeLabel: string;
  materialTypeLabel: string;
  evidenceLevelLabel: string;
  documentType: string;
  sourceDateLabel: string;
  confidenceLabel: string;
  periodLabel: string;
  isPrimaryPlanningSource: boolean;
  sourceLocation: string;
  excerpt: string;
  influence: string;
};

const cleanText = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeKey = (value: unknown) =>
  cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const humanizeKey = (value: unknown, fallback: string) => {
  const text = cleanText(value);
  if (!text) return fallback;
  if (/[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]/.test(text.slice(1))) return text;
  const normalized = text.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase()
    : fallback;
};

const SOURCE_SCOPE_LABELS: Record<string, string> = {
  user_academic: "Base acadêmica pessoal",
  system_academic: "Apoio pedagógico GoAtleta",
  workspace_academic: "Base acadêmica da organização",
  institutional: "Base institucional",
  class_planning: "Planejamento da turma",
  realized_history: "Histórico realizado",
  periodization: "Periodização da turma",
  scientific: "Fonte científica",
  system_general: "Base geral do sistema",
  // Read compatibility for snapshots created before the canonical contract.
  academic: "Base acadêmica pessoal",
  academic_personal: "Base acadêmica pessoal",
  personal_academic: "Base acadêmica pessoal",
  workspace: "Base institucional",
  workspace_institutional: "Base institucional",
  class_plan: "Planejamento da turma",
  planning: "Planejamento da turma",
  class_history: "Histórico realizado",
  report: "Histórico realizado",
  history: "Histórico realizado",
  scientific_reference: "Fonte científica",
};

const MATERIAL_TYPE_LABELS: Record<string, string> = {
  official_norm: "Norma oficial",
  scientific_article: "Artigo científico",
  book_or_chapter: "Livro ou capítulo",
  university_handout: "Material institucional da universidade",
  lecture_presentation: "Apresentação de aula",
  student_summary: "Resumo produzido pelo estudante",
  personal_note: "Anotação pessoal",
  monthly_plan: "Planejamento mensal",
  lesson_plan: "Plano de aula",
  realized_report: "Relatório realizado",
  institutional_actions: "Orientações da turma",
  unknown: "Material acadêmico de apoio",
  // Read compatibility for snapshots created before the canonical contract.
  official_regulation: "Legislação ou norma oficial",
  regulation: "Legislação ou norma oficial",
  article: "Artigo científico",
  paper: "Artigo científico",
  book: "Livro",
  book_chapter: "Livro ou capítulo",
  university_material: "Material institucional da universidade",
  institutional_university: "Material institucional da universidade",
  class_material: "Material de aula",
  presentation: "Apresentação ou material de aula",
  academic_support: "Material acadêmico de apoio",
};

const EVIDENCE_LEVEL_LABELS: Record<string, string> = {
  official_norm: "Norma oficial",
  scientific_research: "Pesquisa científica",
  published_book: "Livro publicado",
  institutional_academic_material: "Material acadêmico institucional",
  classroom_academic_material: "Material acadêmico de aula",
  student_authored_summary: "Resumo autoral do estudante",
  personal_note: "Anotação pessoal",
  confirmed_plan: "Planejamento confirmado",
  realized_report: "Evidência realizada",
  institutional_guidance: "Orientação institucional",
  contextual_support: "Contexto relacionado",
  unknown_support: "Apoio sem classificação",
  // Read compatibility for snapshots created before the canonical contract.
  official: "Fonte oficial",
  mandatory: "Fonte obrigatória",
  scientific: "Evidência científica",
  peer_reviewed: "Revisado por pares",
  academic_support: "Apoio acadêmico",
  support: "Apoio acadêmico",
  unverified: "Qualidade não identificada",
  unknown: "Qualidade não identificada",
  a_meta_analysis: "Meta-análise",
  b_consensus: "Consenso",
  c_cohort: "Estudo de coorte",
  d_expert_opinion: "Opinião especializada",
};

const resolveOriginLabel = (reference: AppliedPlanReferenceInput) => {
  const origin = cleanText(reference.origin);
  const discipline = cleanText(reference.discipline);
  if (!origin && !discipline) return "Origem não informada";
  if (!origin) return discipline;
  if (!discipline || normalizeKey(origin) === normalizeKey(discipline)) return origin;
  return `${origin} · ${discipline}`;
};

const formatSourceDate = (value: unknown) => {
  const text = cleanText(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
};

const formatPeriod = (value: unknown) => {
  const text = cleanText(value);
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match) return text;
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const month = monthNames[Number(match[2]) - 1];
  return month ? `${month} de ${match[1]}` : text;
};

const formatConfidence = (value: unknown) => {
  const confidence = Number(value);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return "";
  if (confidence >= 0.85) return "Confiança alta";
  if (confidence >= 0.65) return "Confiança moderada";
  return "Revisão recomendada";
};

export function buildAppliedPlanReferencesPresentation(
  references: readonly AppliedPlanReferenceInput[] | null | undefined
) {
  const items = (references ?? []).map<AppliedPlanReferencePresentation>((reference, index) => {
    const sourceDocumentId = cleanText(reference.sourceDocumentId);
    const id = cleanText(reference.id) || sourceDocumentId || `applied-reference-${index + 1}`;
    const sourceScopeKey = normalizeKey(reference.sourceScope);
    const materialTypeValue = reference.materialType ?? reference.sourceKind;
    const materialTypeKey = normalizeKey(materialTypeValue);
    const evidenceLevelKey = normalizeKey(reference.evidenceLevel);

    return {
      id,
      title:
        cleanText(reference.title ?? reference.documentTitle) ||
        `Referência aplicada ${index + 1}`,
      originLabel: resolveOriginLabel(reference),
      scopeLabel:
        SOURCE_SCOPE_LABELS[sourceScopeKey] ??
        humanizeKey(reference.sourceScope, "Contexto de apoio"),
      materialTypeLabel:
        MATERIAL_TYPE_LABELS[materialTypeKey] ??
        humanizeKey(materialTypeValue, "Material acadêmico de apoio"),
      evidenceLevelLabel:
        EVIDENCE_LEVEL_LABELS[evidenceLevelKey] ??
        humanizeKey(reference.evidenceLevel, "Qualidade não identificada"),
      documentType: normalizeKey(reference.documentType),
      sourceDateLabel: formatSourceDate(reference.sourceDate),
      confidenceLabel: formatConfidence(reference.confidence),
      periodLabel: formatPeriod(reference.period),
      isPrimaryPlanningSource:
        reference.isPrimaryPlanningSource === true ||
        (sourceScopeKey === "class_planning" &&
          normalizeKey(reference.documentType) === "monthly_plan"),
      sourceLocation: cleanText(reference.sourceLocation),
      excerpt: cleanText(reference.excerpt ?? reference.sourceText),
      influence: cleanText(reference.influence),
    };
  });

  return {
    items,
    countLabel: `${items.length} ${items.length === 1 ? "referência considerada" : "referências consideradas"}`,
    planningSource:
      items.find((item) => item.isPrimaryPlanningSource) ??
      items.find((item) => item.documentType === "monthly_plan") ??
      null,
  };
}
