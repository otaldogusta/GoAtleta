import { getValidAccessToken } from "../auth/session";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import {
  supabaseRestDelete,
  supabaseRestGet,
  supabaseRestPatch,
  supabaseRestPost,
} from "./rest";

export type RegulationAuthority = "FIVB" | "FPV" | "PARANAENSE" | "OUTRO";

type RegulationSourceRow = {
  id: string;
  organization_id: string;
  label: string;
  authority: RegulationAuthority;
  source_url: string;
  sport: string;
  topic_hints: string[] | null;
  enabled: boolean;
  check_interval_hours: number;
  last_checked_at: string | null;
  last_seen_checksum: string | null;
  last_seen_published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RegulationSource = {
  id: string;
  organizationId: string;
  label: string;
  authority: RegulationAuthority;
  sourceUrl: string;
  sport: string;
  topicHints: string[];
  enabled: boolean;
  checkIntervalHours: number;
  lastCheckedAt: string | null;
  lastSeenChecksum: string | null;
  lastSeenPublishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertRegulationSourceInput = {
  organizationId: string;
  label: string;
  authority: RegulationAuthority;
  sourceUrl: string;
  sport?: string;
  topicHints?: string[];
  enabled?: boolean;
  checkIntervalHours?: number;
  createdBy?: string | null;
};

export type RulesSyncExecutionResult = {
  status: "ok";
  checked: number;
  newDocuments: number;
  newUpdates: number;
  skipped: number;
  errors: { sourceId: string | null; sourceLabel: string | null; message: string }[];
};

const mapSource = (row: RegulationSourceRow): RegulationSource => ({
  id: row.id,
  organizationId: row.organization_id,
  label: row.label,
  authority: row.authority,
  sourceUrl: row.source_url,
  sport: row.sport,
  topicHints: Array.isArray(row.topic_hints) ? row.topic_hints : [],
  enabled: Boolean(row.enabled),
  checkIntervalHours: Number(row.check_interval_hours || 6),
  lastCheckedAt: row.last_checked_at,
  lastSeenChecksum: row.last_seen_checksum,
  lastSeenPublishedAt: row.last_seen_published_at,
  createdBy: row.created_by ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeTopics = (values?: string[]) =>
  Array.from(
    new Set(
      (values ?? [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .map((value) => value.slice(0, 80))
    )
  );

export const listRegulationSources = async (organizationId: string) => {
  const orgId = organizationId?.trim();
  if (!orgId) return [];
  const rows = await supabaseRestGet<RegulationSourceRow[]>(
    "/regulation_sources?organization_id=eq." +
      encodeURIComponent(orgId) +
      "&select=*" +
      "&order=updated_at.desc"
  );
  return (rows ?? []).map(mapSource);
};

export const createRegulationSource = async (input: UpsertRegulationSourceInput) => {
  const rows = await supabaseRestPost<RegulationSourceRow[]>(
    "/regulation_sources",
    [
      {
        organization_id: input.organizationId,
        label: input.label.trim(),
        authority: input.authority,
        source_url: input.sourceUrl.trim(),
        sport: (input.sport || "volleyball").trim() || "volleyball",
        topic_hints: normalizeTopics(input.topicHints),
        enabled: input.enabled ?? true,
        check_interval_hours: Math.max(1, Math.min(input.checkIntervalHours ?? 6, 168)),
        created_by: input.createdBy ?? null,
        updated_at: new Date().toISOString(),
      },
    ],
    "return=representation"
  );
  if (!rows.length) throw new Error("Falha ao criar fonte de regulamento.");
  return mapSource(rows[0]);
};

export const updateRegulationSource = async (
  sourceId: string,
  organizationId: string,
  patch: Partial<Omit<UpsertRegulationSourceInput, "organizationId">>
) => {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof patch.label === "string") payload.label = patch.label.trim();
  if (typeof patch.authority === "string") payload.authority = patch.authority;
  if (typeof patch.sourceUrl === "string") payload.source_url = patch.sourceUrl.trim();
  if (typeof patch.sport === "string") payload.sport = patch.sport.trim() || "volleyball";
  if (Array.isArray(patch.topicHints)) payload.topic_hints = normalizeTopics(patch.topicHints);
  if (typeof patch.enabled === "boolean") payload.enabled = patch.enabled;
  if (typeof patch.checkIntervalHours === "number") {
    payload.check_interval_hours = Math.max(1, Math.min(patch.checkIntervalHours, 168));
  }

  const rows = await supabaseRestPatch<RegulationSourceRow[]>(
    "/regulation_sources?id=eq." +
      encodeURIComponent(sourceId) +
      "&organization_id=eq." +
      encodeURIComponent(organizationId),
    payload,
    "return=representation"
  );
  if (!rows.length) throw new Error("Fonte de regulamento não encontrada.");
  return mapSource(rows[0]);
};

export const toggleRegulationSource = async (
  sourceId: string,
  organizationId: string,
  enabled: boolean
) => {
  return updateRegulationSource(sourceId, organizationId, { enabled });
};

export const deleteRegulationSource = async (sourceId: string, organizationId: string) => {
  await supabaseRestDelete(
    "/regulation_sources?id=eq." +
      encodeURIComponent(sourceId) +
      "&organization_id=eq." +
      encodeURIComponent(organizationId),
    "return=minimal"
  );
};

export const syncRegulationSourceNow = async (params: {
  organizationId: string;
  sourceId: string;
  force?: boolean;
}) => {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Missing auth token");
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/rules-sync-admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      organizationId: params.organizationId,
      sourceId: params.sourceId,
      force: params.force ?? true,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || "Falha ao sincronizar fonte.");
  }
  if (!text) {
    return {
      status: "ok",
      checked: 0,
      newDocuments: 0,
      newUpdates: 0,
      skipped: 0,
      errors: [],
    } as RulesSyncExecutionResult;
  }
  return JSON.parse(text) as RulesSyncExecutionResult;
};
