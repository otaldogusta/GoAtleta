import type { MediaGenerationRequest } from "../../media-generation.types";
import type { HiggsfieldConfig } from "./higgsfield-config";

export type HiggsfieldClientResponse = {
  id?: string;
  jobId?: string;
  status?: string;
  model?: string;
  url?: string;
  imageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  output?: Record<string, unknown> | null;
  asset?: Record<string, unknown> | null;
  outputs?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown> | null;
};

export type HiggsfieldClient = {
  generateExerciseVideo(
    request: MediaGenerationRequest,
    prompt: string,
  ): Promise<HiggsfieldClientResponse>;
  generateExerciseImage(
    request: MediaGenerationRequest,
    prompt: string,
  ): Promise<HiggsfieldClientResponse>;
  generateCoachAvatar(
    request: MediaGenerationRequest,
    prompt: string,
  ): Promise<HiggsfieldClientResponse>;
  generateMarketingCard(
    request: MediaGenerationRequest,
    prompt: string,
  ): Promise<HiggsfieldClientResponse>;
};

type FetchLike = typeof fetch;

export type CreateHiggsfieldClientOptions = {
  fetchImpl?: FetchLike;
};

function buildPayload(request: MediaGenerationRequest, prompt: string) {
  return {
    requestId: request.requestId,
    kind: request.kind,
    title: request.title,
    prompt,
    exerciseName: request.exerciseName,
    exerciseKey: request.exerciseKey,
    modality: request.modality,
    sport: request.sport,
    ageBand: request.ageBand,
    level: request.level,
    coachId: request.coachId,
    campaignKey: request.campaignKey,
    surface: request.surface,
    notes: request.notes,
    referenceUris: request.referenceUris,
    metadata: request.metadata,
  };
}

async function parseJsonSafe(response: {
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}): Promise<unknown> {
  if (typeof response.json === "function") {
    try {
      return await response.json();
    } catch {
      // fall through
    }
  }

  if (typeof response.text === "function") {
    try {
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  return {};
}

export function createHiggsfieldClient(
  config: HiggsfieldConfig,
  options: CreateHiggsfieldClientOptions = {},
): HiggsfieldClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available for Higgsfield client");
  }

  async function postJson(
    endpoint: string,
    request: MediaGenerationRequest,
    prompt: string,
  ): Promise<HiggsfieldClientResponse> {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
    const timeoutId =
      controller && typeof setTimeout === "function"
        ? setTimeout(() => controller.abort(), config.timeoutMs)
        : undefined;

    try {
      const response = await fetchImpl(`${config.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayload(request, prompt)),
        signal: controller?.signal,
      });

      const data = (await parseJsonSafe(response as { json?: () => Promise<unknown>; text?: () => Promise<string> })) as HiggsfieldClientResponse;

      if (!response.ok) {
        const message =
          typeof data?.status === "string" && data.status.trim()
            ? data.status.trim()
            : `Higgsfield request failed with status ${response.status}`;
        throw new Error(message);
      }

      return data ?? {};
    } finally {
      if (typeof timeoutId !== "undefined") {
        clearTimeout(timeoutId);
      }
    }
  }

  return {
    generateExerciseVideo(request, prompt) {
      return postJson(config.endpoints.exerciseVideo, request, prompt);
    },
    generateExerciseImage(request, prompt) {
      return postJson(config.endpoints.exerciseImage, request, prompt);
    },
    generateCoachAvatar(request, prompt) {
      return postJson(config.endpoints.coachAvatar, request, prompt);
    },
    generateMarketingCard(request, prompt) {
      return postJson(config.endpoints.marketingCard, request, prompt);
    },
  };
}
