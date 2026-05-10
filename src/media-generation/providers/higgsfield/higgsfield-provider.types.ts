import type { MediaGenerationRequest } from "../../media-generation.types";

export type HiggsfieldProviderRequest = MediaGenerationRequest & {
  provider?: "higgsfield";
  model?: string;
};

export type HiggsfieldMockProviderOptions = {
  baseUri?: string;
  now?: () => string;
};
