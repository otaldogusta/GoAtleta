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

type ImpactAction = {
  label: string;
  route: string;
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
  impactAreas: string[];
  impactActions: ImpactAction[];
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
  const changedTopics = Array.isArray(row.changed_topics) ? row.changed_topics : [];
  const impact = deriveRegulationImpact(changedTopics);
  return {
    id: row.id,
    organizationId: row.organization_id,
    ruleSetId: row.rule_set_id,
    sourceId: row.source_id,
    documentId: row.document_id,
    publishedAt: row.published_at,
    changedTopics,
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
    impactAreas: impact.areas,
    impactActions: impact.actions,
  };
};

const containsTopic = (topics: string[], pattern: RegExp) =>
  topics.some((topic) => pattern.test(String(topic ?? "").toLowerCase()));

const deriveRegulationImpact = (topics: string[]) => {
  const normalizedTopics = topics.map((item) => String(item ?? "").toLowerCase());
  const areas = new Set<string>();
  const actions = new Map<string, ImpactAction>();

  const addArea = (area: string) => areas.add(area);
  const addAction = (action: ImpactAction) => {
    if (!actions.has(action.route)) actions.set(action.route, action);
  };

  if (
    containsTopic(normalizedTopics, /(substitui|líbero|libero|set|ponto|disputa|playoff|campeonato|torneio)/)
  ) {
    addArea("Torneios");
    addAction({ label: "Ver torneios", route: "/events" });
  }

  if (
    containsTopic(normalizedTopics, /(relat[oó]rio|prazo|registro|presen[çc]a|frequ[eê]ncia)/)
  ) {
    addArea("Coordenação");
    addAction({ label: "Ver coordenação", route: "/coordination" });
  }

  if (containsTopic(normalizedTopics, /(turma|treino|periodiza|carga|sess[aã]o)/)) {
    addArea("Turmas");
    addAction({ label: "Ver turmas", route: "/classes" });
  }

  if (containsTopic(normalizedTopics, /(nfc|tag|chamada|check-?in)/)) {
    addArea("Presença NFC");
    addAction({ label: "Ver presença NFC", route: "/nfc-attendance" });
  }

  if (!areas.size) {
    addArea("Regulamento");
  }
  addAction({ label: "Ver histórico", route: "/regulation-history" });
  addAction({ label: "Ver fontes", route: "/regulation-sources" });

  return {
    areas: Array.from(areas),
    actions: Array.from(actions.values()).slice(0, 4),
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
