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

type AssistantErrorPayload = {
  error?: string;
  message?: string;
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

export type AssistantMemoryContextItem = {
  scope: "organization" | "class" | "coach";
  role: "user" | "assistant";
  content: string;
  createdAt: string;
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

export type ReportRewriteField = "activity" | "conclusion";

export type RewriteReportTextInput = {
  field: ReportRewriteField;
  text: string;
  mode: "projeto_social";
  maxChars: number;
  classId?: string;
};

export type RewriteReportTextResult = {
  rewrittenText: string;
};

const assistantUrl = `${SUPABASE_URL}/functions/v1/assistant`;
const DEFAULT_AI_CACHE_TTL_MS = 120_000;
const MAX_AI_CACHE_ITEMS = 200;
const ASSISTANT_REQUEST_TIMEOUT_MS = 15_000;
const MAX_CACHE_KEY_DEPTH = 4;
const MAX_CACHE_KEY_ARRAY_ITEMS = 20;
const MAX_CACHE_KEY_OBJECT_KEYS = 30;
const MAX_CACHE_KEY_STRING_LENGTH = 240;

const aiResponseCache = new Map<string, { expiresAt: number; value: unknown }>();
const aiInFlightCache = new Map<string, Promise<unknown>>();
let aiCacheHitCount = 0;
let aiCacheMissCount = 0;

const normalizeForCacheKey = (value: unknown, depth = 0): unknown => {
  if (value == null) return value;

  const valueType = typeof value;
  if (valueType === "string") {
    const text = value as string;
    return text.length > MAX_CACHE_KEY_STRING_LENGTH
      ? `${text.slice(0, MAX_CACHE_KEY_STRING_LENGTH)}⬦[${text.length}]`
      : text;
  }
  if (valueType === "number" || valueType === "boolean") return value;

  if (depth >= MAX_CACHE_KEY_DEPTH) {
    if (Array.isArray(value)) return `[array:${value.length}]`;
    return "[object]";
  }

  if (Array.isArray(value)) {
    const limited = value
      .slice(0, MAX_CACHE_KEY_ARRAY_ITEMS)
      .map((item) => normalizeForCacheKey(item, depth + 1));
    if (value.length > MAX_CACHE_KEY_ARRAY_ITEMS) {
      limited.push(`[+${value.length - MAX_CACHE_KEY_ARRAY_ITEMS} items]`);
    }
    return limited;
  }

  if (valueType === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const limitedKeys = keys.slice(0, MAX_CACHE_KEY_OBJECT_KEYS);
    const normalized = limitedKeys.reduce<Record<string, unknown>>((accumulator, key) => {
      accumulator[key] = normalizeForCacheKey(record[key], depth + 1);
      return accumulator;
    }, {});

    if (keys.length > MAX_CACHE_KEY_OBJECT_KEYS) {
      normalized.__truncatedKeys = keys.length - MAX_CACHE_KEY_OBJECT_KEYS;
    }

    return normalized;
  }

  return String(value);
};

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
  const normalizedInput = normalizeForCacheKey(input);
  return [task, String(org), String(period), String(scope), stableSerialize(normalizedInput)].join("|");
};

const pruneAiCacheIfNeeded = (now: number) => {
  for (const [key, entry] of aiResponseCache.entries()) {
    if (entry.expiresAt <= now) {
      aiResponseCache.delete(key);
    }
  }

  while (aiResponseCache.size >= MAX_AI_CACHE_ITEMS) {
    const firstKey = aiResponseCache.keys().next().value;
    if (!firstKey) break;
    aiResponseCache.delete(firstKey);
  }
};

const withAiCache = async <T>(key: string, ttlMs: number, producer: () => Promise<T>): Promise<T> => {
  const now = Date.now();
  const cached = aiResponseCache.get(key);
  if (cached && cached.expiresAt > now) {
    aiCacheHitCount += 1;
    aiResponseCache.delete(key);
    aiResponseCache.set(key, cached);
    return cached.value as T;
  }

  aiCacheMissCount += 1;

  if (ttlMs <= 0) {
    return producer();
  }

  const inFlight = aiInFlightCache.get(key);
  if (inFlight) {
    return (await inFlight) as T;
  }

  const promise = producer()
    .then((result) => {
      pruneAiCacheIfNeeded(Date.now());
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

export const getAiCacheMetrics = () => ({
  hits: aiCacheHitCount,
  misses: aiCacheMissCount,
  size: aiResponseCache.size,
  inFlight: aiInFlightCache.size,
});

export const buildScopedMemoryContext = (
  entries: AssistantMemoryContextItem[],
  limit = 5
) => {
  const normalized = entries
    .filter((entry) => Boolean(entry.content?.trim()))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, Math.max(1, limit));

  return normalized.map((entry) => `${entry.role}/${entry.scope}: ${entry.content.trim()}`);
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

const extractAssistantApiError = (value: string) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as AssistantErrorPayload;
    const message =
      (typeof parsed.error === "string" && parsed.error.trim()) ||
      (typeof parsed.message === "string" && parsed.message.trim()) ||
      "";
    return message || raw;
  } catch {
    return raw;
  }
};

const toFriendlyAssistantApiError = (value: string) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "Nao foi possivel processar esta solicitacao agora.";
  const normalized = raw.toLowerCase();
  if (normalized.includes("entrada invalida") || normalized.includes("invalid input")) {
    return "Nao foi possivel interpretar a solicitacao. Revise os dados e tente novamente.";
  }
  if (normalized.includes("timeout")) {
    return "A resposta demorou mais que o esperado. Tente novamente em alguns instantes.";
  }
  if (normalized.includes("token") || normalized.includes("auth")) {
    return "Sessao expirada. Faça login novamente.";
  }
  if (normalized.includes("failed to fetch") || normalized.includes("network request failed")) {
    return "Falha de conexao com o assistente. Verifique sua internet e tente novamente.";
  }
  return "Nao foi possivel processar esta solicitacao agora.";
};

const toStringArray = (value: unknown) =>
  Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];

const postAssistant = async (messages: AssistantMessage[], classId?: string) => {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Missing auth token");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ASSISTANT_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(assistantUrl, {
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
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Assistant request timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();
  if (!response.ok) {
    const parsedError = extractAssistantApiError(text || "");
    throw new Error(toFriendlyAssistantApiError(parsedError || "Assistant request failed"));
  }

  try {
    const parsed = JSON.parse(text) as AssistantEnvelope;
    if (!parsed || typeof parsed.reply !== "string") {
      throw new Error("Invalid assistant envelope");
    }
    const embeddedError = extractAssistantApiError(parsed.reply);
    if (embeddedError && embeddedError !== parsed.reply) {
      throw new Error(toFriendlyAssistantApiError(embeddedError));
    }
    return parsed;
  } catch {
    const parsedError = extractAssistantApiError(text);
    throw new Error(toFriendlyAssistantApiError(parsedError || "Invalid assistant response payload"));
  }
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

export async function rewriteReportText(
  input: RewriteReportTextInput,
  options?: AiRequestOptions
): Promise<RewriteReportTextResult> {
  const trimmed = String(input.text ?? "").trim();
  const maxChars =
    Number.isFinite(input.maxChars) && input.maxChars > 0
      ? Math.floor(input.maxChars)
      : 1200;

  if (!trimmed) {
    throw new Error("Digite um texto antes de usar o assistente.");
  }

  if (trimmed.length > maxChars) {
    throw new Error(`Limite de ${maxChars} caracteres excedido.`);
  }

  const isActivityField = input.field === "activity";
  const fieldLabel = isActivityField ? "atividade" : "conclusao";
  const payload = {
    field: input.field,
    mode: input.mode,
    maxChars,
    text: trimmed,
  };
  const cacheKey = buildAiCacheKey("rewriteReportText", payload, options?.cache);
  const ttlMs = options?.cache?.ttlMs ?? 0;

  return withAiCache(cacheKey, ttlMs, async () => {
    const prompt = buildStructuredPrompt(
      [
        `Reescreva o campo '${fieldLabel}' de um relatorio de aula para projeto social.`,
        "Use portugues-BR claro e profissional.",
        "Nao use o termo 'alunos'; prefira 'participantes' ou 'turma'.",
        "Mantenha o sentido original e o nivel de detalhe.",
        "Nao invente fatos, datas, metricas, nomes, acoes ou resultados.",
        isActivityField
          ? "Para atividade, seja objetivo em uma frase curta (ate 180 caracteres), focada no que foi aplicado."
          : "Para conclusao, mantenha observacoes finais, convivio e evolucao de forma clara.",
        "Retorne somente JSON valido no formato solicitado.",
      ].join(" "),
      payload,
      '{ "rewrittenText": string }'
    );

    const response = await postAssistant([{ role: "user", content: prompt }], input.classId);
    const json = extractJsonObject(response.reply) ?? {};
    let rewrittenText = String(json.rewrittenText ?? "").trim();
    if (!rewrittenText) {
      const fallbackText = String(response.reply ?? "")
        .replace(/```(?:json)?/gi, "")
        .replace(/```/g, "")
        .trim();
      const looksLikeJsonObject =
        fallbackText.startsWith("{") && fallbackText.endsWith("}");
      rewrittenText = looksLikeJsonObject ? "" : fallbackText;
    }
    if (!rewrittenText) {
      throw new Error("Nao foi possivel gerar sugestao de texto agora.");
    }

    return { rewrittenText };
  });
}
