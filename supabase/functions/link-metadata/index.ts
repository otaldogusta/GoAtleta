import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  if (error || !data?.user) return null;
  return data.user;
};

const extractMeta = (html: string, key: string) => {
  const metaTag = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const match = html.match(metaTag);
  return match ? match[1].trim() : "";
};

const extractTitle = (html: string) => {
  const ogTitle =
    extractMeta(html, "og:title") || extractMeta(html, "twitter:title");
  if (ogTitle) return ogTitle;
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "";
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
    const { url } = await req.json();
    const normalized = normalizePublicUrl(String(url ?? ""));
    if (!normalized) {
      return new Response(
        JSON.stringify({ error: "URL invalida." }),
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
          title?: string;
          author_name?: string;
          thumbnail_url?: string;
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
      if (isYouTube(normalized)) {
        const shortMatch = html.match(/"shortDescription":"(.*?)"/);
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
        const channelMatch = html.match(/"ownerChannelName":"(.*?)"/);
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
