import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { getValidAccessToken } from "../auth/session";
import type { TrainingPlan } from "../core/models";
import type {
  PlanningPdfAnalysis,
  PlanningPdfConfirmedBatch,
} from "../core/training-plan-pdf-import";

const ENDPOINT = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/training-plan-document-import`;
// A long PDF can require several bounded model calls inside one Edge Function
// invocation. Keep the browser request below Supabase's hosted 400 s wall-clock
// ceiling while leaving enough room for three page batches and one short retry.
const REQUEST_TIMEOUT_MS = 350_000;
// The Edge Function already performs one provider-aware retry. Retrying the
// entire PDF repeatedly from the browser makes OpenAI's rolling minute limit
// harder to clear because rejected requests also count toward that limit.
const MAX_RATE_LIMIT_RETRIES = 1;
const MIN_RATE_LIMIT_RETRY_SECONDS = 60;
const MAX_IN_PROGRESS_RETRIES = 60;

type LegacyPlanningPdfAnalysis = Omit<PlanningPdfAnalysis, "plans"> & {
  items?: PlanningPdfAnalysis["plans"][number]["items"];
};

type LegacyPlanningPdfConfirmation = Omit<PlanningPdfConfirmedBatch, "plans"> & {
  approvedValues?: Record<string, unknown>;
};

type AnalyzeInput = {
  organizationId: string;
  classId?: string;
  filename: string;
  mimeType: string;
  base64: string;
  lessonDate?: string;
  currentPlan?: TrainingPlan;
};

type AnalyzeRetry = {
  code: string;
  attempt: number;
  retryAfterSeconds: number;
};

type AnalyzeOptions = {
  onRetry?: (retry: AnalyzeRetry) => void;
};

class PlanningPdfRequestError extends Error {
  code: string;
  retryable: boolean;
  retryAfterSeconds: number;

  constructor({
    code,
    message,
    retryable,
    retryAfterSeconds,
  }: {
    code: string;
    message: string;
    retryable: boolean;
    retryAfterSeconds: number;
  }) {
    super(message);
    this.name = "PlanningPdfRequestError";
    this.code = code;
    this.retryable = retryable;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const wait = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));

const request = async <T>(body: Record<string, unknown>): Promise<T> => {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Sua sessão expirou. Entre novamente para importar o PDF.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      code?: string;
      error?: string;
      message?: string;
      retryable?: boolean;
      retryAfterSeconds?: number;
    };
    if (!response.ok) {
      throw new PlanningPdfRequestError({
        code: payload.code || `HTTP_${response.status}`,
        message: payload.error || payload.message || "Não foi possível analisar o PDF.",
        retryable: payload.retryable === true,
        retryAfterSeconds: Math.max(1, Math.min(120, Number(payload.retryAfterSeconds) || 15)),
      });
    }
    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("A análise demorou mais que o esperado. Tente novamente.");
    }
    if (
      error instanceof TypeError ||
      (error instanceof Error && /failed to fetch|network request failed|load failed/i.test(error.message))
    ) {
      throw new Error("O serviço de importação está indisponível no momento. Tente novamente em instantes.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const analyzeTrainingPlanPdf = async (input: AnalyzeInput, options: AnalyzeOptions = {}) => {
  let rateLimitRetries = 0;
  let inProgressRetries = 0;
  let payload: PlanningPdfAnalysis | LegacyPlanningPdfAnalysis;
  while (true) {
    try {
      payload = await request<PlanningPdfAnalysis | LegacyPlanningPdfAnalysis>({
        action: "analyze",
        ...input,
      });
      break;
    } catch (error) {
      if (!(error instanceof PlanningPdfRequestError) || !error.retryable) throw error;
      const isInProgress = error.code === "ANALYSIS_IN_PROGRESS";
      if (isInProgress) {
        inProgressRetries += 1;
        if (inProgressRetries > MAX_IN_PROGRESS_RETRIES) throw error;
      } else {
        rateLimitRetries += 1;
        if (rateLimitRetries > MAX_RATE_LIMIT_RETRIES) {
          throw new PlanningPdfRequestError({
            code: error.code,
            message: "O limite da análise continua ativo. Aguarde alguns minutos e tente novamente.",
            retryable: false,
            retryAfterSeconds: error.retryAfterSeconds,
          });
        }
      }
      const attempt = isInProgress ? inProgressRetries : rateLimitRetries;
      const retryAfterSeconds = isInProgress
        ? error.retryAfterSeconds
        : Math.max(MIN_RATE_LIMIT_RETRY_SECONDS, error.retryAfterSeconds);
      options.onRetry?.({
        code: error.code,
        attempt,
        retryAfterSeconds,
      });
      await wait(retryAfterSeconds * 1000);
    }
  }
  if (Array.isArray((payload as PlanningPdfAnalysis).plans)) {
    return payload as PlanningPdfAnalysis;
  }
  const legacy = payload as LegacyPlanningPdfAnalysis;
  return {
    ...legacy,
    plans: [{
      id: "plan-1",
      order: 1,
      pageStart: 1,
      pageEnd: 1,
      title: legacy.filename.replace(/\.pdf$/i, "") || "Plano 1",
      lessonDate: input.lessonDate ?? "",
      extractedClassName: legacy.classBinding.extractedClassName,
      extractionConfidence: legacy.extractionConfidence,
      warnings: legacy.warnings,
      items: legacy.items ?? [],
    }],
  };
};

export const confirmTrainingPlanPdfImport = ({
  organizationId,
  proposalId,
  snapshotVersion,
  approvedItemIds,
}: {
  organizationId: string;
  proposalId: string;
  snapshotVersion: string;
  approvedItemIds: string[];
}) =>
  request<PlanningPdfConfirmedBatch | LegacyPlanningPdfConfirmation>({
    action: "confirm",
    organizationId,
    proposalId,
    snapshotVersion,
    approvedItemIds,
  }).then((payload) => {
    if (Array.isArray((payload as PlanningPdfConfirmedBatch).plans)) {
      return payload as PlanningPdfConfirmedBatch;
    }
    const legacy = payload as LegacyPlanningPdfConfirmation;
    return {
      ...legacy,
      plans: [{
        planId: "plan-1",
        order: 1,
        pageStart: 1,
        pageEnd: 1,
        approvedValues: legacy.approvedValues ?? {},
      }],
    };
  });
