import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RULES_BUCKET = "regulation-docs";

type RegulationSourceRow = {
  id: string;
  organization_id: string;
  label: string;
  authority: "FIVB" | "FPV" | "PARANAENSE" | "OUTRO";
  source_url: string;
  sport: string;
  topic_hints: string[] | null;
  check_interval_hours: number | null;
  last_checked_at: string | null;
  last_seen_checksum: string | null;
  last_seen_published_at: string | null;
};

type RegulationRuleSetRow = {
  id: string;
  organization_id: string;
  sport: string;
  status: "draft" | "active" | "pending_next_cycle" | "archived";
  version_label: string;
};

type RulesSyncError = {
  sourceId: string | null;
  sourceLabel: string | null;
  message: string;
};

export type RulesSyncReport = {
  checked: number;
  newDocuments: number;
  newUpdates: number;
  skipped: number;
  errors: RulesSyncError[];
};

export type RunRulesSyncOptions = {
  organizationId?: string | null;
  sourceId?: string | null;
  force?: boolean;
};

type FetchDocumentResult = {
  checksum: string;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  byteSize: number;
  publishedAt: string | null;
  bodyBytes: Uint8Array;
};

const nowIso = () => new Date().toISOString();

const toHex = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
};

const sha256 = async (body: Uint8Array) => {
  const hash = await crypto.subtle.digest("SHA-256", body);
  return toHex(hash);
};

const normalizeTopics = (topics: unknown) => {
  if (!Array.isArray(topics)) return [];
  const unique = new Set<string>();
  for (const item of topics) {
    const normalized = String(item ?? "").trim();
    if (normalized) unique.add(normalized.slice(0, 80));
  }
  return Array.from(unique);
};

const parseIsoOrNull = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
};

const shouldSkipByInterval = (source: RegulationSourceRow, force: boolean) => {
  if (force) return false;
  const intervalHours = Math.max(1, Number(source.check_interval_hours ?? 6));
  const lastCheckedMs = Date.parse(source.last_checked_at ?? "");
  if (!Number.isFinite(lastCheckedMs)) return false;
  const elapsedMs = Date.now() - lastCheckedMs;
  return elapsedMs < intervalHours * 60 * 60 * 1000;
};

const inferExtension = (contentType: string | null, sourceUrl: string) => {
  const lowerType = (contentType ?? "").toLowerCase();
  if (lowerType.includes("pdf")) return "pdf";
  if (lowerType.includes("html")) return "html";
  if (lowerType.includes("json")) return "json";
  if (lowerType.includes("plain")) return "txt";
  const pathname = (() => {
    try {
      return new URL(sourceUrl).pathname;
    } catch {
      return "";
    }
  })();
  const match = pathname.match(/\.([a-z0-9]{2,5})$/i);
  return match?.[1]?.toLowerCase() ?? "bin";
};

const buildDiffSummary = (isFirst: boolean) => {
  if (isFirst) return "Nova publicacao de regulamento detectada.";
  return "Novo adendo/revisao detectado (checksum alterado).";
};

const createServiceClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in function env.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
};

const fetchDocument = async (sourceUrl: string): Promise<FetchDocumentResult> => {
  let headEtag: string | null = null;
  let headLastModified: string | null = null;
  let headContentType: string | null = null;
  try {
    const headResponse = await fetch(sourceUrl, { method: "HEAD" });
    if (headResponse.ok) {
      headEtag = headResponse.headers.get("etag");
      headLastModified = headResponse.headers.get("last-modified");
      headContentType = headResponse.headers.get("content-type");
    }
  } catch {
    // Fallback to GET only.
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Source fetch failed (${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  const bodyBytes = new Uint8Array(buffer);
  const checksum = await sha256(bodyBytes);

  const etag = response.headers.get("etag") ?? headEtag;
  const lastModified = response.headers.get("last-modified") ?? headLastModified;
  const contentType = response.headers.get("content-type") ?? headContentType;
  const publishedAt = parseIsoOrNull(lastModified);

  return {
    checksum,
    contentType,
    etag,
    lastModified,
    byteSize: bodyBytes.byteLength,
    publishedAt,
    bodyBytes,
  };
};

const getOrCreatePendingRuleSet = async (params: {
  supabase: ReturnType<typeof createServiceClient>;
  source: RegulationSourceRow;
  checksum: string;
  publishedAt: string | null;
}) => {
  const { supabase, source } = params;

  const { data: existingPending, error: pendingError } = await supabase
    .from("regulation_rule_sets")
    .select("id, organization_id, sport, status, version_label")
    .eq("organization_id", source.organization_id)
    .eq("sport", source.sport || "volleyball")
    .eq("status", "pending_next_cycle")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<RegulationRuleSetRow>();

  if (pendingError) {
    throw new Error(`Failed to load pending rule set: ${pendingError.message}`);
  }
  if (existingPending) {
    return existingPending.id;
  }

  const dateLabel = new Date().toISOString().slice(0, 10);
  const shortHash = params.checksum.slice(0, 8);
  const versionLabel = `${source.authority}-${dateLabel}-${shortHash}`;
  const { data: created, error: createError } = await supabase
    .from("regulation_rule_sets")
    .insert({
      organization_id: source.organization_id,
      sport: source.sport || "volleyball",
      version_label: versionLabel,
      status: "pending_next_cycle",
      activation_policy: "new_cycles_only",
      source_authority: source.authority,
      published_at: params.publishedAt,
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .select("id")
    .single();

  if (createError || !created?.id) {
    throw new Error(`Failed to create pending rule set: ${createError?.message ?? "unknown"}`);
  }

  return String(created.id);
};

const upsertDocumentAndUpdate = async (params: {
  supabase: ReturnType<typeof createServiceClient>;
  source: RegulationSourceRow;
  ruleSetId: string;
  document: FetchDocumentResult;
  storagePath: string;
}) => {
  const { supabase, source, ruleSetId, document, storagePath } = params;
  const orgId = source.organization_id;

  const { data: existingDocument, error: existingDocError } = await supabase
    .from("regulation_documents")
    .select("id")
    .eq("organization_id", orgId)
    .eq("source_id", source.id)
    .eq("checksum_sha256", document.checksum)
    .limit(1)
    .maybeSingle();

  if (existingDocError) {
    throw new Error(`Failed to check document uniqueness: ${existingDocError.message}`);
  }

  const documentPayload = {
    organization_id: orgId,
    source_id: source.id,
    rule_set_id: ruleSetId,
    source_url: source.source_url,
    storage_path: storagePath,
    checksum_sha256: document.checksum,
    etag: document.etag,
    last_modified: document.lastModified,
    mime_type: document.contentType,
    byte_size: document.byteSize,
    published_at: document.publishedAt,
    fetched_at: nowIso(),
    created_at: nowIso(),
  };

  const { data: documentRow, error: documentError } = await supabase
    .from("regulation_documents")
    .upsert(documentPayload, {
      onConflict: "organization_id,source_id,checksum_sha256",
      ignoreDuplicates: false,
    })
    .select("id")
    .single();

  if (documentError || !documentRow?.id) {
    throw new Error(`Failed to upsert regulation document: ${documentError?.message ?? "unknown"}`);
  }

  const { data: existingUpdate, error: existingUpdateError } = await supabase
    .from("regulation_updates")
    .select("id")
    .eq("organization_id", orgId)
    .eq("source_id", source.id)
    .eq("checksum_sha256", document.checksum)
    .limit(1)
    .maybeSingle();

  if (existingUpdateError) {
    throw new Error(`Failed to check update uniqueness: ${existingUpdateError.message}`);
  }

  const updatePayload = {
    organization_id: orgId,
    rule_set_id: ruleSetId,
    source_id: source.id,
    document_id: String(documentRow.id),
    published_at: document.publishedAt,
    changed_topics: normalizeTopics(source.topic_hints),
    diff_summary: buildDiffSummary(!source.last_seen_checksum),
    source_url: source.source_url,
    checksum_sha256: document.checksum,
    status: "published",
    created_at: nowIso(),
  };

  const { error: updateError } = await supabase
    .from("regulation_updates")
    .upsert(updatePayload, {
      onConflict: "organization_id,source_id,checksum_sha256",
      ignoreDuplicates: false,
    });

  if (updateError) {
    throw new Error(`Failed to upsert regulation update: ${updateError.message}`);
  }

  return {
    createdDocument: !existingDocument,
    createdUpdate: !existingUpdate,
  };
};

const updateSourceMetadata = async (params: {
  supabase: ReturnType<typeof createServiceClient>;
  source: RegulationSourceRow;
  checksum?: string | null;
  publishedAt?: string | null;
}) => {
  const payload: Record<string, unknown> = {
    last_checked_at: nowIso(),
    updated_at: nowIso(),
  };
  if (params.checksum !== undefined) {
    payload.last_seen_checksum = params.checksum;
  }
  if (params.publishedAt !== undefined) {
    payload.last_seen_published_at = params.publishedAt;
  }

  const { error } = await params.supabase
    .from("regulation_sources")
    .update(payload)
    .eq("id", params.source.id);
  if (error) {
    throw new Error(`Failed to update source metadata: ${error.message}`);
  }
};

const uploadDocument = async (params: {
  supabase: ReturnType<typeof createServiceClient>;
  source: RegulationSourceRow;
  document: FetchDocumentResult;
}) => {
  const extension = inferExtension(params.document.contentType, params.source.source_url);
  const shortHash = params.document.checksum.slice(0, 8);
  const baseName = `${Date.now()}_${shortHash}.${extension}`;
  const firstPath = `${params.source.organization_id}/${params.source.id}/${baseName}`;

  const uploadOne = async (path: string) => {
    const { error } = await params.supabase.storage
      .from(RULES_BUCKET)
      .upload(path, params.document.bodyBytes, {
        upsert: false,
        contentType: params.document.contentType ?? "application/octet-stream",
      });
    return error;
  };

  const firstError = await uploadOne(firstPath);
  if (!firstError) return firstPath;

  const fallbackName = `${Date.now()}_${shortHash}_${Math.random().toString(16).slice(2, 7)}.${extension}`;
  const fallbackPath = `${params.source.organization_id}/${params.source.id}/${fallbackName}`;
  const fallbackError = await uploadOne(fallbackPath);
  if (fallbackError) {
    throw new Error(`Failed to upload source document: ${fallbackError.message}`);
  }
  return fallbackPath;
};

export const runRulesSync = async (options: RunRulesSyncOptions = {}): Promise<RulesSyncReport> => {
  const supabase = createServiceClient();
  const report: RulesSyncReport = {
    checked: 0,
    newDocuments: 0,
    newUpdates: 0,
    skipped: 0,
    errors: [],
  };

  let query = supabase
    .from("regulation_sources")
    .select(
      "id,organization_id,label,authority,source_url,sport,topic_hints,check_interval_hours,last_checked_at,last_seen_checksum,last_seen_published_at"
    )
    .eq("enabled", true)
    .order("updated_at", { ascending: false });

  if (options.organizationId) {
    query = query.eq("organization_id", options.organizationId);
  }
  if (options.sourceId) {
    query = query.eq("id", options.sourceId);
  }

  const { data: sources, error: sourcesError } = await query;
  if (sourcesError) {
    throw new Error(`Failed to load regulation sources: ${sourcesError.message}`);
  }

  for (const source of (sources ?? []) as RegulationSourceRow[]) {
    try {
      if (!source.source_url?.trim()) {
        report.skipped += 1;
        continue;
      }
      if (shouldSkipByInterval(source, Boolean(options.force))) {
        report.skipped += 1;
        continue;
      }

      report.checked += 1;
      const document = await fetchDocument(source.source_url.trim());

      if (source.last_seen_checksum && source.last_seen_checksum === document.checksum) {
        await updateSourceMetadata({
          supabase,
          source,
          checksum: source.last_seen_checksum,
          publishedAt: source.last_seen_published_at ?? document.publishedAt,
        });
        report.skipped += 1;
        continue;
      }

      const ruleSetId = await getOrCreatePendingRuleSet({
        supabase,
        source,
        checksum: document.checksum,
        publishedAt: document.publishedAt,
      });
      const storagePath = await uploadDocument({ supabase, source, document });
      const upsertResult = await upsertDocumentAndUpdate({
        supabase,
        source,
        ruleSetId,
        document,
        storagePath,
      });
      if (upsertResult.createdDocument) report.newDocuments += 1;
      if (upsertResult.createdUpdate) report.newUpdates += 1;

      await updateSourceMetadata({
        supabase,
        source,
        checksum: document.checksum,
        publishedAt: document.publishedAt,
      });
    } catch (error) {
      report.errors.push({
        sourceId: source.id ?? null,
        sourceLabel: source.label ?? null,
        message: error instanceof Error ? error.message : String(error ?? "Unknown error"),
      });
    }
  }

  return report;
};
