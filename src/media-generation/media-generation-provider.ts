import type { MediaGenerationRequest, MediaGenerationResult } from "./media-generation.types";

export interface MediaGenerationProvider {
  readonly name: string;
  isConfigured(): boolean;
  generate(request: MediaGenerationRequest): Promise<MediaGenerationResult>;
}
