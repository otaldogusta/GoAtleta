import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type RetrievalResult = {
  docs: KbDocument[];
  cacheHit: boolean;
  retrievalLatencyMs: number;
};

const RETRIEVAL_CACHE_TTL_MS = 120_000;
const RETRIEVAL_CACHE_MAX_ITEMS = 120;
const retrievalCache = new Map<string, { expiresAt: number; docs: KbDocument[] }>();
const retrievalInFlight = new Map<string, Promise<RetrievalResult>>();

const isPrivateIpv4 = (host: string) => {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const parts = host.split(".").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }
  const [first, second] = parts;
  if (first === 10 || first === 127 || first === 0) return true;
  if (first === 169 && second === 254) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  return false;
};

const isPrivateIpv6 = (host: string) => {
  const normalized = host.toLowerCase();
  if (!normalized.includes(":")) return false;
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  return false;
};

const isPrivateHost = (host: string) => {
  const normalized = host.toLowerCase();
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }
  if (isPrivateIpv4(normalized) || isPrivateIpv6(normalized)) return true;
  return false;
};

const normalizePublicUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    if (!url.hostname || isPrivateHost(url.hostname)) return "";
    return url.toString();
  } catch {
    return "";
  }
};

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

const rankKbDocuments = (documents: KbDocument[], queryText: string) => {
  const queryTokens = tokenize(queryText);
  if (!queryTokens.length) return documents.slice(0, 4);

  const scored = documents
    .map((document) => {
      const haystack = normalizeText(
        `${document.title} ${document.tags.join(" ")} ${document.chunk}`
      );
      const matches = queryTokens.reduce((acc, token) => {
        return haystack.includes(token) ? acc + 1 : acc;
      }, 0);
      const density = matches / queryTokens.length;
      const exactTagBoost = document.tags.some((tag) =>
        queryTokens.includes(normalizeText(tag))
      )
        ? 0.2
        : 0;
      return {
        document,
        score: density + exactTagBoost,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return documents.slice(0, 4);
  return scored.slice(0, 4).map((item) => item.document);
};

const buildRagContext = (documents: KbDocument[]) => {
  if (!documents.length) return "RAG_CONTEXT: sem documentos relevantes recuperados.";
  const entries = documents.map((document, index) => {
    const excerpt = document.chunk.length > 700 ? `${document.chunk.slice(0, 700)}...` : document.chunk;
    return [
      `Doc ${index + 1}`,
      `docId: ${document.id}`,
      `title: ${document.title || "Sem título"}`,
      `source: ${document.source || "Sem fonte"}`,
      `tags: ${(document.tags ?? []).join(", ")}`,
      `chunk: ${excerpt}`,
    ].join("\n");
  });
  return [
    "RAG_CONTEXT: use apenas estes documentos para evidência e citação.",
    ...entries,
    "Regra: toda recomendação prática deve apontar no campo citations ao menos um docId usado.",
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
    .select("id,organization_id,title,source,chunk,tags,sport,level,created_at")
    .eq("organization_id", params.organizationId)
    .limit(80);

  if (sportCandidates.length) {
    query = query.in("sport", Array.from(new Set(sportCandidates)));
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return [];

  const mapped: KbDocument[] = data.map((row) => ({
    id: String(row.id ?? ""),
    organizationId: String(row.organization_id ?? ""),
    title: String(row.title ?? ""),
    source: String(row.source ?? ""),
    chunk: String(row.chunk ?? ""),
    tags: Array.isArray(row.tags) ? row.tags.map((tag) => String(tag)) : [],
    sport: String(row.sport ?? ""),
    level: String(row.level ?? ""),
    createdAt: String(row.created_at ?? ""),
  }));

  return rankKbDocuments(mapped, params.queryText);
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

const systemPrompt = [
  "You are a volleyball and training assistant for a coaching app.",
  "Always base answers on provided sources and retrieved documents.",
  "Return a JSON object only, no extra text.",
  "If suggesting drills from videos, include author and a stable URL.",
  "Never invent evidence. If evidence is not sufficient, lower confidence and list missing data.",
  "Every practical recommendation must be grounded in RAG_CONTEXT docs when provided.",
  "In citations, identify documents by docId in sourceTitle.",
  "If confidence is below 0.55, be explicit that recommendation is limited.",
  "Use simple Portuguese in the reply.",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestStartedAt = Date.now();
    console.log("assistant: request received");
    const auth = await requireUser(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error("assistant: missing OPENAI_API_KEY");
      return new Response(
        JSON.stringify({ error: "Missing OPENAI_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const classId = typeof body.classId === "string" ? body.classId : "";
    const organizationIdRaw =
      typeof body.organizationId === "string"
        ? body.organizationId
        : typeof body.organization_id === "string"
          ? body.organization_id
          : "";
    const organizationId = organizationIdRaw.trim();
    const sportHint =
      typeof body.sport === "string" && body.sport.trim().length > 0
        ? body.sport.trim()
        : "volleyball";
    const debugRequested = Boolean(body.debug);
        const requestMemoryContext = Array.isArray(body.memoryContext)
          ? body.memoryContext.map((item: unknown) => String(item || "").trim()).filter(Boolean)
          : [];
    const debugAllowed = canUseDebugMode(auth.user);
    if (debugRequested && !debugAllowed) {
      return new Response(JSON.stringify({ error: "Debug mode not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const queryType = inferQueryType(messages);
    const userHint = classId ? `Turma selecionada: ${classId}.` : "";
    const retrievalQuery = buildRetrievalQuery(messages);
    if (!organizationId) {
      console.warn(
        JSON.stringify({
          event: "assistant_rag_missing_org_id",
          queryType,
          classId,
          sport: sportHint,
        })
      );
    }
    const retrieval = await getKnowledgeDocumentsCached({
      token: auth.token,
      organizationId,
      sportHint,
      queryText: retrievalQuery,
    });
    const kbDocs = retrieval.docs;
    const memoryEntries = await getMemoryContext({
      token: auth.token,
      organizationId,
      classId,
      userId: auth.user.id,
    });
    const memoryContext = [
      ...requestMemoryContext,
      ...memoryEntries.map((item) => `${item.role}/${item.scope}: ${item.content}`),
    ].slice(0, 6);
    const ragContext = buildRagContext(kbDocs);
    console.log(
      JSON.stringify({
        event: "assistant_rag_retrieval",
        orgId: organizationId,
        sport: sportHint,
        queryType,
        classId,
        retrieved_chunks_count: kbDocs.length,
        docIds: kbDocs.map((doc) => doc.id),
        latency_ms_retrieval: retrieval.retrievalLatencyMs,
        cache_hit: retrieval.cacheHit,
      })
    );

    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: userHint },
        { role: "system", content: ragContext },
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
      return new Response(
        JSON.stringify({ error: "OpenAI error", detail: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    let parsed: AssistantResponse;
    try {
      parsed = JSON.parse(content) as AssistantResponse;
    } catch (_error) {
      return new Response(
        JSON.stringify({ error: "Invalid assistant response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      };
    }

    parsed.sources = Array.isArray(parsed.sources) ? parsed.sources : [];
    parsed.draftTraining = parsed.draftTraining ?? null;
    parsed.citations = Array.isArray(parsed.citations) ? parsed.citations : [];
    parsed.assumptions = Array.isArray(parsed.assumptions) ? parsed.assumptions : [];
    parsed.missingData = Array.isArray(parsed.missingData) ? parsed.missingData : [];
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

    const checkedSources: AssistantSource[] = [];
    for (const source of parsed.sources) {
      const safeUrl = normalizePublicUrl(source.url);
      if (!safeUrl) continue;
      try {
        const head = await fetch(safeUrl, { method: "HEAD", redirect: "follow" });
        if (head.ok || (head.status >= 300 && head.status < 400)) {
          checkedSources.push({ ...source, url: safeUrl });
          continue;
        }
        const get = await fetch(safeUrl, { method: "GET", redirect: "follow" });
        if (get.ok || (get.status >= 300 && get.status < 400)) {
          checkedSources.push({ ...source, url: safeUrl });
        }
      } catch (_error) {
        continue;
      }
    }
    parsed.sources = checkedSources;

    console.log(
      JSON.stringify({
        event: "assistant_response",
        orgId: organizationId,
        sport: sportHint,
        queryType,
        citations_count: parsed.citations.length,
        confidence: parsed.confidence,
        missing_data_count: parsed.missingData.length,
        latency_ms_total: Date.now() - requestStartedAt,
      })
    );

    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user" && typeof message.content === "string")?.content;

    if (lastUserMessage) {
      await saveMemoryEntry({
        token: auth.token,
        organizationId,
        classId,
        userId: auth.user.id,
        role: "user",
        content: lastUserMessage,
      });
    }

    await saveMemoryEntry({
      token: auth.token,
      organizationId,
      classId,
      userId: auth.user.id,
      role: "assistant",
      content: parsed.reply,
    });

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("assistant: failure", String(error));
    return new Response(
      JSON.stringify({ error: "Assistant failure", detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
