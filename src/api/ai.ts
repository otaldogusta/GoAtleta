import { getValidAccessToken } from "../auth/session";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

type AssistantRole = "user" | "assistant";

type AssistantMessage = {
  role: AssistantRole;
  content: string;
};

type AssistantSource = {
  title: string;
  author: string;
  url: string;
};

type AssistantEnvelope = {
  reply: string;
  sources: AssistantSource[];
  draftTraining: unknown | null;
};

type AiCacheContext = {
  organizationId?: string | null;
  periodLabel?: string | null;
  scope?: string | null;
  ttlMs?: number;
};

type AiRequestOptions = {
  cache?: AiCacheContext;
};

export type ExecutiveSummaryInput = {
  syncHealth: unknown;
  slaStats: unknown;
  criticalClasses: unknown;
  pendingWritesDiagnostics: unknown;
  deadLettersRecent: unknown;
  topDelaysByTrainer: unknown;
  periodLabel?: string;
};

export type ExecutiveSummaryResult = {
  headline: string;
  highlights: string[];
  risks: string[];
  recommendedActions: string[];
};

export type TrainerMessageTone = "friendly" | "firm" | "formal" | "urgent";

export type TrainerMessageInput = {
  organizationName?: string;
  unit?: string;
  className?: string;
  trainerName?: string;
  lastReportAt?: string | null;
  daysWithoutReport?: number;
  pendingItems?: string[];
  expectedSla?: string;
};

export type TrainerMessageResult = {
  whatsapp: string;
  email: string;
  subject: string;
  oneLiner: string;
};

export type SyncErrorClassificationInput = {
  error: string;
  payload?: unknown;
  orgContext?: {
    organizationId?: string | null;
    organizationName?: string | null;
    userRole?: string | null;
  };
};

export type SyncErrorClassificationResult = {
  probableCause: string;
  recommendedAction: string;
  severity: "low" | "medium" | "high" | "critical";
  supportHint: string;
};

export type DataFixIssue = {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  entity: unknown;
  evidence: unknown;
};

export type DataFixSuggestionsInput = {
  issues: DataFixIssue[];
};

export type DataFixSuggestion = {
  issueType: string;
  explanation: string;
  options: string[];
  recommended: string;
};

export type DataFixSuggestionsResult = {
  summary: string;
  suggestions: DataFixSuggestion[];
};

const assistantUrl = `${SUPABASE_URL}/functions/v1/assistant`;
const DEFAULT_AI_CACHE_TTL_MS = 120_000;
const MAX_AI_CACHE_ITEMS = 200;

const aiResponseCache = new Map<string, { expiresAt: number; value: unknown }>();
const aiInFlightCache = new Map<string, Promise<unknown>>();

const stableSerialize = (value: unknown) =>
  JSON.stringify(value, (_key, nestedValue) => {
    if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
      const record = nestedValue as Record<string, unknown>;
      return Object.keys(record)
        .sort()
        .reduce<Record<string, unknown>>((accumulator, key) => {
          accumulator[key] = record[key];
          return accumulator;
        }, {});
    }
    return nestedValue;
  });

const buildAiCacheKey = (task: string, input: unknown, cache?: AiCacheContext) => {
  const org = cache?.organizationId ?? "org:none";
  const period = cache?.periodLabel ?? "period:none";
  const scope = cache?.scope ?? "scope:none";
  return [task, String(org), String(period), String(scope), stableSerialize(input)].join("|");
};

const pruneAiCacheIfNeeded = () => {
  if (aiResponseCache.size < MAX_AI_CACHE_ITEMS) return;
  const firstKey = aiResponseCache.keys().next().value;
  if (firstKey) {
    aiResponseCache.delete(firstKey);
  }
};

const withAiCache = async <T>(key: string, ttlMs: number, producer: () => Promise<T>): Promise<T> => {
  const now = Date.now();
  const cached = aiResponseCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  if (ttlMs <= 0) {
    return producer();
  }

  const inFlight = aiInFlightCache.get(key);
  if (inFlight) {
    return (await inFlight) as T;
  }

  const promise = producer()
    .then((result) => {
      pruneAiCacheIfNeeded();
      aiResponseCache.set(key, {
        expiresAt: Date.now() + ttlMs,
        value: result,
      });
      return result;
    })
    .finally(() => {
      aiInFlightCache.delete(key);
    });

  aiInFlightCache.set(key, promise);
  return promise;
};

export const clearAiCache = () => {
  aiResponseCache.clear();
  aiInFlightCache.clear();
};

const extractJsonObject = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const direct = tryParseJson(trimmed);
  if (direct) return direct;

  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeFenceMatch?.[1]) {
    const fromFence = tryParseJson(codeFenceMatch[1].trim());
    if (fromFence) return fromFence;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const fromSlice = tryParseJson(trimmed.slice(firstBrace, lastBrace + 1));
    if (fromSlice) return fromSlice;
  }

  return null;
};

const tryParseJson = (value: string) => {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const toStringArray = (value: unknown) =>
  Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];

const postAssistant = async (messages: AssistantMessage[], classId?: string) => {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Missing auth token");
  }

  const response = await fetch(assistantUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      messages,
      classId: classId ?? "",
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || "Assistant request failed");
  }

  return JSON.parse(text) as AssistantEnvelope;
};

const buildStructuredPrompt = (task: string, context: unknown, schemaHint: string) => {
  return [
    task,
    "Use apenas os dados fornecidos. Não invente números, datas, nomes ou métricas.",
    "Se faltar dado, escreva explicitamente 'dados insuficientes'.",
    "Responda SOMENTE com JSON válido no formato solicitado.",
    `Formato esperado: ${schemaHint}`,
    "Contexto JSON:",
    JSON.stringify(context),
  ].join("\n\n");
};

export async function generateExecutiveSummary(
  payload: ExecutiveSummaryInput,
  options?: AiRequestOptions
): Promise<ExecutiveSummaryResult> {
  const cacheKey = buildAiCacheKey("generateExecutiveSummary", payload, options?.cache);
  const ttlMs = options?.cache?.ttlMs ?? DEFAULT_AI_CACHE_TTL_MS;

  return withAiCache(cacheKey, ttlMs, async () => {
    const prompt = buildStructuredPrompt(
      "Transforme o contexto em resumo executivo para coordenação (direto e acionável). Liste os 5 principais problemas e ações recomendadas.",
      payload,
      "{ \"headline\": string, \"highlights\": string[], \"risks\": string[], \"recommendedActions\": string[] }"
    );

    const response = await postAssistant([{ role: "user", content: prompt }]);
    const json = extractJsonObject(response.reply) ?? {};

    return {
      headline: String(json.headline ?? "Resumo executivo indisponível"),
      highlights: toStringArray(json.highlights),
      risks: toStringArray(json.risks),
      recommendedActions: toStringArray(json.recommendedActions),
    };
  });
}

export async function generateTrainerMessage(
  context: TrainerMessageInput,
  tone: TrainerMessageTone,
  options?: AiRequestOptions
): Promise<TrainerMessageResult> {
  const input = { tone, context };
  const cacheKey = buildAiCacheKey("generateTrainerMessage", input, options?.cache);
  const ttlMs = options?.cache?.ttlMs ?? DEFAULT_AI_CACHE_TTL_MS;

  return withAiCache(cacheKey, ttlMs, async () => {
    const prompt = buildStructuredPrompt(
      `Gere mensagens para professor com tom '${tone}'. Produza uma versão WhatsApp, uma versão e-mail, um assunto e uma frase curta direta.`,
      input,
      "{ \"whatsapp\": string, \"email\": string, \"subject\": string, \"oneLiner\": string }"
    );

    const response = await postAssistant([{ role: "user", content: prompt }]);
    const json = extractJsonObject(response.reply) ?? {};

    return {
      whatsapp: String(json.whatsapp ?? ""),
      email: String(json.email ?? ""),
      subject: String(json.subject ?? ""),
      oneLiner: String(json.oneLiner ?? ""),
    };
  });
}

export async function classifySyncError(
  input: SyncErrorClassificationInput,
  options?: AiRequestOptions
): Promise<SyncErrorClassificationResult> {
  const cacheKey = buildAiCacheKey("classifySyncError", input, options?.cache);
  const ttlMs = options?.cache?.ttlMs ?? DEFAULT_AI_CACHE_TTL_MS;

  return withAiCache(cacheKey, ttlMs, async () => {
    const prompt = buildStructuredPrompt(
      "Classifique o erro de sync em termos operacionais (causa provável, ação recomendada, severidade e orientação para suporte).",
      input,
      "{ \"probableCause\": string, \"recommendedAction\": string, \"severity\": \"low\"|\"medium\"|\"high\"|\"critical\", \"supportHint\": string }"
    );

    const response = await postAssistant([{ role: "user", content: prompt }]);
    const json = extractJsonObject(response.reply) ?? {};
    const severity = String(json.severity ?? "medium");

    return {
      probableCause: String(json.probableCause ?? "dados insuficientes"),
      recommendedAction: String(json.recommendedAction ?? "Revisar autenticação, permissão e organização ativa."),
      severity:
        severity === "low" || severity === "medium" || severity === "high" || severity === "critical"
          ? severity
          : "medium",
      supportHint: String(json.supportHint ?? "Coletar payload, erro bruto e organizationId antes de escalar."),
    };
  });
}

export async function suggestDataFixes(
  input: DataFixSuggestionsInput,
  options?: AiRequestOptions
): Promise<DataFixSuggestionsResult> {
  const cacheKey = buildAiCacheKey("suggestDataFixes", input, options?.cache);
  const ttlMs = options?.cache?.ttlMs ?? DEFAULT_AI_CACHE_TTL_MS;

  return withAiCache(cacheKey, ttlMs, async () => {
    const prompt = buildStructuredPrompt(
      "Para cada inconsistência, explique o problema em linguagem humana e proponha opções de correção. A IA não executa mudanças.",
      input,
      "{ \"summary\": string, \"suggestions\": [{ \"issueType\": string, \"explanation\": string, \"options\": string[], \"recommended\": string }] }"
    );

    const response = await postAssistant([{ role: "user", content: prompt }]);
    const json = extractJsonObject(response.reply) ?? {};
    const suggestionsRaw = Array.isArray(json.suggestions) ? json.suggestions : [];

    return {
      summary: String(json.summary ?? "dados insuficientes"),
      suggestions: suggestionsRaw.map((item) => {
        const typed = (item ?? {}) as Record<string, unknown>;
        return {
          issueType: String(typed.issueType ?? "UNKNOWN"),
          explanation: String(typed.explanation ?? ""),
          options: toStringArray(typed.options),
          recommended: String(typed.recommended ?? ""),
        };
      }),
    };
  });
}
