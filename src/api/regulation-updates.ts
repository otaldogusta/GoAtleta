import { supabaseRestPost } from "./rest";

type RegulationUpdateRow = {
  id: string;
  organization_id: string;
  rule_set_id: string;
  source_id: string;
  document_id: string;
  published_at: string | null;
  changed_topics: string[] | null;
  diff_summary: string;
  source_url: string;
  checksum_sha256: string;
  status: "detected" | "published";
  created_at: string;
  source_label: string;
  source_authority: string;
  read_at: string | null;
  is_read: boolean;
};

export type RegulationUpdate = {
  id: string;
  organizationId: string;
  ruleSetId: string;
  sourceId: string;
  documentId: string;
  publishedAt: string | null;
  changedTopics: string[];
  diffSummary: string;
  sourceUrl: string;
  checksumSha256: string;
  status: "detected" | "published";
  createdAt: string;
  sourceLabel: string;
  sourceAuthority: string;
  readAt: string | null;
  isRead: boolean;
  title: string;
};

export type ListRegulationUpdatesParams = {
  organizationId: string;
  unreadOnly?: boolean;
  limit?: number;
  cursor?: string | null;
};

export type ListRegulationUpdatesResult = {
  items: RegulationUpdate[];
  nextCursor: string | null;
};

const mapRow = (row: RegulationUpdateRow): RegulationUpdate => {
  const authority = String(row.source_authority ?? "OUTRO").trim() || "OUTRO";
  const sourceLabel = String(row.source_label ?? "").trim() || "Fonte";
  return {
    id: row.id,
    organizationId: row.organization_id,
    ruleSetId: row.rule_set_id,
    sourceId: row.source_id,
    documentId: row.document_id,
    publishedAt: row.published_at,
    changedTopics: Array.isArray(row.changed_topics) ? row.changed_topics : [],
    diffSummary: row.diff_summary,
    sourceUrl: row.source_url,
    checksumSha256: row.checksum_sha256,
    status: row.status,
    createdAt: row.created_at,
    sourceLabel,
    sourceAuthority: authority,
    readAt: row.read_at,
    isRead: Boolean(row.is_read),
    title: `Regulamento atualizado - ${authority} (${sourceLabel})`,
  };
};

export const listRegulationUpdates = async (
  params: ListRegulationUpdatesParams
): Promise<ListRegulationUpdatesResult> => {
  const organizationId = params.organizationId?.trim();
  if (!organizationId) {
    return { items: [], nextCursor: null };
  }

  const limit = Math.max(1, Math.min(params.limit ?? 20, 50));
  const rows = await supabaseRestPost<RegulationUpdateRow[]>(
    "/rpc/list_regulation_updates",
    {
      p_organization_id: organizationId,
      p_unread_only: Boolean(params.unreadOnly),
      p_limit: limit,
      p_created_before: params.cursor ?? null,
    },
    "return=representation"
  );

  const items = (rows ?? []).map(mapRow);
  const nextCursor = items.length >= limit ? items[items.length - 1]?.createdAt ?? null : null;
  return { items, nextCursor };
};

export const markRegulationUpdateRead = async (params: {
  organizationId: string;
  ruleUpdateId: string;
}) => {
  const organizationId = params.organizationId?.trim();
  const ruleUpdateId = params.ruleUpdateId?.trim();
  if (!organizationId || !ruleUpdateId) return;
  await supabaseRestPost<null>(
    "/rpc/mark_regulation_update_read",
    {
      p_organization_id: organizationId,
      p_rule_update_id: ruleUpdateId,
    },
    "return=minimal"
  );
};
