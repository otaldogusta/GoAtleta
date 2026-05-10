import { normalizeExerciseMediaKey } from "../../../exercise-media/exercise-media-normalization";
import type { ExerciseMediaAsset } from "../../../exercise-media/exercise-media.types";
import {
  buildMediaGenerationRequestId,
  getMediaGenerationRequestErrors,
} from "../../media-generation-request";
import type {
  CoachAvatarAsset,
  MarketingAsset,
  MediaGenerationOutputAsset,
  MediaGenerationRequest,
  MediaGenerationResult,
} from "../../media-generation.types";
import type { MediaGenerationProvider } from "../../media-generation-provider";
import type { HiggsfieldMockProviderOptions } from "./higgsfield-provider.types";
import {
  buildCoachAvatarPrompt,
  buildExerciseImagePrompt,
  buildExerciseVideoPrompt,
  buildMarketingCardPrompt,
} from "./higgsfield-prompts";

function defaultNow(): string {
  return new Date().toISOString();
}

export class HiggsfieldMockProvider implements MediaGenerationProvider {
  readonly name = "higgsfield-mock";

  private readonly baseUri: string;
  private readonly now: () => string;

  constructor(options: HiggsfieldMockProviderOptions = {}) {
    this.baseUri = String(options.baseUri ?? "mock://higgsfield").replace(/\/+$/, "");
    this.now = options.now ?? defaultNow;
  }

  isConfigured(): boolean {
    return true;
  }

  async generate(request: MediaGenerationRequest): Promise<MediaGenerationResult> {
    const requestId = buildMediaGenerationRequestId(request);
    const errors = getMediaGenerationRequestErrors(request);
    const prompt = this.buildPrompt(request);

    if (errors.length > 0) {
      return {
        requestId,
        providerName: this.name,
        kind: request.kind,
        status: "failed",
        prompt,
        asset: null,
        error: errors.join("; "),
        completedAt: this.now(),
      };
    }

    return {
      requestId,
      providerName: this.name,
      kind: request.kind,
      status: "completed",
      prompt,
      asset: this.buildAsset(request),
      completedAt: this.now(),
    };
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

  private buildAsset(request: MediaGenerationRequest): MediaGenerationOutputAsset {
    switch (request.kind) {
      case "exercise_video":
        return this.buildExerciseAsset(request, "video");
      case "exercise_image":
        return this.buildExerciseAsset(request, "image");
      case "coach_avatar":
        return this.buildCoachAvatarAsset(request);
      case "marketing_card":
        return this.buildMarketingAsset(request);
      default:
        return {
          id: buildMediaGenerationRequestId(request),
          name: request.title ?? "Mock media asset",
          source: "higgsfield",
          status: "draft",
          createdAt: this.now(),
        };
    }
  }

  private buildExerciseAsset(
    request: MediaGenerationRequest,
    kind: ExerciseMediaAsset["kind"],
  ): ExerciseMediaAsset {
    const exerciseKey = normalizeExerciseMediaKey(
      request.exerciseKey ?? request.exerciseName ?? request.title ?? "exercise",
    );
    const createdAt = this.now();

    return {
      id: `${request.kind}-${exerciseKey}`,
      exerciseKey,
      title: request.title ?? request.exerciseName ?? request.exerciseKey ?? "Exercicio mockado",
      kind,
      source: "higgsfield",
      status: "draft",
      uri: `${this.baseUri}/${request.kind}/${exerciseKey}`,
      thumbnailUri:
        kind === "video" ? `${this.baseUri}/${request.kind}/${exerciseKey}/thumbnail` : undefined,
      modality: request.modality,
      sport: request.sport,
      ageBand: request.ageBand,
      level: request.level,
      tags: ["mock", request.kind, "higgsfield"].filter(Boolean),
      createdAt,
      updatedAt: createdAt,
    };
  }

  private buildCoachAvatarAsset(request: MediaGenerationRequest): CoachAvatarAsset {
    const createdAt = this.now();
    const coachKey = normalizeExerciseMediaKey(request.coachId ?? request.title ?? "coach");

    return {
      id: `coach-avatar-${coachKey}`,
      name: request.title ?? "Coach avatar mockado",
      source: "higgsfield",
      status: "draft",
      createdAt,
      updatedAt: createdAt,
      imageUrl: `${this.baseUri}/coach-avatar/${coachKey}`,
      coachId: request.coachId,
    };
  }

  private buildMarketingAsset(request: MediaGenerationRequest): MarketingAsset {
    const createdAt = this.now();
    const campaignKey = normalizeExerciseMediaKey(request.campaignKey ?? request.title ?? "campaign");

    return {
      id: `marketing-card-${campaignKey}`,
      name: request.title ?? "Marketing card mockado",
      source: "higgsfield",
      status: "draft",
      createdAt,
      updatedAt: createdAt,
      imageUrl: `${this.baseUri}/marketing-card/${campaignKey}`,
      campaignKey: request.campaignKey,
      surface: request.surface,
    };
  }
}
