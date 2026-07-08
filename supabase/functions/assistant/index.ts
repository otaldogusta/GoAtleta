import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
    normalizePublicUrl,
    resolveAndCheckPublicUrl,
} from "../_shared/url-validation.ts";
import { securityLogger } from "../_shared/security-logger.ts";
import {
    resolveRegulationAssistantResponse,
} from "./regulation-resolver.ts";
import { createEdgeFunction, createSuccess, createError } from "../_shared/framework.ts";
import { resolveAIContext, buildSystemAIContextPrompt } from "../_shared/ai-context.ts";
import { resolveAIMemory, buildSystemAIMemoryPrompt } from "../_shared/ai-memory.ts";
import { resolveAIGovernance, buildSystemAIGovernancePrompt } from "../_shared/ai-governance.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AssistantSource = {
  title: string;
  author: string;
  url: string;
};

type KbDocument = {
  id: string;
  organizationId: string;
  title: string;
  source: string;
  chunk: string;
  tags: string[];
  sport: string;
  level: string;
  createdAt: string;
  scientific_concepts?: {
    name: string;
    area: string;
    description: string;
    principles: string[];
  } | null;
  scientific_sources?: {
    author: string;
    title: string;
    year: number;
    doi_url: string | null;
    quality_level: string;
  } | null;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type DraftTraining = {
  id: string;
  classId: string;
  title: string;
  tags: string[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmupTime: string;
  mainTime: string;
  cooldownTime: string;
};

type AssistantMemoryEntryRow = {
  id: string;
  content: string;
  role: "user" | "assistant";
  scope: "organization" | "class" | "coach";
  created_at: string;
};

type AssistantResponse = {
  reply: string;
  sources: AssistantSource[];
  draftTraining: DraftTraining | null;
  confidence: number;
  citations: {
    sourceTitle: string;
    evidence: string;
  }[];
  assumptions: string[];
  missingData: string[];
  pedagogicalDecisions?: {
    decision: string;
    reason: string;
    confidence: "high" | "medium" | "low";
    based_on: string[];
    sources: {
      author: string;
      concept: string;
    }[];
  }[];
  _debug?: {
    orgId: string;
    sport: string;
    retrievedChunksCount: number;
    docIds: string[];
    retrievalLatencyMs: number;
    totalLatencyMs: number;
    cacheHit: boolean;
    queryType: string;
  };
};

type AppSnapshotSignal = {
  id: string;
  type: string;
  severity: string;
  title: string;
  classId: string | null;
  studentId: string | null;
};

type AppSnapshotAction = {
  actionTitle: string;
  status: string;
  createdAt: string;
};

type AppSnapshotPayload = {
  snapshotVersion?: number | null;
  snapshotHash?: string | null;
  screen: string | null;
  contextTitle: string | null;
  activeSignal: AppSnapshotSignal | null;
  signalsTop: AppSnapshotSignal[];
  recentActions: AppSnapshotAction[];
  regulationContext?: {
    activeRuleSetId: string | null;
    pendingRuleSetId: string | null;
    latestUpdateIds: string[];
    latestChangedTopics: string[];
    impactAreas: string[];
  } | null;
};

type RetrievalResult = {
  docs: KbDocument[];
  cacheHit: boolean;
  retrievalLatencyMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

const RETRIEVAL_CACHE_TTL_MS = 120_000;
const RETRIEVAL_CACHE_MAX_ITEMS = 120;
const retrievalCache = new Map<string, { expiresAt: number; docs: KbDocument[] }>();
const retrievalInFlight = new Map<string, Promise<RetrievalResult>>();

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const ASSISTANT_RATE_LIMIT_PER_MINUTE = parsePositiveInt(
  Deno.env.get("ASSISTANT_RATE_LIMIT_PER_MINUTE"),
  20
);
const ASSISTANT_MAX_REQUEST_BYTES = parsePositiveInt(
  Deno.env.get("ASSISTANT_MAX_REQUEST_BYTES"),
  128_000
);
const ASSISTANT_MAX_MESSAGES = parsePositiveInt(Deno.env.get("ASSISTANT_MAX_MESSAGES"), 20);
const ASSISTANT_MAX_MESSAGE_CHARS = parsePositiveInt(
  Deno.env.get("ASSISTANT_MAX_MESSAGE_CHARS"),
  2_000
);
const ASSISTANT_MAX_MEMORY_CONTEXT_ITEMS = parsePositiveInt(
  Deno.env.get("ASSISTANT_MAX_MEMORY_CONTEXT_ITEMS"),
  6
);
const ASSISTANT_MAX_MEMORY_CONTEXT_CHARS = parsePositiveInt(
  Deno.env.get("ASSISTANT_MAX_MEMORY_CONTEXT_CHARS"),
  600
);

const assistantRateLimitStore =
  (globalThis as unknown as {
    __assistantRateLimitStore?: Map<string, { count: number; resetAt: number }>;
  }).__assistantRateLimitStore ?? new Map<string, { count: number; resetAt: number }>();

(globalThis as unknown as {
  __assistantRateLimitStore?: typeof assistantRateLimitStore;
}).__assistantRateLimitStore = assistantRateLimitStore;

const checkRateLimit = (
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult => {
  const now = Date.now();
  const previous = assistantRateLimitStore.get(key);
  if (!previous || now >= previous.resetAt) {
    assistantRateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }
  if (previous.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((previous.resetAt - now) / 1000)),
    };
  }
  previous.count += 1;
  assistantRateLimitStore.set(key, previous);
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - previous.count),
    retryAfterSec: Math.max(1, Math.ceil((previous.resetAt - now) / 1000)),
  };
};

const isDevelopmentRuntime = () => {
  const runtime = (
    Deno.env.get("APP_ENV") ??
    Deno.env.get("ENVIRONMENT") ??
    Deno.env.get("NODE_ENV") ??
    Deno.env.get("DENO_ENV") ??
    ""
  )
    .trim()
    .toLowerCase();
  return runtime === "development" || runtime === "dev" || runtime === "local" || runtime === "test";
};

const safeErrorDetail = (error: unknown) =>
  isDevelopmentRuntime() ? String(error) : "Internal server error";

const normalizeClientMessages = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((message): message is Record<string, unknown> =>
      Boolean(message && typeof message === "object")
    )
    .map((message) => {
      const role: ChatMessage["role"] = message.role === "assistant" ? "assistant" : "user";
      const content = String(message.content ?? "").trim().slice(0, ASSISTANT_MAX_MESSAGE_CHARS);
      return { role, content };
    })
    .filter((message) => message.content.length > 0)
    .slice(-ASSISTANT_MAX_MESSAGES);
};

const normalizeMemoryContext = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) =>
          String(item ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, ASSISTANT_MAX_MEMORY_CONTEXT_CHARS)
        )
        .filter(Boolean)
        .slice(0, ASSISTANT_MAX_MEMORY_CONTEXT_ITEMS)
    : [];

const createSupabaseClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
};

const createSupabaseClientWithToken = (token: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};

const requireUser = async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  const supabase = createSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, token };
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stopwords = new Set([
  "a",
  "o",
  "os",
  "as",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "para",
  "por",
  "com",
  "na",
  "no",
  "nas",
  "nos",
  "um",
  "uma",
  "que",
  "se",
  "ao",
  "aos",
  "ou",
  "the",
  "and",
  "for",
]);

const tokenize = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) return [] as string[];
  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopwords.has(token));
};

const buildRetrievalQuery = (messages: ChatMessage[]) => {
  const recent = messages
    .slice(-6)
    .map((message) => message.content)
    .join(" ");
  return recent;
};

const inferQueryType = (messages: ChatMessage[]) => {
  const text = normalizeText(
    messages
      .filter((message) => message.role === "user")
      .slice(-2)
      .map((message) => message.content)
      .join(" ")
  );
  if (!text) return "general";
  if (/(plano|treino|sessao|session|aula)/.test(text)) return "lesson_plan";
  if (/(resumo|executivo|summary|coordenacao)/.test(text)) return "executive_summary";
  if (/(suporte|erro|falha|sync|fila)/.test(text)) return "support";
  if (/(comunicado|mensagem|whatsapp|email)/.test(text)) return "communication";
  return "general";
};

const extractDocumentYear = (document: KbDocument) => {
  const sourceYearMatch = String(document.source ?? "").match(/YEAR=(\d{4})/i);
  if (sourceYearMatch?.[1]) return Number(sourceYearMatch[1]);

  const publishedMatch = String(document.chunk ?? "").match(/published_at:\s*(\d{4})/i);
  if (publishedMatch?.[1]) return Number(publishedMatch[1]);

  const genericYearMatch = String(document.chunk ?? "").match(/\b(19|20)\d{2}\b/);
  if (genericYearMatch?.[0]) return Number(genericYearMatch[0]);

  return 0;
};

const getEvidenceTypeBoost = (document: KbDocument) => {
  const text = normalizeText(
    `${document.title} ${document.tags.join(" ")} ${document.chunk} ${document.source}`
  );

  if (/(systematic review|meta analysis|meta-analysis)/.test(text)) return 0.22;
  if (/(consensus|guideline|position statement)/.test(text)) return 0.18;
  if (/(randomized|randomised|rct)/.test(text)) return 0.14;
  if (/(cohort|prospective)/.test(text)) return 0.1;
  return 0;
};

const getRecencyScore = (year: number) => {
  if (!Number.isFinite(year) || year <= 0) return 0;
  if (year < 2005) return -0.2;
  const currentYear = new Date().getFullYear();
  const normalized = Math.max(0, Math.min(1, (year - 2005) / Math.max(1, currentYear - 2005)));
  return normalized * 0.35;
};

const rankKbDocuments = (documents: KbDocument[], queryText: string) => {
  const queryTokens = tokenize(queryText);
  const scored = documents
    .map((document) => {
      const haystack = normalizeText(
        `${document.title} ${document.tags.join(" ")} ${document.chunk}`
      );
      const matches = queryTokens.length
        ? queryTokens.reduce((acc, token) => {
            return haystack.includes(token) ? acc + 1 : acc;
          }, 0)
        : 0;
      const density = queryTokens.length ? matches / queryTokens.length : 0;
      const exactTagBoost = document.tags.some((tag) =>
        queryTokens.includes(normalizeText(tag))
      )
        ? 0.2
        : 0;
      const year = extractDocumentYear(document);
      const recencyScore = getRecencyScore(year);
      const evidenceTypeBoost = getEvidenceTypeBoost(document);
      const evidenceLevelBoost = String(document.level ?? "").toLowerCase() === "evidence" ? 0.12 : 0;
      return {
        document,
        score: density + exactTagBoost + recencyScore + evidenceTypeBoost + evidenceLevelBoost,
      };
    })
    .filter((item) => (queryTokens.length ? item.score > 0 : true))
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return documents.slice(0, 4);
  return scored.slice(0, 4).map((item) => item.document);
};

const buildRagContext = (documents: KbDocument[]) => {
  if (!documents.length) return "RAG_CONTEXT: sem documentos relevantes recuperados.";
  const entries = documents.map((document, index) => {
    const excerpt = document.chunk.length > 700 ? `${document.chunk.slice(0, 700)}...` : document.chunk;
    const conceptLine = document.scientific_concepts ? `concept: ${document.scientific_concepts.name} (${document.scientific_concepts.area})` : "";
    const sourceLine = document.scientific_sources ? `scientific_source: ${document.scientific_sources.author} (${document.scientific_sources.year}) [Evidence Level: ${document.scientific_sources.quality_level}]` : "";
    
    return [
      `Doc ${index + 1}`,
      `docId: ${document.id}`,
      `title: ${document.title || "Sem título"}`,
      `source: ${document.source || "Sem fonte"}`,
      conceptLine,
      sourceLine,
      `tags: ${(document.tags ?? []).join(", ")}`,
      `chunk: ${excerpt}`,
    ].filter(Boolean).join("\n");
  });
  return [
    "RAG_CONTEXT: use apenas estes documentos para evidência e citação.",
    ...entries,
    "Regra: toda recomendação prática deve apontar no campo citations ao menos um docId usado.",
  ].join("\n\n");
};

const buildScientificEvidenceContext = (documents: KbDocument[]) => {
  const evidenceDocs = documents.filter(
    (document) => String(document.level ?? "").toLowerCase() === "evidence"
  );
  if (!evidenceDocs.length) {
    return "SCIENTIFIC_EVIDENCE_CONTEXT: sem evidências científicas aprovadas para esta consulta.";
  }

  const entries = evidenceDocs.map((document, index) => {
    const excerpt =
      document.chunk.length > 420
        ? `${document.chunk.slice(0, 420)}...`
        : document.chunk;
    const conceptLine = document.scientific_concepts ? `concept: ${document.scientific_concepts.name} (${document.scientific_concepts.area})` : "";
    const sourceLine = document.scientific_sources ? `scientific_source: ${document.scientific_sources.author} (${document.scientific_sources.year}) [Evidence Level: ${document.scientific_sources.quality_level}]` : "";

    return [
      `Evidence ${index + 1}`,
      `docId: ${document.id}`,
      `title: ${document.title || "Sem título"}`,
      `source: ${document.source || "Sem fonte"}`,
      conceptLine,
      sourceLine,
      `createdAt: ${document.createdAt || ""}`,
      `chunk: ${excerpt}`,
    ].filter(Boolean).join("\n");
  });

  return [
    "SCIENTIFIC_EVIDENCE_CONTEXT: priorize estes documentos científicos aprovados antes de outros níveis de KB.",
    ...entries,
  ].join("\n\n");
};

const getKnowledgeDocuments = async (params: {
  token: string;
  organizationId: string;
  sportHint: string;
  queryText: string;
}) => {
  const supabase = createSupabaseClientWithToken(params.token);
  if (!supabase || !params.organizationId) return [] as KbDocument[];

  const sportCandidates = [params.sportHint, "volleyball", "voleibol", "volleyball_indoor"]
    .map((value) => value.trim())
    .filter(Boolean);

  let query = supabase
    .from("kb_documents")
    .select(`
      id, organization_id, title, source, chunk, tags, sport, level, created_at,
      scientific_concepts (
        name, area, description, principles
      ),
      scientific_sources (
        author, title, year, doi_url, quality_level
      )
    `)
    .eq("organization_id", params.organizationId)
    .order("created_at", { ascending: false })
    .limit(80);

  if (sportCandidates.length) {
    query = query.in("sport", Array.from(new Set(sportCandidates)));
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return [];

  const mapped: KbDocument[] = data.map((row: any) => ({
    id: String(row.id ?? ""),
    organizationId: String(row.organization_id ?? ""),
    title: String(row.title ?? ""),
    source: String(row.source ?? ""),
    chunk: String(row.chunk ?? ""),
    tags: Array.isArray(row.tags) ? row.tags.map((tag) => String(tag)) : [],
    sport: String(row.sport ?? ""),
    level: String(row.level ?? ""),
    createdAt: String(row.created_at ?? ""),
    scientific_concepts: row.scientific_concepts ? {
      name: String(row.scientific_concepts.name || ""),
      area: String(row.scientific_concepts.area || ""),
      description: String(row.scientific_concepts.description || ""),
      principles: Array.isArray(row.scientific_concepts.principles) ? row.scientific_concepts.principles.map((p: any) => String(p)) : []
    } : null,
    scientific_sources: row.scientific_sources ? {
      author: String(row.scientific_sources.author || ""),
      title: String(row.scientific_sources.title || ""),
      year: Number(row.scientific_sources.year || 0),
      doi_url: row.scientific_sources.doi_url ? String(row.scientific_sources.doi_url) : null,
      quality_level: String(row.scientific_sources.quality_level || "")
    } : null
  }));

  const byRecency = [...mapped].sort((a, b) => {
    const aTime = Date.parse(String(a.createdAt || "")) || 0;
    const bTime = Date.parse(String(b.createdAt || "")) || 0;
    return bTime - aTime;
  });

  const evidenceDocs = byRecency.filter(
    (document) => String(document.level ?? "").toLowerCase() === "evidence"
  );
  const otherDocs = byRecency.filter(
    (document) => String(document.level ?? "").toLowerCase() !== "evidence"
  );

  const rankedEvidence = rankKbDocuments(evidenceDocs, params.queryText);
  const rankedOthers = rankKbDocuments(otherDocs, params.queryText);

  return [...rankedEvidence, ...rankedOthers].slice(0, 6);
};

const buildRetrievalCacheKey = (organizationId: string, sportHint: string, queryText: string) => {
  const querySlice = normalizeText(queryText).slice(0, 300);
  return [organizationId.trim(), sportHint.trim().toLowerCase(), querySlice].join("|");
};

const pruneRetrievalCache = () => {
  const now = Date.now();
  for (const [key, item] of retrievalCache.entries()) {
    if (item.expiresAt <= now) retrievalCache.delete(key);
  }
  while (retrievalCache.size > RETRIEVAL_CACHE_MAX_ITEMS) {
    const firstKey = retrievalCache.keys().next().value;
    if (!firstKey) break;
    retrievalCache.delete(firstKey);
  }
};

const getKnowledgeDocumentsCached = async (params: {
  token: string;
  organizationId: string;
  sportHint: string;
  queryText: string;
}): Promise<RetrievalResult> => {
  const start = Date.now();
  const key = buildRetrievalCacheKey(params.organizationId, params.sportHint, params.queryText);
  const cached = retrievalCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      docs: cached.docs,
      cacheHit: true,
      retrievalLatencyMs: Date.now() - start,
    };
  }

  const inFlight = retrievalInFlight.get(key);
  if (inFlight) return inFlight;

  const run = (async () => {
    const docs = await getKnowledgeDocuments(params);
    pruneRetrievalCache();
    retrievalCache.set(key, {
      docs,
      expiresAt: Date.now() + RETRIEVAL_CACHE_TTL_MS,
    });
    return {
      docs,
      cacheHit: false,
      retrievalLatencyMs: Date.now() - start,
    } as RetrievalResult;
  })().finally(() => {
    retrievalInFlight.delete(key);
  });

  retrievalInFlight.set(key, run);
  return run;
};

const getMemoryContext = async (params: {
  token: string;
  organizationId: string;
  classId: string;
  userId: string;
}) => {
  const supabase = createSupabaseClientWithToken(params.token);
  if (!supabase || !params.organizationId) return [] as AssistantMemoryEntryRow[];

  const nowIso = new Date().toISOString();
  const classFilter = params.classId || "";

  const { data, error } = await supabase
    .from("assistant_memory_entries")
    .select("id,content,role,scope,created_at")
    .eq("organization_id", params.organizationId)
    .or(`class_id.eq.${classFilter},scope.eq.organization,user_id.eq.${params.userId}`)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error || !Array.isArray(data)) return [];
  return data as AssistantMemoryEntryRow[];
};

const saveMemoryEntry = async (params: {
  token: string;
  organizationId: string;
  classId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
}) => {
  if (!params.organizationId || !params.content.trim()) return;
  const supabase = createSupabaseClientWithToken(params.token);
  if (!supabase) return;

  const now = Date.now();
  const expiresAt = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("assistant_memory_entries").insert([
    {
      id: `mem_${now}_${Math.random().toString(36).slice(2, 8)}`,
      organization_id: params.organizationId,
      class_id: params.classId || "",
      user_id: params.userId,
      scope: params.classId ? "class" : "organization",
      role: params.role,
      content: params.content.slice(0, 1200),
      expires_at: expiresAt,
      created_at: new Date(now).toISOString(),
    },
  ]);
};

const canUseDebugMode = (user: { id?: string; email?: string | null }) => {
  const raw = Deno.env.get("ASSISTANT_DEBUG_ADMINS") ?? "";
  if (!raw.trim()) return false;
  const allowList = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const userId = String(user.id ?? "").trim().toLowerCase();
  const email = String(user.email ?? "").trim().toLowerCase();
  return allowList.includes(userId) || (email ? allowList.includes(email) : false);
};

const APP_SNAPSHOT_TEXT_LIMIT = 180;
const APP_SNAPSHOT_MAX_SIGNALS = 5;
const APP_SNAPSHOT_MAX_ACTIONS = 3;

const normalizeSnapshotText = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, APP_SNAPSHOT_TEXT_LIMIT);

const normalizeNullableId = (value: unknown) => {
  const text = normalizeSnapshotText(value);
  return text ? text : null;
};

const normalizeStringList = (value: unknown, limit: number) =>
  Array.isArray(value)
    ? value
        .map((item) => normalizeSnapshotText(item))
        .filter(Boolean)
        .slice(0, limit)
    : [];

const normalizeAppSnapshotSignal = (value: unknown): AppSnapshotSignal | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = normalizeSnapshotText(record.id);
  if (!id) return null;
  return {
    id,
    type: normalizeSnapshotText(record.type) || "unknown",
    severity: normalizeSnapshotText(record.severity) || "unknown",
    title: normalizeSnapshotText(record.title) || "Insight sem titulo",
    classId: normalizeNullableId(record.classId),
    studentId: normalizeNullableId(record.studentId),
  };
};

const normalizeAppSnapshotAction = (value: unknown): AppSnapshotAction | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const actionTitle = normalizeSnapshotText(record.actionTitle);
  if (!actionTitle) return null;
  return {
    actionTitle,
    status: normalizeSnapshotText(record.status) || "unknown",
    createdAt: normalizeSnapshotText(record.createdAt) || "",
  };
};

const normalizeAppSnapshot = (value: unknown): AppSnapshotPayload | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const activeSignal = normalizeAppSnapshotSignal(record.activeSignal);
  const signalsTop = Array.isArray(record.signalsTop)
    ? record.signalsTop
        .map((item) => normalizeAppSnapshotSignal(item))
        .filter((item): item is AppSnapshotSignal => Boolean(item))
        .slice(0, APP_SNAPSHOT_MAX_SIGNALS)
    : [];
  const recentActions = Array.isArray(record.recentActions)
    ? record.recentActions
        .map((item) => normalizeAppSnapshotAction(item))
        .filter((item): item is AppSnapshotAction => Boolean(item))
        .slice(0, APP_SNAPSHOT_MAX_ACTIONS)
    : [];
  const regulationContextRaw =
    record.regulationContext && typeof record.regulationContext === "object"
      ? (record.regulationContext as Record<string, unknown>)
      : null;
  const regulationContext = regulationContextRaw
    ? {
        activeRuleSetId: normalizeNullableId(regulationContextRaw.activeRuleSetId),
        pendingRuleSetId: normalizeNullableId(regulationContextRaw.pendingRuleSetId),
        latestUpdateIds: normalizeStringList(regulationContextRaw.latestUpdateIds, 8),
        latestChangedTopics: normalizeStringList(
          regulationContextRaw.latestChangedTopics,
          8
        ),
        impactAreas: normalizeStringList(regulationContextRaw.impactAreas, 8),
      }
    : null;
  const screen = normalizeNullableId(record.screen);
  const contextTitle = normalizeNullableId(record.contextTitle);
  const snapshotVersion = Number.isFinite(Number(record.snapshotVersion))
    ? Number(record.snapshotVersion)
    : null;
  const snapshotHash = normalizeNullableId(record.snapshotHash);
  if (
    !screen &&
    !contextTitle &&
    !activeSignal &&
    !signalsTop.length &&
    !recentActions.length &&
    !regulationContext
  ) {
    return null;
  }
  return {
    snapshotVersion,
    snapshotHash,
    screen,
    contextTitle,
    activeSignal,
    signalsTop,
    recentActions,
    regulationContext,
  };
};

const buildAppSnapshotContext = (snapshot: AppSnapshotPayload | null) => {
  if (!snapshot) return "APP_SNAPSHOT: sem contexto operacional adicional.";
  const lines: string[] = [];
  if (snapshot.screen) lines.push(`screen: ${snapshot.screen}`);
  if (snapshot.contextTitle) lines.push(`contextTitle: ${snapshot.contextTitle}`);
  if (snapshot.snapshotVersion) lines.push(`snapshotVersion: ${snapshot.snapshotVersion}`);
  if (snapshot.snapshotHash) lines.push(`snapshotHash: ${snapshot.snapshotHash}`);
  if (snapshot.activeSignal) {
    lines.push(
      `activeSignal: ${snapshot.activeSignal.title} [${snapshot.activeSignal.severity}]`
    );
  }
  if (snapshot.signalsTop.length) {
    lines.push("signalsTop:");
    for (const signal of snapshot.signalsTop) {
      lines.push(`- ${signal.title} [${signal.severity}]`);
    }
  }
  if (snapshot.recentActions.length) {
    lines.push("recentActions:");
    for (const action of snapshot.recentActions) {
      lines.push(`- ${action.actionTitle} (${action.status})`);
    }
  }
  if (snapshot.regulationContext) {
    lines.push("regulationContext:");
    if (snapshot.regulationContext.activeRuleSetId) {
      lines.push(`- activeRuleSetId: ${snapshot.regulationContext.activeRuleSetId}`);
    }
    if (snapshot.regulationContext.pendingRuleSetId) {
      lines.push(`- pendingRuleSetId: ${snapshot.regulationContext.pendingRuleSetId}`);
    }
    if (snapshot.regulationContext.latestChangedTopics.length) {
      lines.push(
        `- latestChangedTopics: ${snapshot.regulationContext.latestChangedTopics.join(", ")}`
      );
    }
    if (snapshot.regulationContext.impactAreas.length) {
      lines.push(`- impactAreas: ${snapshot.regulationContext.impactAreas.join(", ")}`);
    }
  }
  if (!lines.length) {
    return "APP_SNAPSHOT: sem contexto operacional adicional.";
  }
  return `APP_SNAPSHOT:\n${lines.join("\n")}`;
};

const systemPrompt = [
  "You are a volleyball and training assistant for a coaching app.",
  "Always base answers on provided sources and retrieved documents.",
  "Scientific evidence documents (level=evidence) are top priority when available.",
  "Return a JSON object only, no extra text.",
  "If suggesting drills from videos, include author and a stable URL.",
  "Never invent evidence. If evidence is not sufficient, lower confidence and list missing data.",
  "Every practical recommendation must be grounded in RAG_CONTEXT docs when provided.",
  "In citations, identify documents by docId in sourceTitle.",
  "If confidence is below 0.55, be explicit that recommendation is limited.",
  "Use simple Portuguese in the reply.",
  "All training alterations or pedagogical suggestions MUST be detailed in the pedagogicalDecisions field of the response.",
  "Avalie o histórico de aceitação e feedbacks do treinador em FACTS_MEMORY. Se o histórico indicar rejeições ou alterações frequentes de certas dinâmicas, adapte as próximas decisões pedagógicas para respeitar as preferências do treinador.",
].join(" ");

const responseSchema = {
  type: "object",
  properties: {
    reply: { type: "string" },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          url: { type: "string" },
        },
        required: ["title", "author", "url"],
        additionalProperties: false,
      },
    },
    draftTraining: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            title: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            warmup: { type: "array", items: { type: "string" } },
            main: { type: "array", items: { type: "string" } },
            cooldown: { type: "array", items: { type: "string" } },
            warmupTime: { type: "string" },
            mainTime: { type: "string" },
            cooldownTime: { type: "string" },
          },
          required: [
            "title",
            "tags",
            "warmup",
            "main",
            "cooldown",
            "warmupTime",
            "mainTime",
            "cooldownTime",
          ],
          additionalProperties: false,
        },
      ],
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    citations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sourceTitle: { type: "string" },
          evidence: { type: "string" },
        },
        required: ["sourceTitle", "evidence"],
        additionalProperties: false,
      },
    },
    assumptions: {
      type: "array",
      items: { type: "string" },
    },
    missingData: {
      type: "array",
      items: { type: "string" },
    },
    pedagogicalDecisions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          decision: { type: "string" },
          reason: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          based_on: {
            type: "array",
            items: { type: "string" }
          },
          sources: {
            type: "array",
            items: {
              type: "object",
              properties: {
                author: { type: "string" },
                concept: { type: "string" }
              },
              required: ["author", "concept"],
              additionalProperties: false
            }
          }
        },
        required: ["decision", "reason", "confidence", "based_on", "sources"],
        additionalProperties: false
      }
    }
  },
  required: [
    "reply",
    "sources",
    "draftTraining",
    "confidence",
    "citations",
    "assumptions",
    "missingData",
  ],
  additionalProperties: false,
};

Deno.serve(createEdgeFunction({
  name: "assistant",
  requireAuth: true,
  parseJson: true,
  handler: async ({ supabase, user, token, body, metrics, requestId }) => {
    const requestStartedAt = Date.now();
    const currentUser = user!;
    const currentToken = token!;

    const contentLength = Number.parseInt(body ? JSON.stringify(body).length.toString() : "0", 10);
    if (Number.isFinite(contentLength) && contentLength > ASSISTANT_MAX_REQUEST_BYTES) {
      return createError(413, "PAYLOAD_TOO_LARGE", `Payload too large (max ${ASSISTANT_MAX_REQUEST_BYTES} bytes)`);
    }

    const limiter = checkRateLimit(
      `assistant:${currentUser.id}`,
      ASSISTANT_RATE_LIMIT_PER_MINUTE,
      60_000
    );
    if (!limiter.allowed) {
      return createError(429, "RATE_LIMIT_EXCEEDED", `Rate limit exceeded. Retry after ${limiter.retryAfterSec}s.`);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error("assistant: missing OPENAI_API_KEY");
      return createError(500, "SERVER_ERROR", "Missing OpenAI credentials config");
    }

    // 1. Resolve AIContext on the backend (Identity + Navigation)
    const aiContext = await resolveAIContext(supabase, currentUser, body);
    const organizationId = aiContext.user.organizationId;

    const messages = normalizeClientMessages(body.messages);
    const classId = typeof body.classId === "string" ? body.classId : "";
    const sportHint = typeof body.sport === "string" && body.sport.trim().length > 0 ? body.sport.trim() : "volleyball";
    const debugRequested = Boolean(body.debug);
    const requestMemoryContext = normalizeMemoryContext(body.memoryContext);
    const appSnapshot = normalizeAppSnapshot(body.appSnapshot);
    const debugAllowed = canUseDebugMode(currentUser);

    if (debugRequested && !debugAllowed) {
      return createError(403, "FORBIDDEN", "Debug mode not allowed");
    }

    // 2. Regulation Resolver
    const regulationDeterministic = await resolveRegulationAssistantResponse({
      token: currentToken,
      organizationId,
      sportHint,
      messages,
      appSnapshot,
    });
    if (regulationDeterministic) {
      return createSuccess(regulationDeterministic);
    }

    // 3. Retrieval and Memory using Backend-Derived Org ID
    const queryType = inferQueryType(messages);
    const retrievalQuery = buildRetrievalQuery(messages);
    
    const retrieval = await getKnowledgeDocumentsCached({
      token: currentToken,
      organizationId,
      sportHint,
      queryText: retrievalQuery,
    });
    const kbDocs = retrieval.docs;

    const memoryEntries = await getMemoryContext({
      token: currentToken,
      organizationId,
      classId,
      userId: currentUser.id,
    });

    const memoryContext = [
      ...requestMemoryContext,
      ...memoryEntries.map((item) => `${item.role}/${item.scope}: ${item.content}`),
    ].slice(0, ASSISTANT_MAX_MEMORY_CONTEXT_ITEMS);

    const ragContext = buildRagContext(kbDocs);
    const scientificEvidenceContext = buildScientificEvidenceContext(kbDocs);
    const appSnapshotContext = buildAppSnapshotContext(appSnapshot);

    // Build Backend-driven System AI Context Prompt
    const aiContextPrompt = buildSystemAIContextPrompt(aiContext);

    // 4. Resolve AI Facts Memory Context
    const aiFacts = await resolveAIMemory(supabase, aiContext);
    const aiFactsPrompt = buildSystemAIMemoryPrompt(aiFacts);

    // 5. Resolve AI Governance Constraints
    const aiWarnings = await resolveAIGovernance(supabase, aiContext, body);
    const aiConstraintsPrompt = buildSystemAIGovernancePrompt(aiWarnings);

    console.log(
      JSON.stringify({
        event: "assistant_rag_retrieval",
        hasOrganizationId: Boolean(organizationId),
        sport: sportHint,
        queryType,
        hasClassId: Boolean(classId),
        hasAppSnapshot: Boolean(appSnapshot),
        retrieved_chunks_count: kbDocs.length,
        latency_ms_retrieval: retrieval.retrievalLatencyMs,
        cache_hit: retrieval.cacheHit,
        ai_facts_count: aiFacts.length,
        ai_warnings_count: aiWarnings.length
      })
    );

    // 6. OpenAI Payload Construction
    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: aiContextPrompt }, // Injected backend context!
        { role: "system", content: aiFactsPrompt }, // Injected structured facts memory!
        { role: "system", content: aiConstraintsPrompt }, // Injected safety constraints!
        { role: "system", content: scientificEvidenceContext },
        { role: "system", content: ragContext },
        { role: "system", content: appSnapshotContext },
        {
          role: "system",
          content: memoryContext.length
            ? `MEMORY_CONTEXT:\n${memoryContext.map((item) => `- ${item}`).join("\n")}`
            : "MEMORY_CONTEXT: sem memórias relevantes para esta consulta.",
        },
        ...messages,
      ] as ChatMessage[],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "assistant_response",
          schema: responseSchema,
          strict: true,
        },
      },
      temperature: 0.2,
      max_tokens: 900,
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("assistant: openai error", response.status, errorText);
      return createError(500, "SERVER_ERROR", "Failed to communicate with OpenAI");
    }

    const data = await response.json();
    
    // Track AI Usage via Observability Middleware
    const tokensIn = data.usage?.prompt_tokens ?? 0;
    const tokensOut = data.usage?.completion_tokens ?? 0;
    const latency = Date.now() - requestStartedAt;
    // Standard gpt-4o-mini pricing: $0.150 / 1M input, $0.600 / 1M output
    const costEstimate = (tokensIn * 0.15 + tokensOut * 0.6) / 1_000_000;
    metrics.trackAiUsage("openai", "gpt-4o-mini", tokensIn, tokensOut, latency, costEstimate);

    const content = data.choices?.[0]?.message?.content ?? "";
    let parsed: AssistantResponse;
    try {
      parsed = JSON.parse(content) as AssistantResponse;
    } catch (_error) {
      return createError(500, "SERVER_ERROR", "Received malformed response format from model");
    }

    if (!parsed || typeof parsed.reply !== "string") {
      parsed = {
        reply: "Não consegui gerar a resposta. Tente novamente.",
        sources: [],
        draftTraining: null,
        confidence: 0,
        citations: [],
        assumptions: [],
        missingData: ["Não foi possível interpretar a resposta da IA."],
        pedagogicalDecisions: []
      };
    }

    parsed.sources = Array.isArray(parsed.sources) ? parsed.sources : [];
    parsed.draftTraining = parsed.draftTraining ?? null;
    parsed.citations = Array.isArray(parsed.citations) ? parsed.citations : [];
    parsed.assumptions = Array.isArray(parsed.assumptions) ? parsed.assumptions : [];
    parsed.missingData = Array.isArray(parsed.missingData) ? parsed.missingData : [];
    parsed.pedagogicalDecisions = Array.isArray(parsed.pedagogicalDecisions) ? parsed.pedagogicalDecisions : [];
    parsed.confidence =
      Number.isFinite(parsed.confidence) && parsed.confidence >= 0 && parsed.confidence <= 1
        ? parsed.confidence
        : 0;

    if (kbDocs.length === 0) {
      parsed.missingData = Array.from(
        new Set([...(parsed.missingData ?? []), "Base de conhecimento sem documentos relevantes para esta consulta."])
      );
      parsed.confidence = Math.min(parsed.confidence, 0.54);
    }

    if (memoryContext.length > 0) {
      parsed.assumptions = Array.from(
        new Set([
          ...parsed.assumptions,
          `Contexto de memória aplicado (${memoryContext.length} item(ns)) com retenção limitada.`,
        ])
      );
    }

    if (debugRequested && debugAllowed) {
      parsed._debug = {
        orgId: organizationId,
        sport: sportHint,
        retrievedChunksCount: kbDocs.length,
        docIds: kbDocs.map((doc) => doc.id),
        retrievalLatencyMs: retrieval.retrievalLatencyMs,
        totalLatencyMs: Date.now() - requestStartedAt,
        cacheHit: retrieval.cacheHit,
        queryType,
      };
    }

    // SSRF URL Security Validation
    const checkedSources: AssistantSource[] = [];
    for (const source of parsed.sources) {
      const safeUrl = normalizePublicUrl(source.url);
      if (!safeUrl) {
        securityLogger.warn("ssrf_blocked", {
          reason: "invalid_model_url",
          hostname: (() => { try { return new URL(source.url).hostname; } catch { return "(unparseable)"; } })(),
        });
        continue;
      }
      const resolved = await resolveAndCheckPublicUrl(safeUrl);
      if (!resolved) {
        securityLogger.warn("ssrf_blocked", {
          reason: "model_url_resolves_to_private_ip",
          hostname: new URL(safeUrl).hostname,
        });
        continue;
      }
      checkedSources.push({ ...source, url: resolved });
    }
    parsed.sources = checkedSources;

    // 7. Persist Pedagogical Decision Traces
    if (parsed.pedagogicalDecisions && parsed.pedagogicalDecisions.length > 0) {
      const traces = parsed.pedagogicalDecisions.map((d) => {
        let confFloat = 0.50;
        if (d.confidence === "high") confFloat = 0.90;
        else if (d.confidence === "medium") confFloat = 0.70;
        else if (d.confidence === "low") confFloat = 0.40;

        return {
          request_id: requestId,
          organization_id: organizationId,
          user_id: currentUser.id,
          class_id: classId || null,
          decision: d.decision,
          reason: d.reason,
          confidence: confFloat,
          based_on: d.based_on,
          sources: d.sources,
        };
      });

      const { error: tracesError } = await supabase
        .from("ai_decision_traces")
        .insert(traces);
      
      if (tracesError) {
        console.error("[Decision Tracing Error]: Failed to save traces:", tracesError);
      }
    }

    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user" && typeof message.content === "string")?.content;

    if (lastUserMessage) {
      await saveMemoryEntry({
        token: currentToken,
        organizationId,
        classId,
        userId: currentUser.id,
        role: "user",
        content: lastUserMessage,
      });
    }

    await saveMemoryEntry({
      token: currentToken,
      organizationId,
      classId,
      userId: currentUser.id,
      role: "assistant",
      content: parsed.reply,
    });

    return createSuccess(parsed);
  }
}));
