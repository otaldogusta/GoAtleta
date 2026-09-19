import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildScientificEvidencePrompt,
  ConsensusEvidenceProvider,
  decideScientificSearch,
  deduplicateScientificCandidates,
  evaluateAutomaticGlobalGate,
  PubMedEvidenceProvider,
  redactScientificQuery,
  sourceMetadataMatchesCandidate,
  type ScientificCandidate,
  type ScientificEvidenceProviderName,
  type ScientificEvidenceTrigger,
} from "./scientific-evidence.ts";

export type ScientificEvidenceContext = {
  status: "not_needed" | "cache" | "searched" | "fallback" | "quota_exceeded";
  trigger?: ScientificEvidenceTrigger;
  providers: Array<"internal" | ScientificEvidenceProviderName>;
  searchId?: string;
  candidateCount: number;
  acceptedSourceIds: string[];
  conflictingEvidence: boolean;
  warnings: string[];
};

export type ScientificEvidenceResolution = {
  context: ScientificEvidenceContext;
  candidates: ScientificCandidate[];
  prompt: string;
};

// The generated Database type intentionally does not include migrations that have
// not been applied yet. Keep the privileged persistence client structurally loose
// here and validate the migration itself with contract tests.
type AdminClient = any;

const emptyResolution = (): ScientificEvidenceResolution => ({
  context: {
    status: "not_needed",
    providers: [],
    candidateCount: 0,
    acceptedSourceIds: [],
    conflictingEvidence: false,
    warnings: [],
  },
  candidates: [],
  prompt: "SCIENTIFIC_EVIDENCE: pesquisa externa não necessária.",
});

const sha256 = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const serviceClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
};

const candidateFromRow = (row: Record<string, unknown>): ScientificCandidate => ({
  provider: row.provider === "consensus" ? "consensus" : "pubmed",
  externalId: String(row.external_id ?? ""),
  doi: String(row.doi ?? ""),
  pmid: String(row.pmid ?? ""),
  title: String(row.title ?? ""),
  authors: Array.isArray(row.authors) ? row.authors.map(String) : [],
  journal: String(row.journal ?? ""),
  year: Number.isFinite(Number(row.publication_year)) ? Number(row.publication_year) : null,
  abstract: String(row.abstract ?? ""),
  relevantPassages: Array.isArray(row.relevant_passages) ? row.relevant_passages.map(String) : [],
  studyType: String(row.study_type ?? ""),
  population: String(row.population ?? ""),
  limitations: Array.isArray(row.limitations) ? row.limitations.map(String) : [],
  citationCount: Number.isFinite(Number(row.citation_count)) ? Number(row.citation_count) : null,
  relevanceScore: Number.isFinite(Number(row.relevance_score)) ? Number(row.relevance_score) : null,
  url: String(row.source_url ?? ""),
});

const loadCache = async (admin: AdminClient, organizationId: string, queryHash: string) => {
  const { data: searches } = await admin
    .from("scientific_evidence_searches")
    .select("id, provider, status, warnings")
    .eq("organization_id", organizationId)
    .eq("query_hash", queryHash)
    .gt("expires_at", new Date().toISOString())
    .in("status", ["searched", "fallback"])
    .order("created_at", { ascending: false })
    .limit(1);
  const search = searches?.[0];
  if (!search?.id) return null;
  const { data: rows } = await admin
    .from("scientific_evidence_candidates")
    .select("*")
    .eq("search_id", search.id)
    .neq("state", "rejected")
    .limit(20);
  const candidates: ScientificCandidate[] = (rows ?? []).map((row: Record<string, unknown>) => candidateFromRow(row));
  return { search, candidates };
};

const reserveConsensusQuota = async (
  admin: AdminClient,
  organizationId: string,
  userId: string,
  query: string,
  queryHash: string,
  trigger: ScientificEvidenceTrigger,
  warnings: string[],
) => {
  const { data, error } = await admin.rpc("reserve_scientific_evidence_consensus_call", {
    p_organization_id: organizationId,
    p_user_id: userId,
    p_redacted_query: query,
    p_query_hash: queryHash,
    p_trigger: trigger,
    p_warnings: warnings,
  });
  return {
    searchId: typeof data === "string" ? data : null,
    error: error ? "consensus_quota_reservation_failed" : null,
  };
};

const loadGlobalEvidence = async (admin: AdminClient, query: string) => {
  const { data } = await admin
    .from("scientific_sources")
    .select("id, discovery_provider, discovery_external_id, doi, title, authors, publication_venue, year, abstract, relevant_passages, study_design, population, limitations, relevance_score, official_url")
    .eq("auto_published", true)
    .is("withdrawn_at", null)
    .textSearch("search_document", query, { type: "websearch", config: "simple" })
    .limit(8);
  const rows = data ?? [];
  return { candidates: rows.map((row: Record<string, unknown>) => ({
    provider: row.discovery_provider === "pubmed" ? "pubmed" : "consensus",
    externalId: String(row.discovery_external_id ?? row.id ?? ""),
    doi: String(row.doi ?? ""),
    pmid: "",
    title: String(row.title ?? ""),
    authors: Array.isArray(row.authors) ? row.authors.map(String) : [],
    journal: String(row.publication_venue ?? ""),
    year: Number.isFinite(Number(row.year)) ? Number(row.year) : null,
    abstract: String(row.abstract ?? ""),
    relevantPassages: Array.isArray(row.relevant_passages) ? row.relevant_passages.map(String) : [],
    studyType: String(row.study_design ?? ""),
    population: String(row.population ?? ""),
    limitations: Array.isArray(row.limitations) ? row.limitations.map(String) : [],
    citationCount: null,
    relevanceScore: Number.isFinite(Number(row.relevance_score)) ? Number(row.relevance_score) : null,
    url: String(row.official_url ?? ""),
  } satisfies ScientificCandidate)).filter((candidate: ScientificCandidate) => candidate.title && candidate.url),
  sourceIds: rows.map((row: Record<string, unknown>) => String(row.id ?? "")).filter(Boolean) };
};

const verifyCandidateSource = async (candidate: ScientificCandidate) => {
  if (!candidate.doi) return false;
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 4_000);
  try {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(candidate.doi)}`, {
      signal: abort.signal,
      headers: { "User-Agent": "GoAtleta/1.0 scientific verification (mailto:privacidade@goatleta.com.br)" },
    });
    if (!response.ok) return false;
    const message = (await response.json())?.message as Record<string, unknown> | undefined;
    if (!message) return false;
    const title = Array.isArray(message.title) ? String(message.title[0] ?? "") : "";
    const authors = Array.isArray(message.author)
      ? message.author.map((author: Record<string, unknown>) => `${String(author.given ?? "")} ${String(author.family ?? "")}`.trim()).filter(Boolean)
      : [];
    const dateParts = (message.published as { "date-parts"?: unknown } | undefined)?.["date-parts"];
    const year = Array.isArray(dateParts) && Array.isArray(dateParts[0]) ? Number(dateParts[0][0]) : null;
    return sourceMetadataMatchesCandidate(candidate, { title, authors, year: Number.isFinite(year) ? year : null });
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const persistSearch = async (params: {
  admin: AdminClient;
  organizationId: string;
  userId: string;
  query: string;
  queryHash: string;
  trigger: ScientificEvidenceTrigger;
  provider: ScientificEvidenceProviderName;
  status: "searched" | "fallback" | "quota_exceeded" | "failed";
  callUnits: number;
  warnings: string[];
  candidates: ScientificCandidate[];
  reservedSearchId?: string | null;
}) => {
  const searchPayload = {
    organization_id: params.organizationId,
    user_id: params.userId,
    redacted_query: params.query,
    query_hash: params.queryHash,
    trigger: params.trigger,
    provider: params.reservedSearchId ? "consensus" : params.provider,
    status: params.status,
    call_units: params.callUnits,
    warnings: params.warnings,
    filters: { limit: 20, excludePreprints: true },
  };
  const searchQuery = params.reservedSearchId
    ? params.admin.from("scientific_evidence_searches").update(searchPayload).eq("id", params.reservedSearchId)
      .eq("organization_id", params.organizationId).select("id").single()
    : params.admin.from("scientific_evidence_searches").insert(searchPayload).select("id").single();
  const { data: search, error } = await searchQuery;
  if (error || !search?.id) return { searchId: undefined, acceptedSourceIds: [] as string[] };

  const acceptedSourceIds: string[] = [];
  for (const candidate of params.candidates) {
    const gate = evaluateAutomaticGlobalGate(candidate);
    if (gate.publishable && !(await verifyCandidateSource(candidate))) {
      gate.publishable = false;
      gate.reasons.push("source_not_retrievable");
    }
    const contentHash = await sha256(JSON.stringify(candidate));
    const { data: persisted } = await params.admin.from("scientific_evidence_candidates").insert({
      search_id: search.id,
      organization_id: params.organizationId,
      provider: candidate.provider,
      external_id: candidate.externalId,
      doi: candidate.doi || null,
      pmid: candidate.pmid || null,
      title: candidate.title,
      authors: candidate.authors,
      journal: candidate.journal || null,
      publication_year: candidate.year,
      abstract: candidate.abstract || null,
      relevant_passages: candidate.relevantPassages,
      study_type: candidate.studyType || null,
      population: candidate.population || null,
      limitations: candidate.limitations,
      citation_count: candidate.citationCount,
      relevance_score: candidate.relevanceScore,
      source_url: candidate.url,
      content_hash: contentHash,
      state: gate.publishable ? "candidate" : "quarantined",
      gate_reasons: gate.reasons,
    }).select("id").single();
    if (!persisted?.id) continue;

    let scientificSourceId: string | null = null;
    if (gate.publishable) {
      const { data: existing } = await params.admin.from("scientific_sources")
        .select("id").eq("doi", candidate.doi).maybeSingle();
      scientificSourceId = existing?.id ?? null;
      if (!scientificSourceId) {
        const { data: source } = await params.admin.from("scientific_sources").insert({
          author: candidate.authors[0],
          authors: candidate.authors,
          title: candidate.title,
          year: candidate.year,
          doi_url: `https://doi.org/${candidate.doi}`,
          doi: candidate.doi,
          official_url: candidate.url,
          publication_venue: candidate.journal,
          quality_level: "B_consensus",
          material_type: "scientific_article",
          study_design: candidate.studyType,
          evidence_level: "scientific_research",
          verification_status: "unverified",
          discovery_provider: candidate.provider,
          discovery_external_id: candidate.externalId,
          auto_published: true,
          abstract: candidate.abstract || null,
          relevant_passages: candidate.relevantPassages,
          population: candidate.population || null,
          limitations: candidate.limitations,
          relevance_score: candidate.relevanceScore,
        }).select("id").single();
        scientificSourceId = source?.id ?? null;
      }
    }
    const state = scientificSourceId ? "global" : gate.publishable ? "quarantined" : "quarantined";
    await params.admin.from("scientific_evidence_candidates").update({
      state,
      scientific_source_id: scientificSourceId,
      gate_reasons: scientificSourceId ? [] : gate.publishable ? ["scientific_source_insert_failed"] : gate.reasons,
    }).eq("id", persisted.id);
    if (scientificSourceId) acceptedSourceIds.push(scientificSourceId);
    await params.admin.from("scientific_evidence_publication_audit").insert({
      candidate_id: persisted.id,
      scientific_source_id: scientificSourceId,
      action: scientificSourceId ? "auto_publish" : "quarantine",
      reason: scientificSourceId ? "automatic_gate_passed" : (gate.reasons.join(",") || "publication_failed"),
      resulting_state: { state, gateReasons: gate.reasons, scientificSourceId },
    });
  }
  return { searchId: search.id as string, acceptedSourceIds };
};

export const resolveScientificEvidence = async (params: {
  organizationId: string;
  userId: string;
  message: string;
  sportHint: string;
  internalEvidenceCount: number;
  onExternalSearch?: () => void;
}): Promise<ScientificEvidenceResolution> => {
  const decision = decideScientificSearch({
    message: params.message,
    internalEvidenceCount: params.internalEvidenceCount,
  });
  if (!decision.shouldSearch) return emptyResolution();
  const admin = serviceClient();
  if (!admin) return {
    ...emptyResolution(),
    context: { ...emptyResolution().context, status: "fallback", trigger: decision.trigger, warnings: ["scientific_service_unavailable"] },
  };
  const redacted = redactScientificQuery(params.message);
  const safeSportHint = params.sportHint.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  redacted.query = `${redacted.query}${safeSportHint ? ` Modalidade: ${safeSportHint}.` : ""}`.trim().slice(0, 500);
  const sensitiveContextRequested = Deno.env.get("CONSENSUS_SENSITIVE_CONTEXT_ENABLED") === "true";
  if (sensitiveContextRequested) redacted.warnings.push("sensitive_context_gate_locked");
  if (redacted.query.length < 3) return {
    ...emptyResolution(),
    context: { ...emptyResolution().context, trigger: decision.trigger, warnings: [...redacted.warnings, "query_removed_for_privacy"] },
  };
  const queryHash = await sha256(redacted.query.toLowerCase());
  const cached = await loadCache(admin, params.organizationId, queryHash);
  if (cached?.candidates.length) {
    return {
      context: {
        status: "cache",
        trigger: decision.trigger,
        providers: [...new Set(cached.candidates.map((candidate) => candidate.provider))],
        searchId: cached.search.id,
        candidateCount: cached.candidates.length,
        acceptedSourceIds: [],
        conflictingEvidence: decision.trigger === "conflict",
        warnings: [...redacted.warnings, ...((cached.search.warnings as string[]) ?? [])],
      },
      candidates: cached.candidates,
      prompt: buildScientificEvidencePrompt(cached.candidates),
    };
  }

  const globalEvidence = await loadGlobalEvidence(admin, redacted.query);
  if (globalEvidence.candidates.length >= 2) {
    return {
      context: {
        status: "cache",
        trigger: decision.trigger,
        providers: ["internal"],
        candidateCount: globalEvidence.candidates.length,
        acceptedSourceIds: globalEvidence.sourceIds,
        conflictingEvidence: decision.trigger === "conflict",
        warnings: redacted.warnings,
      },
      candidates: globalEvidence.candidates,
      prompt: buildScientificEvidencePrompt(globalEvidence.candidates),
    };
  }

  const consensusKey = Deno.env.get("CONSENSUS_API_KEY") ?? "";
  const reservation = consensusKey
    ? await reserveConsensusQuota(admin, params.organizationId, params.userId, redacted.query, queryHash, decision.trigger, redacted.warnings)
    : { searchId: null, error: null };
  const reservedSearchId = reservation.searchId;
  const quotaExceeded = Boolean(consensusKey && !reservedSearchId && !reservation.error);
  const canUseConsensus = Boolean(consensusKey && reservedSearchId);
  params.onExternalSearch?.();
  const warnings = [...redacted.warnings];
  let provider: ScientificEvidenceProviderName = canUseConsensus ? "consensus" : "pubmed";
  let status: "searched" | "fallback" | "quota_exceeded" = canUseConsensus ? "searched" : "fallback";
  if (reservation.error) warnings.push(reservation.error);
  if (!canUseConsensus) warnings.push(quotaExceeded ? "consensus_quota_exceeded" : consensusKey ? "consensus_unavailable" : "consensus_not_configured");
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 8_000);
  let candidates: ScientificCandidate[] = [];
  let callUnits = 0;
  try {
    if (canUseConsensus) {
      callUnits = 1;
      candidates = await new ConsensusEvidenceProvider(consensusKey).search({
        query: redacted.query, limit: 20, humanOnly: true, excludePreprints: true,
      }, abort.signal);
    }
  } catch (error) {
    provider = "pubmed";
    status = "fallback";
    warnings.push(error instanceof Error ? error.message.slice(0, 80) : "consensus_failed");
  } finally {
    clearTimeout(timeout);
  }
  if (!candidates.length) {
    try {
      candidates = await new PubMedEvidenceProvider().search({ query: redacted.query, limit: 20 });
    } catch {
      warnings.push("pubmed_failed");
    }
  }
  candidates = deduplicateScientificCandidates(candidates);
  const persisted = await persistSearch({
    admin,
    organizationId: params.organizationId,
    userId: params.userId,
    query: redacted.query,
    queryHash,
    trigger: decision.trigger,
    provider,
    status: quotaExceeded ? "quota_exceeded" : status,
    callUnits,
    warnings,
    candidates,
    reservedSearchId,
  });
  return {
    context: {
      status: quotaExceeded ? "quota_exceeded" : status,
      trigger: decision.trigger,
      providers: [provider],
      searchId: persisted.searchId,
      candidateCount: candidates.length,
      acceptedSourceIds: persisted.acceptedSourceIds,
      conflictingEvidence: decision.trigger === "conflict",
      warnings,
    },
    candidates,
    prompt: buildScientificEvidencePrompt(candidates),
  };
};
