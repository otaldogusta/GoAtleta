import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UserContext = {
  userId: string;
  token: string;
};

type PubMedStudy = {
  pmid: string;
  title: string;
  journal: string;
  publishedAt: string;
  abstract: string;
  url: string;
  authors: string[];
};

type SummaryPayload = {
  headline: string;
  practicalTakeaways: string[];
  limitations: string[];
  confidence: "low" | "medium" | "high";
  suggestedTags: string[];
};

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

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

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const parseJson = async (req: Request) => {
  try {
    return await req.json();
  } catch {
    return null;
  }
};

const requireUser = async (req: Request): Promise<UserContext | null> => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  const supabase = createSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return { userId: data.user.id, token };
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) return [] as string[];
  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
};

const unique = <T>(list: T[]) => [...new Set(list)];

const inferTags = (studies: PubMedStudy[]) => {
  const tokens = studies.flatMap((study) =>
    tokenize(`${study.title} ${study.abstract}`).slice(0, 24)
  );
  const frequencies = new Map<string, number>();
  tokens.forEach((token) => {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  });
  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([token]) => token);
};

const inferConfidence = (studies: PubMedStudy[]): SummaryPayload["confidence"] => {
  if (studies.length >= 5) return "high";
  if (studies.length >= 3) return "medium";
  return "low";
};

const esc = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePubDateYear = (value: string) => {
  const match = value.match(/(19|20)\d{2}/);
  return match ? match[0] : value;
};

const fetchPubMedIds = async (query: string, maxResults: number) => {
  const url = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=${maxResults}&term=${encodeURIComponent(
    query
  )}`;
  const response = await fetch(url, { headers: { "User-Agent": "GoAtleta/1.0" } });
  if (!response.ok) {
    throw new Error("Falha ao buscar IDs no PubMed.");
  }
  const payload = (await response.json()) as {
    esearchresult?: { idlist?: string[] };
  };
  return payload.esearchresult?.idlist ?? [];
};

const fetchPubMedSummary = async (ids: string[]) => {
  if (!ids.length) return [] as PubMedStudy[];
  const url = `${PUBMED_BASE}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`;
  const response = await fetch(url, { headers: { "User-Agent": "GoAtleta/1.0" } });
  if (!response.ok) {
    throw new Error("Falha ao buscar resumo no PubMed.");
  }

  const payload = (await response.json()) as {
    result?: {
      uids?: string[];
      [key: string]: unknown;
    };
  };

  const result = payload.result ?? {};
  const uids = (result.uids ?? ids).filter(Boolean);

  return uids.map((uid) => {
    const item = (result[uid] ?? {}) as {
      title?: string;
      fulljournalname?: string;
      pubdate?: string;
      authors?: Array<{ name?: string }>;
    };
    const authors = (item.authors ?? [])
      .map((author) => author?.name?.trim() ?? "")
      .filter(Boolean)
      .slice(0, 6);

    return {
      pmid: uid,
      title: item.title?.trim() || "Sem título",
      journal: item.fulljournalname?.trim() || "",
      publishedAt: parsePubDateYear(item.pubdate ?? ""),
      abstract: "",
      url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
      authors,
    };
  });
};

const fetchPubMedAbstracts = async (ids: string[]) => {
  if (!ids.length) return new Map<string, string>();

  const url = `${PUBMED_BASE}/efetch.fcgi?db=pubmed&retmode=xml&id=${ids.join(",")}`;
  const response = await fetch(url, { headers: { "User-Agent": "GoAtleta/1.0" } });
  if (!response.ok) return new Map<string, string>();

  const xml = await response.text();
  const map = new Map<string, string>();

  ids.forEach((id) => {
    const articleRegex = new RegExp(
      `<PubmedArticle>[\\s\\S]*?<PMID[^>]*>${esc(id)}</PMID>[\\s\\S]*?</PubmedArticle>`,
      "i"
    );
    const articleMatch = xml.match(articleRegex);
    if (!articleMatch) {
      map.set(id, "");
      return;
    }

    const abstractMatches = [...articleMatch[0].matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi)];
    const abstract = abstractMatches
      .map((match) =>
        match[1]
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean)
      .join(" ");

    map.set(id, abstract);
  });

  return map;
};

const ensureMember = async (ctx: UserContext, organizationId: string) => {
  const supabase = createSupabaseClientWithToken(ctx.token);
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.user_id);
};

const ensureOrgAdmin = async (ctx: UserContext, organizationId: string) => {
  const supabase = createSupabaseClientWithToken(ctx.token);
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("organization_members")
    .select("role_level")
    .eq("organization_id", organizationId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (error) return false;
  return Number(data?.role_level ?? 0) >= 50;
};

const ensureStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    : [];

const handleSearch = async (payload: Record<string, unknown>) => {
  const query = String(payload.query ?? "").trim();
  const maxResults = Math.min(Math.max(Number(payload.maxResults ?? 8) || 8, 1), 20);

  if (!query || query.length < 3) {
    return jsonResponse({ error: "Informe uma busca com pelo menos 3 caracteres." }, 400);
  }

  const ids = await fetchPubMedIds(query, maxResults);
  if (!ids.length) {
    return jsonResponse({ studies: [] });
  }

  const [summaryRows, abstractMap] = await Promise.all([
    fetchPubMedSummary(ids),
    fetchPubMedAbstracts(ids),
  ]);

  const studies = summaryRows.map((row) => ({
    ...row,
    abstract: abstractMap.get(row.pmid) ?? "",
  }));

  return jsonResponse({ studies });
};

const handleSummarize = async (payload: Record<string, unknown>) => {
  const studies = Array.isArray(payload.studies)
    ? (payload.studies as PubMedStudy[])
    : [];
  const question = String(payload.question ?? "").trim();

  if (!studies.length) {
    return jsonResponse({ error: "Selecione ao menos um estudo para resumir." }, 400);
  }

  const firstTitle = studies[0]?.title || "Conjunto de estudos";
  const confidence = inferConfidence(studies);
  const suggestedTags = unique(inferTags(studies));

  const practicalTakeaways = studies
    .slice(0, 4)
    .map((study) => {
      const year = study.publishedAt ? ` (${study.publishedAt})` : "";
      const anchor = study.journal ? `${study.journal}${year}` : `PubMed${year}`;
      return `${study.title} — aplicar como referência em progressões semanais; fonte: ${anchor}.`;
    });

  const limitations = [
    "Heterogeneidade entre protocolos e amostras dos estudos selecionados.",
    "Requer adaptação ao contexto da turma, idade e volume semanal local.",
    "Ausência de validação clínica individual para cada atleta do grupo.",
  ];

  const summary: SummaryPayload = {
    headline: question
      ? `Síntese para: ${question}`
      : `Síntese de evidências baseada em ${studies.length} estudo(s) PubMed`,
    practicalTakeaways,
    limitations,
    confidence,
    suggestedTags,
  };

  return jsonResponse({ summary });
};

const handleApprove = async (ctx: UserContext, payload: Record<string, unknown>) => {
  const organizationId = String(payload.organizationId ?? "").trim();
  if (!organizationId) {
    return jsonResponse({ error: "organizationId é obrigatório para aprovação." }, 400);
  }

  const isAdmin = await ensureOrgAdmin(ctx, organizationId);
  if (!isAdmin) {
    return jsonResponse({ error: "Apenas admins da organização podem aprovar evidências." }, 403);
  }

  const studies = Array.isArray(payload.studies)
    ? (payload.studies as PubMedStudy[])
    : [];
  const summary = (payload.summary ?? null) as SummaryPayload | null;
  const sport = String(payload.sport ?? "volleyball").trim() || "volleyball";
  const level = String(payload.level ?? "general").trim() || "general";

  if (!studies.length) {
    return jsonResponse({ error: "Nenhum estudo selecionado para aprovação." }, 400);
  }

  const supabase = createSupabaseClientWithToken(ctx.token);
  if (!supabase) {
    return jsonResponse({ error: "Configuração de Supabase indisponível." }, 500);
  }

  const tags = unique([
    ...ensureStringArray(summary?.suggestedTags),
    ...inferTags(studies),
  ]).slice(0, 12);

  const nowIso = new Date().toISOString();

  const rows = studies.map((study) => {
    const safeTitle = study.title?.trim() || `PubMed ${study.pmid}`;
    const abstractText = study.abstract?.trim() || "Sem resumo textual disponível no PubMed.";
    const summaryChunk = summary
      ? [
          `headline: ${summary.headline}`,
          `confidence: ${summary.confidence}`,
          `takeaways: ${summary.practicalTakeaways.join(" | ")}`,
          `limitations: ${summary.limitations.join(" | ")}`,
        ].join("\n")
      : "";

    const chunk = [
      `title: ${safeTitle}`,
      `journal: ${study.journal || "n/a"}`,
      `published_at: ${study.publishedAt || "n/a"}`,
      `authors: ${study.authors?.join(", ") || "n/a"}`,
      `abstract: ${abstractText}`,
      summaryChunk,
      `source_url: ${study.url}`,
      `approved_at: ${nowIso}`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      id: `pmid:${study.pmid}`,
      organization_id: organizationId,
      title: safeTitle,
      source: study.url || `https://pubmed.ncbi.nlm.nih.gov/${study.pmid}/`,
      chunk,
      embedding: [],
      tags,
      sport,
      level,
    };
  });

  const { error } = await supabase
    .from("kb_documents")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    return jsonResponse({ error: error.message || "Falha ao salvar evidências aprovadas." }, 500);
  }

  return jsonResponse({
    approvedCount: rows.length,
    documentIds: rows.map((row) => row.id),
  });
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const ctx = await requireUser(req);
    if (!ctx) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const payload = (await parseJson(req)) as Record<string, unknown> | null;
    if (!payload) {
      return jsonResponse({ error: "Payload inválido." }, 400);
    }

    const action = String(payload.action ?? "").trim().toLowerCase();
    const organizationId = String(payload.organizationId ?? "").trim();

    if (organizationId) {
      const member = await ensureMember(ctx, organizationId);
      if (!member) {
        return jsonResponse({ error: "Usuário sem acesso a esta organização." }, 403);
      }
    }

    if (action === "search") {
      return await handleSearch(payload);
    }

    if (action === "summarize") {
      return await handleSummarize(payload);
    }

    if (action === "approve") {
      return await handleApprove(ctx, payload);
    }

    return jsonResponse({ error: "Ação inválida. Use search, summarize ou approve." }, 400);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Erro interno inesperado.";
    return jsonResponse({ error: detail }, 500);
  }
});
