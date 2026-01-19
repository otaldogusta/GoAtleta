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

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type DraftTraining = {
  id?: string;
  classId?: string;
  title: string;
  tags: string[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmupTime: string;
  mainTime: string;
  cooldownTime: string;
};

type AssistantResponse = {
  reply: string;
  sources: AssistantSource[];
  draftTraining?: DraftTraining | null;
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

const systemPrompt = [
  "You are a volleyball and training assistant for a coaching app.",
  "Always base answers on scientific sources or reputable coaching references.",
  "Return a JSON object only, no extra text.",
  "If suggesting drills from videos, include author and a stable URL.",
  "If unsure, say so and avoid hallucinating citations.",
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
  },
  required: ["reply", "sources", "draftTraining"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("assistant: request received");
    const user = await requireUser(req);
    if (!user) {
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
    const userHint = classId ? `Turma selecionada: ${classId}.` : "";
    console.log("assistant: messages", messages.length, "classId", classId);

    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: userHint },
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
        reply: "Nao consegui gerar a resposta. Tente novamente.",
        sources: [],
        draftTraining: null,
      };
    }

    parsed.sources = Array.isArray(parsed.sources) ? parsed.sources : [];
    parsed.draftTraining = parsed.draftTraining ?? null;

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

    console.log("assistant: success");
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
