import { normalizeExerciseMediaKey } from "../../../exercise-media/exercise-media-normalization";
import type { ExerciseMediaAsset } from "../../../exercise-media/exercise-media.types";
import {
  buildMediaGenerationRequestId,
  getMediaGenerationRequestErrors,
} from "../../media-generation-request";
import type { MediaGenerationProvider } from "../../media-generation-provider";
import type {
  CoachAvatarAsset,
  MarketingAsset,
  MediaAsset,
  MediaGenerationOutputAsset,
  MediaGenerationRequest,
  MediaGenerationResult,
} from "../../media-generation.types";
import {
  buildCoachAvatarPrompt,
  buildExerciseImagePrompt,
  buildExerciseVideoPrompt,
  buildMarketingCardPrompt,
} from "./higgsfield-prompts";
import { createHiggsfieldClient, type HiggsfieldClient, type HiggsfieldClientResponse } from "./higgsfield-client";
import { getHiggsfieldConfig, type HiggsfieldConfig } from "./higgsfield-config";

export type HiggsfieldRealProviderOptions = {
  config?: HiggsfieldConfig | null;
  client?: HiggsfieldClient;
  now?: () => string;
};

function defaultNow(): string {
  return new Date().toISOString();
}

function pickString(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function pickRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function pickOutputRecords(response: HiggsfieldClientResponse): Record<string, unknown>[] {
  return Array.isArray(response.outputs) ? response.outputs.filter((item) => item && typeof item === "object") : [];
}

function extractPrimaryUri(response: HiggsfieldClientResponse): string {
  const output = pickRecord(response.output);
  const asset = pickRecord(response.asset);
  const firstOutput = pickOutputRecords(response)[0] ?? null;

  return pickString(
    response.videoUrl,
    response.imageUrl,
    response.url,
    output?.videoUrl,
    output?.imageUrl,
    output?.url,
    asset?.videoUrl,
    asset?.imageUrl,
    asset?.url,
    firstOutput?.videoUrl,
    firstOutput?.imageUrl,
    firstOutput?.url,
  );
}

function extractThumbnailUri(response: HiggsfieldClientResponse): string | undefined {
  const output = pickRecord(response.output);
  const asset = pickRecord(response.asset);
  const firstOutput = pickOutputRecords(response)[0] ?? null;

  const value = pickString(
    response.thumbnailUrl,
    output?.thumbnailUrl,
    asset?.thumbnailUrl,
    firstOutput?.thumbnailUrl,
  );

  return value || undefined;
}

export class HiggsfieldRealProvider implements MediaGenerationProvider {
  readonly name = "higgsfield";

  private readonly config: HiggsfieldConfig | null;
  private readonly client: HiggsfieldClient | null;
  private readonly now: () => string;

  constructor(options: HiggsfieldRealProviderOptions = {}) {
    this.config = options.config ?? getHiggsfieldConfig();
    this.client = this.config ? options.client ?? createHiggsfieldClient(this.config) : options.client ?? null;
    this.now = options.now ?? defaultNow;
  }

  isConfigured(): boolean {
    return Boolean(this.config?.apiKey);
  }

  async generate(request: MediaGenerationRequest): Promise<MediaGenerationResult> {
    const requestId = buildMediaGenerationRequestId(request);
    const prompt = this.buildPrompt(request);
    const errors = getMediaGenerationRequestErrors(request);

    if (errors.length > 0) {
      return this.buildFailureResult(request, requestId, prompt, errors.join("; "));
    }

    if (!this.isConfigured() || !this.client) {
      return this.buildFailureResult(
        request,
        requestId,
        prompt,
        "Higgsfield provider is not configured. Set HIGGSFIELD_API_KEY or EXPO_PUBLIC_HIGGSFIELD_API_KEY.",
      );
    }

    try {
      const response = await this.callClient(request, prompt);
      const asset = this.buildAssetFromResponse(request, response);

      if (!asset) {
        return this.buildFailureResult(
          request,
          requestId,
          prompt,
          "Higgsfield response did not include a usable media URL.",
        );
      }

      return {
        requestId,
        providerName: this.name,
        kind: request.kind,
        status: "completed",
        prompt,
        asset,
        completedAt: this.now(),
        metadata: {
          endpointStatus: pickString(response.status) || "completed",
          jobId: pickString(response.jobId, response.id) || null,
          model: pickString(response.model) || null,
        },
      };
    } catch (error) {
      return this.buildFailureResult(
        request,
        requestId,
        prompt,
        error instanceof Error ? error.message : "Unknown Higgsfield error",
      );
    }
  }

  private buildPrompt(request: MediaGenerationRequest): string {
    switch (request.kind) {
      case "exercise_video":
        return buildExerciseVideoPrompt(request);
      case "exercise_image":
        return buildExerciseImagePrompt(request);
      case "coach_avatar":
        return buildCoachAvatarPrompt(request);
      case "marketing_card":
        return buildMarketingCardPrompt(request);
      default:
        return "";
    }
  }

  private async callClient(
    request: MediaGenerationRequest,
    prompt: string,
  ): Promise<HiggsfieldClientResponse> {
    if (!this.client) {
      throw new Error("Higgsfield client is not available.");
    }

    switch (request.kind) {
      case "exercise_video":
        return this.client.generateExerciseVideo(request, prompt);
      case "exercise_image":
        return this.client.generateExerciseImage(request, prompt);
      case "coach_avatar":
        return this.client.generateCoachAvatar(request, prompt);
      case "marketing_card":
        return this.client.generateMarketingCard(request, prompt);
      default:
        throw new Error(`Unsupported media generation kind: ${request.kind}`);
    }
  }

  private buildAssetFromResponse(
    request: MediaGenerationRequest,
    response: HiggsfieldClientResponse,
  ): MediaGenerationOutputAsset | null {
    switch (request.kind) {
      case "exercise_video":
        return this.buildExerciseAsset(request, response, "video");
      case "exercise_image":
        return this.buildExerciseAsset(request, response, "image");
      case "coach_avatar":
        return this.buildCoachAvatarAsset(request, response);
      case "marketing_card":
        return this.buildMarketingAsset(request, response);
      default:
        return null;
    }
  }

  private buildExerciseAsset(
    request: MediaGenerationRequest,
    response: HiggsfieldClientResponse,
    kind: ExerciseMediaAsset["kind"],
  ): ExerciseMediaAsset | null {
    const uri = extractPrimaryUri(response);
    if (!uri) {
      return null;
    }

    const createdAt = this.now();
    const exerciseKey = normalizeExerciseMediaKey(
      request.exerciseKey ?? request.exerciseName ?? request.title ?? "exercise",
    );

    return {
      id: pickString(response.jobId, response.id) || `${request.kind}-${exerciseKey}`,
      exerciseKey,
      title: request.title ?? request.exerciseName ?? request.exerciseKey ?? "Midia Higgsfield",
      kind,
      source: "higgsfield",
      status: "draft",
      uri,
      thumbnailUri: extractThumbnailUri(response),
      modality: request.modality,
      sport: request.sport,
      ageBand: request.ageBand,
      level: request.level,
      tags: ["higgsfield", request.kind, exerciseKey].filter(Boolean),
      createdAt,
      updatedAt: createdAt,
    };
  }

  private buildCoachAvatarAsset(
    request: MediaGenerationRequest,
    response: HiggsfieldClientResponse,
  ): CoachAvatarAsset | null {
    const imageUrl = extractPrimaryUri(response);
    if (!imageUrl) {
      return null;
    }

    const createdAt = this.now();
    const coachKey = normalizeExerciseMediaKey(request.coachId ?? request.title ?? "coach");

    return {
      id: pickString(response.jobId, response.id) || `coach-avatar-${coachKey}`,
      name: request.title ?? "Coach avatar Higgsfield",
      source: "higgsfield",
      status: "draft",
      createdAt,
      updatedAt: createdAt,
      imageUrl,
      thumbnailUrl: extractThumbnailUri(response),
      coachId: request.coachId,
    };
  }

  private buildMarketingAsset(
    request: MediaGenerationRequest,
    response: HiggsfieldClientResponse,
  ): MarketingAsset | null {
    const imageUrl = extractPrimaryUri(response);
    if (!imageUrl) {
      return null;
    }

    const createdAt = this.now();
    const campaignKey = normalizeExerciseMediaKey(request.campaignKey ?? request.title ?? "campaign");

    return {
      id: pickString(response.jobId, response.id) || `marketing-card-${campaignKey}`,
      name: request.title ?? "Marketing card Higgsfield",
      source: "higgsfield",
      status: "draft",
      createdAt,
      updatedAt: createdAt,
      imageUrl,
      thumbnailUrl: extractThumbnailUri(response),
      campaignKey: request.campaignKey,
      surface: request.surface,
    };
  }

  private buildFailureResult(
    request: MediaGenerationRequest,
    requestId: string,
    prompt: string,
    error: string,
  ): MediaGenerationResult {
    return {
      requestId,
      providerName: this.name,
      kind: request.kind,
      status: "failed",
      prompt,
      asset: null,
      error,
      completedAt: this.now(),
    };
  }
}
