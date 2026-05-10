import {
  buildMediaGenerationRequestId,
  getMediaGenerationRequestErrors,
} from "../../media-generation-request";
import type { MediaGenerationProvider } from "../../media-generation-provider";
import type {
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
import { createHiggsfieldMcpBridge, NoopHiggsfieldMcpBridge } from "./higgsfield-mcp-bridge";
import { getHiggsfieldMcpConfig, type HiggsfieldMcpConfig } from "./higgsfield-mcp-config";
import type { HiggsfieldMcpBridge, HiggsfieldMcpProviderOptions } from "./higgsfield-mcp-provider.types";

function defaultNow(): string {
  return new Date().toISOString();
}

function normalizeAsset(asset: MediaGenerationOutputAsset | null): MediaGenerationOutputAsset | null {
  if (!asset || typeof asset !== "object") {
    return asset;
  }

  return {
    ...asset,
    status: "draft",
    source: "higgsfield" in asset && asset.source ? asset.source : "higgsfield",
  } as MediaGenerationOutputAsset;
}

export class HiggsfieldMcpProvider implements MediaGenerationProvider {
  readonly name = "higgsfield-mcp";

  private readonly config: HiggsfieldMcpConfig | null;
  private readonly bridge: HiggsfieldMcpBridge;
  private readonly now: () => string;

  constructor(options: HiggsfieldMcpProviderOptions = {}) {
    this.config = options.config ?? getHiggsfieldMcpConfig();
    this.bridge = options.bridge ?? createHiggsfieldMcpBridge();
    this.now = options.now ?? defaultNow;
  }

  isConfigured(): boolean {
    return Boolean(this.config?.enabled && this.config.serverUrl);
  }

  isBridgeAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  async generate(request: MediaGenerationRequest): Promise<MediaGenerationResult> {
    const requestId = buildMediaGenerationRequestId(request);
    const prompt = this.buildPrompt(request);
    const errors = getMediaGenerationRequestErrors(request);

    if (errors.length > 0) {
      return this.buildFailureResult(request, requestId, prompt, errors.join("; "));
    }

    if (!this.isConfigured()) {
      return this.buildFailureResult(
        request,
        requestId,
        prompt,
        "Higgsfield MCP não está configurado.",
      );
    }

    if (!this.bridge.isAvailable()) {
      return this.buildFailureResult(
        request,
        requestId,
        prompt,
        "Higgsfield MCP configurado, mas bridge local ainda não está conectada.",
      );
    }

    try {
      const result = await this.bridge.generate(request);
      return {
        ...result,
        requestId,
        providerName: this.name,
        kind: request.kind,
        prompt: result.prompt || prompt,
        asset: normalizeAsset(result.asset),
        status: result.status === "completed" ? "completed" : "failed",
        completedAt: result.completedAt ?? this.now(),
      };
    } catch (error) {
      return this.buildFailureResult(
        request,
        requestId,
        prompt,
        error instanceof Error ? error.message : "Falha ao gerar via Higgsfield MCP.",
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

export function isNoopHiggsfieldMcpBridge(bridge: HiggsfieldMcpBridge): boolean {
  return bridge instanceof NoopHiggsfieldMcpBridge;
}
