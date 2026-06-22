import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

const RATE_LIMIT_STORE =
  (globalThis as unknown as {
    __linkMetadataRateLimitStore?: Map<string, { count: number; resetAt: number }>;
  }).__linkMetadataRateLimitStore ??
  new Map<string, { count: number; resetAt: number }>();

(globalThis as unknown as { __linkMetadataRateLimitStore?: typeof RATE_LIMIT_STORE }).__linkMetadataRateLimitStore =
  RATE_LIMIT_STORE;

const checkRateLimit = (
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult => {
  const now = Date.now();
  const previous = RATE_LIMIT_STORE.get(key);
  if (!previous || now >= previous.resetAt) {
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt: now + windowMs });
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
  RATE_LIMIT_STORE.set(key, previous);
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - previous.count),
    retryAfterSec: Math.max(1, Math.ceil((previous.resetAt - now) / 1000)),
  };
};

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

const requireUser = async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  const supabase = createSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
};

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    )
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const compactWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const normalizeMetadataText = (value: string) =>
  compactWhitespace(decodeHtmlEntities(value))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const stripHtmlToText = (value: string) =>
  decodeHtmlEntities(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|h1|h2|h3|li|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

const decodeJsonString = (value: string) => {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value
      .replace(/\\u([0-9a-f]{4})/gi, (_, code: string) =>
        String.fromCharCode(Number.parseInt(code, 16))
      )
      .replace(/\\n|\\r|\\t/g, " ")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
};

const isGenericMetadataText = (value?: string | null) => {
  const text = normalizeMetadataText(value ?? "");
  if (!text) return true;
  return (
    text === "instagram" ||
    text === "pinterest" ||
    text === "youtube" ||
    text.includes("encontre e salve") ||
    text.includes("seus proprios pins") ||
    text.includes("pin em ") ||
    text.includes("pin on ") ||
    text.includes("entrar") && text.includes("criar conta") ||
    text.includes("adicionar comentario") ||
    text.includes("comentarios") ||
    text.includes("log in") && text.includes("sign up") ||
    text.includes("instagram photos and videos") ||
    text.includes("likes") && text.includes("comments")
  );
};

const sportsMetadataTerms = [
  "atividade",
  "aquecimento",
  "bola",
  "core",
  "defesa",
  "defensor",
  "dupla",
  "duplas",
  "exercicio",
  "exercício",
  "forca",
  "força",
  "jogo",
  "jogos",
  "manchete",
  "mobilidade",
  "passe",
  "queimada",
  "reativa",
  "saque",
  "treino",
  "variacao",
  "variação",
  "voleibol",
  "volleyball",
];

const metadataScore = (value: string, kind: "title" | "description") => {
  const compact = compactWhitespace(value);
  const normalized = normalizeMetadataText(compact);
  if (!compact || isGenericMetadataText(compact)) return -1000;
  let score = 0;
  const length = compact.length;
  sportsMetadataTerms.forEach((term) => {
    if (normalized.includes(normalizeMetadataText(term))) score += 10;
  });
  if (kind === "title") {
    if (length >= 6 && length <= 90) score += 35;
    if (length > 120) score -= 40;
  } else {
    if (length >= 40 && length <= 900) score += 35;
    if (length > 1200) score -= 25;
  }
  return score;
};

const addCandidate = (target: string[], value?: unknown) => {
  if (typeof value !== "string") return;
  const cleaned = compactWhitespace(stripHtmlToText(value));
  if (!cleaned || isGenericMetadataText(cleaned)) return;
  if (!target.some((item) => normalizeMetadataText(item) === normalizeMetadataText(cleaned))) {
    target.push(cleaned);
  }
};

const pickBestCandidate = (candidates: string[], kind: "title" | "description") =>
  [...candidates]
    .sort((a, b) => metadataScore(b, kind) - metadataScore(a, kind))
    .find((candidate) => metadataScore(candidate, kind) > 0) ?? "";

type MetadataCandidates = {
  titles: string[];
  descriptions: string[];
  authors: string[];
  images: string[];
  dates: string[];
};

const createMetadataCandidates = (): MetadataCandidates => ({
  titles: [],
  descriptions: [],
  authors: [],
  images: [],
  dates: [],
});

const collectJsonCandidates = (
  value: unknown,
  candidates: MetadataCandidates,
  depth = 0,
  parentKey = ""
) => {
  if (depth > 8 || value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonCandidates(item, candidates, depth + 1, parentKey));
    return;
  }
  if (typeof value !== "object") return;

  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    const normalizedKey = key.toLowerCase();
    const parentIsAuthor =
      parentKey.includes("author") ||
      parentKey.includes("creator") ||
      parentKey.includes("profile");
    if (typeof entry === "string") {
      if (["title", "name", "headline", "alternatename"].includes(normalizedKey) && !parentIsAuthor) {
        addCandidate(candidates.titles, entry);
      }
      if (
        ["description", "caption", "text", "articlebody", "transcript"].includes(
          normalizedKey
        )
      ) {
        addCandidate(candidates.descriptions, entry);
      }
      if (["author", "creator", "username"].includes(normalizedKey) || (normalizedKey === "name" && parentIsAuthor)) {
        addCandidate(candidates.authors, entry);
      }
      if (["image", "thumbnail", "thumbnailurl", "contenturl"].includes(normalizedKey)) {
        addCandidate(candidates.images, entry);
      }
      if (["datepublished", "uploaddate", "publishedat"].includes(normalizedKey)) {
        addCandidate(candidates.dates, entry);
      }
    }
    collectJsonCandidates(entry, candidates, depth + 1, normalizedKey);
  });
};

const extractJsonLdCandidates = (html: string, candidates: MetadataCandidates) => {
  const blocks = html.matchAll(
    /<script\b[^>]*type=["'][^"']*ld\+json[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const block of blocks) {
    const raw = decodeHtmlEntities(block[1] ?? "").trim();
    if (!raw) continue;
    try {
      collectJsonCandidates(JSON.parse(raw), candidates);
    } catch {
      // Some providers ship malformed JSON-LD; scripted JSON fallbacks handle those pages.
    }
  }
};

const extractScriptCandidates = (html: string, candidates: MetadataCandidates) => {
  const scripts = html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi);
  const titleRegex =
    /"(?:title|name|headline|grid_title|seoTitle)"\s*:\s*"((?:\\.|[^"\\]){4,500})"/gi;
  const descriptionRegex =
    /"(?:description|caption|text|articleBody|seoDescription|grid_description)"\s*:\s*"((?:\\.|[^"\\]){12,1200})"/gi;
  const authorRegex =
    /"(?:author_name|authorName|full_name|username|displayName)"\s*:\s*"((?:\\.|[^"\\]){2,200})"/gi;
  const imageRegex =
    /"(?:thumbnail_url|thumbnailUrl|contentUrl|image_url|imageUrl)"\s*:\s*"((?:\\.|[^"\\]){8,1000})"/gi;
  const dateRegex =
    /"(?:datePublished|uploadDate|publishedAt)"\s*:\s*"((?:\\.|[^"\\]){6,80})"/gi;

  for (const script of scripts) {
    const body = script[1] ?? "";
    for (const match of body.matchAll(titleRegex)) addCandidate(candidates.titles, decodeJsonString(match[1]));
    for (const match of body.matchAll(descriptionRegex)) addCandidate(candidates.descriptions, decodeJsonString(match[1]));
    for (const match of body.matchAll(authorRegex)) addCandidate(candidates.authors, decodeJsonString(match[1]));
    for (const match of body.matchAll(imageRegex)) addCandidate(candidates.images, decodeJsonString(match[1]));
    for (const match of body.matchAll(dateRegex)) addCandidate(candidates.dates, decodeJsonString(match[1]));
  }
};

const extractVisibleTextCandidates = (html: string, candidates: MetadataCandidates) => {
  const text = stripHtmlToText(html);
  const lines = text
    .split(/\n| {2,}/g)
    .map(compactWhitespace)
    .filter((line) => line.length >= 6 && line.length <= 900 && !isGenericMetadataText(line));

  lines.forEach((line) => {
    if (line.length <= 90) addCandidate(candidates.titles, line);
    if (line.length >= 35) addCandidate(candidates.descriptions, line);
  });
};

const enrichMetadataFromHtml = (
  html: string,
  current: {
    title: string;
    author: string;
    image: string;
    description: string;
    publishedAt: string;
  }
) => {
  const candidates = createMetadataCandidates();
  addCandidate(candidates.titles, current.title);
  addCandidate(candidates.descriptions, current.description);
  addCandidate(candidates.authors, current.author);
  addCandidate(candidates.images, current.image);
  addCandidate(candidates.dates, current.publishedAt);
  extractJsonLdCandidates(html, candidates);
  extractScriptCandidates(html, candidates);
  extractVisibleTextCandidates(html, candidates);

  const title =
    current.title && !isGenericMetadataText(current.title)
      ? current.title
      : pickBestCandidate(candidates.titles, "title");
  const description =
    current.description && !isGenericMetadataText(current.description)
      ? current.description
      : pickBestCandidate(candidates.descriptions, "description");

  return {
    title,
    author: current.author || candidates.authors[0] || "",
    image: current.image || candidates.images[0] || "",
    description,
    publishedAt: current.publishedAt || candidates.dates[0] || "",
  };
};

const extractMeta = (html: string, key: string) => {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const keyMatch = tag.match(/\b(?:property|name)=["']([^"']+)["']/i);
    if (keyMatch?.[1] !== key) continue;

    const contentMatch = tag.match(/\bcontent=["']([^"']*)["']/i);
    const content = contentMatch?.[1]?.trim();
    if (content) return decodeHtmlEntities(content);
  }
  return "";
};

const extractTitle = (html: string) => {
  const ogTitle =
    extractMeta(html, "og:title") || extractMeta(html, "twitter:title");
  if (ogTitle) return ogTitle;
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : "";
};

const extractAuthor = (html: string) => {
  const author =
    extractMeta(html, "author") ||
    extractMeta(html, "article:author") ||
    extractMeta(html, "twitter:creator");
  return author || "";
};

const extractDescription = (html: string) => {
  return (
    extractMeta(html, "og:description") ||
    extractMeta(html, "twitter:description") ||
    extractMeta(html, "description") ||
    ""
  );
};

const extractPublished = (html: string) => {
  const published =
    extractMeta(html, "article:published_time") ||
    extractMeta(html, "og:published_time") ||
    "";
  return published || "";
};

const extractImage = (html: string) => {
  return (
    extractMeta(html, "og:image") ||
    extractMeta(html, "twitter:image") ||
    ""
  );
};

const isYouTube = (value: string) =>
  value.includes("youtube.com") || value.includes("youtu.be");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await requireUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const maxRequestsPerMinute = Math.max(
      1,
      Number.parseInt(String(Deno.env.get("LINK_METADATA_RATE_LIMIT_PER_MIN") ?? "60"), 10) || 60
    );
    const limiter = checkRateLimit(
      `link-metadata:${user.id}`,
      maxRequestsPerMinute,
      60_000
    );
    if (!limiter.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAfterSec: limiter.retryAfterSec,
          maxRequestsPerMinute,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { url } = await req.json();
    const normalized = normalizePublicUrl(String(url ?? ""));
    if (!normalized) {
      return new Response(
        JSON.stringify({ error: "URL inválida." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let title = "";
    let author = "";
    let image = "";
    let description = "";
    let publishedAt = "";
    const host = new URL(normalized).host;

    if (isYouTube(normalized)) {
      const oembed = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(
          normalized
        )}&format=json`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      );
      if (oembed.ok) {
        const data = (await oembed.json()) as {
          title: string;
          author_name: string;
          thumbnail_url: string;
        };
        title = data.title ?? "";
        author = data.author_name ?? "";
        image = data.thumbnail_url ?? "";
      }
    }

    if (!title || !author || !image || !description || !publishedAt) {
      const response = await fetch(normalized, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });
      const html = await response.text();
      title = title || extractTitle(html);
      author = author || extractAuthor(html);
      image = image || extractImage(html);
      description = description || extractDescription(html);
      publishedAt = publishedAt || extractPublished(html);
      const enriched = enrichMetadataFromHtml(html, {
        title,
        author,
        image,
        description,
        publishedAt,
      });
      title = enriched.title;
      author = enriched.author;
      image = enriched.image;
      description = enriched.description;
      publishedAt = enriched.publishedAt;
      if (isYouTube(normalized)) {
        const shortMatch = html.match(/"shortDescription":"(.*)"/);
        if (shortMatch && !description) {
          try {
            description = JSON.parse(`"${shortMatch[1]}"`);
          } catch {
            description = shortMatch[1];
          }
        }
        const dateMatch = html.match(/"publishDate":"(\d{4}-\d{2}-\d{2})"/);
        if (dateMatch && !publishedAt) {
          publishedAt = dateMatch[1];
        }
        const channelMatch = html.match(/"ownerChannelName":"(.*)"/);
        if (channelMatch && !author) {
          try {
            author = JSON.parse(`"${channelMatch[1]}"`);
          } catch {
            author = channelMatch[1];
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        title,
        author,
        image,
        description,
        publishedAt,
        host,
        url: normalized,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
