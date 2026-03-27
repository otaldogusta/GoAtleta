import type {
  KnowledgeBaseDomain,
  KnowledgeBaseVersion,
  KnowledgeBaseVersionStatus,
  KnowledgeRule,
  KnowledgeRuleCitation,
  KnowledgeRuleKind,
  KnowledgeRuleStatus,
  KnowledgeSource,
  KnowledgeSourceType,
  WeeklyAutopilotKnowledgeContext,
  WeeklyAutopilotKnowledgeReference,
} from "../core/models";
import {
  getActiveOrganizationId,
  isAuthError,
  isMissingRelation,
  isNetworkError,
  supabaseDelete,
  supabaseGet,
  supabasePost,
} from "./client";
import type {
  KnowledgeBaseVersionRow,
  KnowledgeRuleCitationRow,
  KnowledgeRuleRow,
  KnowledgeSourceRow,
} from "./row-types";

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const normalizeText = (value: string | null | undefined) => String(value ?? "").trim();

const normalizeDomain = (value: string | null | undefined): KnowledgeBaseDomain => {
  const normalized = normalizeText(value);
  if (normalized === "youth_training") return "youth_training";
  if (normalized === "general_fitness") return "general_fitness";
  if (normalized === "clinical") return "clinical";
  if (normalized === "performance") return "performance";
  return "general";
};

const normalizeVersionStatus = (value: string | null | undefined): KnowledgeBaseVersionStatus => {
  const normalized = normalizeText(value);
  if (normalized === "review") return "review";
  if (normalized === "active") return "active";
  if (normalized === "archived") return "archived";
  return "draft";
};

const normalizeSourceType = (value: string | null | undefined): KnowledgeSourceType => {
  const normalized = normalizeText(value);
  if (normalized === "guideline") return "guideline";
  if (normalized === "book") return "book";
  if (normalized === "paper") return "paper";
  if (normalized === "web") return "web";
  if (normalized === "policy") return "policy";
  return "other";
};

const normalizeRuleStatus = (value: string | null | undefined): KnowledgeRuleStatus => {
  const normalized = normalizeText(value);
  if (normalized === "review") return "review";
  if (normalized === "active") return "active";
  if (normalized === "archived") return "archived";
  return "draft";
};

const normalizeRuleKind = (value: string | null | undefined): KnowledgeRuleKind => {
  const normalized = normalizeText(value);
  if (normalized === "progression") return "progression";
  if (normalized === "safety") return "safety";
  if (normalized === "assessment") return "assessment";
  if (normalized === "recovery") return "recovery";
  if (normalized === "reference") return "reference";
  return "recommendation";
};

const toPayload = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const mapVersionRow = (row: KnowledgeBaseVersionRow): KnowledgeBaseVersion => ({
  id: row.id,
  organizationId: row.organization_id ?? "",
  domain: normalizeDomain(row.domain),
  versionLabel: normalizeText(row.version_label),
  description: normalizeText(row.description),
  status: normalizeVersionStatus(row.status),
  publishedAt: row.published_at ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapSourceRow = (row: KnowledgeSourceRow): KnowledgeSource => ({
  id: row.id,
  organizationId: row.organization_id ?? "",
  knowledgeBaseVersionId: row.knowledge_base_version_id,
  domain: normalizeDomain(row.domain),
  title: normalizeText(row.title),
  authors: normalizeText(row.authors),
  sourceYear: row.source_year ?? null,
  edition: normalizeText(row.edition),
  sourceType: normalizeSourceType(row.source_type),
  sourceUrl: normalizeText(row.source_url),
  citationText: normalizeText(row.citation_text),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRuleRow = (row: KnowledgeRuleRow): KnowledgeRule => ({
  id: row.id,
  organizationId: row.organization_id ?? "",
  knowledgeBaseVersionId: row.knowledge_base_version_id,
  domain: normalizeDomain(row.domain),
  ruleKey: normalizeText(row.rule_key),
  ruleLabel: normalizeText(row.rule_label),
  ruleKind: normalizeRuleKind(row.rule_kind),
  status: normalizeRuleStatus(row.status),
  payload: toPayload(row.payload),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapCitationRow = (row: KnowledgeRuleCitationRow): KnowledgeRuleCitation => ({
  id: row.id,
  organizationId: row.organization_id ?? "",
  knowledgeRuleId: row.knowledge_rule_id,
  knowledgeSourceId: row.knowledge_source_id ?? null,
  kbDocumentId: row.kb_document_id ?? null,
  pages: normalizeText(row.pages),
  evidence: normalizeText(row.evidence),
  notes: normalizeText(row.notes),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const pickRuleHighlight = (rule: KnowledgeRule) => {
  const payload = rule.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    for (const key of ["summary", "recommendation", "description", "note", "text", "title"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (Array.isArray(value)) {
        const items = value.map((item) => String(item ?? "").trim()).filter(Boolean);
        if (items.length) return items.join(", ");
      }
    }
  }
  return rule.ruleLabel || rule.ruleKey;
};

const mapSourceToReference = (source: KnowledgeSource): WeeklyAutopilotKnowledgeReference => ({
  sourceId: source.id,
  title: source.title,
  authors: source.authors,
  sourceYear: source.sourceYear ?? null,
  sourceType: source.sourceType,
  citationText: source.citationText || source.title,
  url: source.sourceUrl,
});

const buildVersionId = (organizationId: string, domain: string, versionLabel: string) =>
  `kbv_${hashString(`${organizationId}|${domain}|${versionLabel}`)}`;

const buildSourceId = (
  organizationId: string,
  knowledgeBaseVersionId: string,
  title: string,
  sourceUrl: string
) => `kbs_${hashString(`${organizationId}|${knowledgeBaseVersionId}|${title}|${sourceUrl}`)}`;

const buildRuleId = (
  organizationId: string,
  knowledgeBaseVersionId: string,
  ruleKey: string
) => `kbr_${hashString(`${organizationId}|${knowledgeBaseVersionId}|${ruleKey}`)}`;

const buildCitationId = (
  organizationId: string,
  knowledgeRuleId: string,
  knowledgeSourceId: string,
  kbDocumentId: string,
  pages: string
) => `kbc_${hashString(`${organizationId}|${knowledgeRuleId}|${knowledgeSourceId}|${kbDocumentId}|${pages}`)}`;

export async function getKnowledgeBaseVersions(options: {
  organizationId?: string | null;
  domain?: KnowledgeBaseDomain | null;
} = {}): Promise<KnowledgeBaseVersion[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    if (!organizationId) return [];
    const domain = options.domain?.trim();
    const path =
      `/knowledge_base_versions?select=*&organization_id=eq.${encodeURIComponent(organizationId)}` +
      (domain ? `&domain=eq.${encodeURIComponent(domain)}` : "") +
      "&order=updated_at.desc";
    const rows = await supabaseGet<KnowledgeBaseVersionRow[]>(path);
    return rows.map(mapVersionRow);
  } catch (error) {
    if (isMissingRelation(error, "knowledge_base_versions")) return [];
    if (isAuthError(error) || isNetworkError(error)) return [];
    return [];
  }
}

export async function getActiveKnowledgeBaseVersion(options: {
  organizationId?: string | null;
  domain?: KnowledgeBaseDomain | null;
} = {}) {
  const versions = await getKnowledgeBaseVersions(options);
  return versions.find((version) => version.status === "active") ?? versions[0] ?? null;
}

export async function upsertKnowledgeBaseVersion(params: {
  organizationId?: string | null;
  domain: KnowledgeBaseDomain;
  versionLabel: string;
  description?: string;
  status?: KnowledgeBaseVersionStatus;
  publishedAt?: string | null;
}) {
  const organizationId = params.organizationId ?? (await getActiveOrganizationId());
  if (!organizationId) return null;
  const domain = normalizeDomain(params.domain);
  const versionLabel = normalizeText(params.versionLabel);
  if (!versionLabel) return null;
  const nowIso = new Date().toISOString();
  const payload = {
    id: buildVersionId(organizationId, domain, versionLabel),
    organization_id: organizationId,
    domain,
    version_label: versionLabel,
    description: normalizeText(params.description),
    status: normalizeVersionStatus(params.status),
    published_at: params.publishedAt ?? null,
    created_at: nowIso,
    updated_at: nowIso,
  };
  try {
    const rows = await supabasePost<KnowledgeBaseVersionRow[]>(
      "/knowledge_base_versions?on_conflict=organization_id,domain,version_label",
      [payload],
      { Prefer: "resolution=merge-duplicates,return=representation" }
    );
    const row = rows[0] ?? {
      ...payload,
      published_at: payload.published_at,
    };
    return mapVersionRow(row);
  } catch (error) {
    if (isMissingRelation(error, "knowledge_base_versions")) return null;
    if (isAuthError(error) || isNetworkError(error)) throw error;
    throw error;
  }
}

export async function getKnowledgeSources(options: {
  organizationId?: string | null;
  knowledgeBaseVersionId?: string | null;
} = {}): Promise<KnowledgeSource[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    if (!organizationId) return [];
    const versionId = options.knowledgeBaseVersionId?.trim();
    if (!versionId) return [];
    const rows = await supabaseGet<KnowledgeSourceRow[]>(
      `/knowledge_sources?select=*&organization_id=eq.${encodeURIComponent(organizationId)}` +
        `&knowledge_base_version_id=eq.${encodeURIComponent(versionId)}` +
        "&order=title.asc"
    );
    return rows.map(mapSourceRow);
  } catch (error) {
    if (isMissingRelation(error, "knowledge_sources")) return [];
    if (isAuthError(error) || isNetworkError(error)) return [];
    return [];
  }
}

export async function upsertKnowledgeSource(params: {
  organizationId?: string | null;
  knowledgeBaseVersionId: string;
  domain?: KnowledgeBaseDomain;
  title: string;
  authors?: string;
  sourceYear?: number | null;
  edition?: string;
  sourceType?: KnowledgeSourceType;
  sourceUrl?: string;
  citationText?: string;
}) {
  const organizationId = params.organizationId ?? (await getActiveOrganizationId());
  if (!organizationId) return null;
  const knowledgeBaseVersionId = normalizeText(params.knowledgeBaseVersionId);
  const title = normalizeText(params.title);
  if (!knowledgeBaseVersionId || !title) return null;
  const sourceUrl = normalizeText(params.sourceUrl);
  const domain = normalizeDomain(params.domain);
  const nowIso = new Date().toISOString();
  const payload = {
    id: buildSourceId(organizationId, knowledgeBaseVersionId, title, sourceUrl),
    organization_id: organizationId,
    knowledge_base_version_id: knowledgeBaseVersionId,
    domain,
    title,
    authors: normalizeText(params.authors),
    source_year: params.sourceYear ?? null,
    edition: normalizeText(params.edition),
    source_type: normalizeSourceType(params.sourceType),
    source_url: sourceUrl,
    citation_text: normalizeText(params.citationText),
    created_at: nowIso,
    updated_at: nowIso,
  };
  try {
    const rows = await supabasePost<KnowledgeSourceRow[]>(
      "/knowledge_sources?on_conflict=knowledge_base_version_id,title,source_url",
      [payload],
      { Prefer: "resolution=merge-duplicates,return=representation" }
    );
    const row = rows[0] ?? payload;
    return mapSourceRow(row);
  } catch (error) {
    if (isMissingRelation(error, "knowledge_sources")) return null;
    if (isAuthError(error) || isNetworkError(error)) throw error;
    throw error;
  }
}

export async function getKnowledgeRules(options: {
  organizationId?: string | null;
  knowledgeBaseVersionId?: string | null;
} = {}): Promise<KnowledgeRule[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    if (!organizationId) return [];
    const versionId = options.knowledgeBaseVersionId?.trim();
    if (!versionId) return [];
    const rows = await supabaseGet<KnowledgeRuleRow[]>(
      `/knowledge_rules?select=*&organization_id=eq.${encodeURIComponent(organizationId)}` +
        `&knowledge_base_version_id=eq.${encodeURIComponent(versionId)}` +
        "&order=rule_key.asc"
    );
    return rows.map(mapRuleRow);
  } catch (error) {
    if (isMissingRelation(error, "knowledge_rules")) return [];
    if (isAuthError(error) || isNetworkError(error)) return [];
    return [];
  }
}

export async function upsertKnowledgeRule(params: {
  organizationId?: string | null;
  knowledgeBaseVersionId: string;
  domain?: KnowledgeBaseDomain;
  ruleKey: string;
  ruleLabel?: string;
  ruleKind?: KnowledgeRuleKind;
  status?: KnowledgeRuleStatus;
  payload?: Record<string, unknown>;
}) {
  const organizationId = params.organizationId ?? (await getActiveOrganizationId());
  if (!organizationId) return null;
  const knowledgeBaseVersionId = normalizeText(params.knowledgeBaseVersionId);
  const ruleKey = normalizeText(params.ruleKey);
  if (!knowledgeBaseVersionId || !ruleKey) return null;
  const domain = normalizeDomain(params.domain);
  const nowIso = new Date().toISOString();
  const payload = {
    id: buildRuleId(organizationId, knowledgeBaseVersionId, ruleKey),
    organization_id: organizationId,
    knowledge_base_version_id: knowledgeBaseVersionId,
    domain,
    rule_key: ruleKey,
    rule_label: normalizeText(params.ruleLabel),
    rule_kind: normalizeRuleKind(params.ruleKind),
    status: normalizeRuleStatus(params.status),
    payload: params.payload ?? {},
    created_at: nowIso,
    updated_at: nowIso,
  };
  try {
    const rows = await supabasePost<KnowledgeRuleRow[]>(
      "/knowledge_rules?on_conflict=knowledge_base_version_id,rule_key",
      [payload],
      { Prefer: "resolution=merge-duplicates,return=representation" }
    );
    const row = rows[0] ?? payload;
    return mapRuleRow(row);
  } catch (error) {
    if (isMissingRelation(error, "knowledge_rules")) return null;
    if (isAuthError(error) || isNetworkError(error)) throw error;
    throw error;
  }
}

export async function getKnowledgeRuleCitations(options: {
  organizationId?: string | null;
  knowledgeRuleId?: string | null;
} = {}): Promise<KnowledgeRuleCitation[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    if (!organizationId) return [];
    const ruleId = options.knowledgeRuleId?.trim();
    if (!ruleId) return [];
    const rows = await supabaseGet<KnowledgeRuleCitationRow[]>(
      `/knowledge_rule_citations?select=*&organization_id=eq.${encodeURIComponent(organizationId)}` +
        `&knowledge_rule_id=eq.${encodeURIComponent(ruleId)}` +
        "&order=created_at.asc"
    );
    return rows.map(mapCitationRow);
  } catch (error) {
    if (isMissingRelation(error, "knowledge_rule_citations")) return [];
    if (isAuthError(error) || isNetworkError(error)) return [];
    return [];
  }
}

export async function getKnowledgeBaseSnapshot(options: {
  organizationId?: string | null;
  domain?: KnowledgeBaseDomain | null;
} = {}): Promise<WeeklyAutopilotKnowledgeContext | null> {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  if (!organizationId) return null;

  const version = await getActiveKnowledgeBaseVersion({
    organizationId,
    domain: options.domain ?? null,
  });
  if (!version) return null;

  const [sources, rules] = await Promise.all([
    getKnowledgeSources({
      organizationId,
      knowledgeBaseVersionId: version.id,
    }),
    getKnowledgeRules({
      organizationId,
      knowledgeBaseVersionId: version.id,
    }),
  ]);

  return {
    versionId: version.id,
    versionLabel: version.versionLabel,
    domain: version.domain,
    references: sources.slice(0, 5).map(mapSourceToReference),
    ruleHighlights: rules
      .filter((rule) => rule.status === "active")
      .slice(0, 3)
      .map(pickRuleHighlight),
  };
}

export async function upsertKnowledgeRuleCitation(params: {
  organizationId?: string | null;
  knowledgeRuleId: string;
  knowledgeSourceId?: string | null;
  kbDocumentId?: string | null;
  pages?: string;
  evidence?: string;
  notes?: string;
}) {
  const organizationId = params.organizationId ?? (await getActiveOrganizationId());
  if (!organizationId) return null;
  const knowledgeRuleId = normalizeText(params.knowledgeRuleId);
  if (!knowledgeRuleId) return null;
  const knowledgeSourceId = normalizeText(params.knowledgeSourceId);
  const kbDocumentId = normalizeText(params.kbDocumentId);
  const pages = normalizeText(params.pages);
  const nowIso = new Date().toISOString();
  const payload = {
    id: buildCitationId(
      organizationId,
      knowledgeRuleId,
      knowledgeSourceId,
      kbDocumentId,
      pages
    ),
    organization_id: organizationId,
    knowledge_rule_id: knowledgeRuleId,
    knowledge_source_id: knowledgeSourceId || null,
    kb_document_id: kbDocumentId || null,
    pages,
    evidence: normalizeText(params.evidence),
    notes: normalizeText(params.notes),
    created_at: nowIso,
    updated_at: nowIso,
  };
  try {
    const rows = await supabasePost<KnowledgeRuleCitationRow[]>(
      "/knowledge_rule_citations?on_conflict=knowledge_rule_id,knowledge_source_id,kb_document_id,pages",
      [payload],
      { Prefer: "resolution=merge-duplicates,return=representation" }
    );
    const row = rows[0] ?? payload;
    return mapCitationRow(row);
  } catch (error) {
    if (isMissingRelation(error, "knowledge_rule_citations")) return null;
    if (isAuthError(error) || isNetworkError(error)) throw error;
    throw error;
  }
}

export async function deleteKnowledgeBaseVersion(
  versionId: string,
  options: { organizationId?: string | null } = {}
) {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  if (!organizationId || !versionId.trim()) return;
  await supabaseDelete(
    `/knowledge_base_versions?id=eq.${encodeURIComponent(versionId)}` +
      `&organization_id=eq.${encodeURIComponent(organizationId)}`
  );
}

export async function deleteKnowledgeSource(
  sourceId: string,
  options: { organizationId?: string | null } = {}
) {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  if (!organizationId || !sourceId.trim()) return;
  await supabaseDelete(
    `/knowledge_sources?id=eq.${encodeURIComponent(sourceId)}` +
      `&organization_id=eq.${encodeURIComponent(organizationId)}`
  );
}

export async function deleteKnowledgeRule(
  ruleId: string,
  options: { organizationId?: string | null } = {}
) {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  if (!organizationId || !ruleId.trim()) return;
  await supabaseDelete(
    `/knowledge_rules?id=eq.${encodeURIComponent(ruleId)}` +
      `&organization_id=eq.${encodeURIComponent(organizationId)}`
  );
}

export async function deleteKnowledgeRuleCitation(
  citationId: string,
  options: { organizationId?: string | null } = {}
) {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  if (!organizationId || !citationId.trim()) return;
  await supabaseDelete(
    `/knowledge_rule_citations?id=eq.${encodeURIComponent(citationId)}` +
      `&organization_id=eq.${encodeURIComponent(organizationId)}`
  );
}
