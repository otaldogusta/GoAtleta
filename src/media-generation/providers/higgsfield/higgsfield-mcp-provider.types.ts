import type { MediaGenerationProvider } from "../../media-generation-provider";
import type { MediaGenerationRequest, MediaGenerationResult } from "../../media-generation.types";
import type { HiggsfieldMcpConfig } from "./higgsfield-mcp-config";

export interface HiggsfieldMcpBridge {
  isAvailable(): boolean;
  generate(request: MediaGenerationRequest): Promise<MediaGenerationResult>;
}

export type HiggsfieldMcpProviderOptions = {
  config?: HiggsfieldMcpConfig | null;
  bridge?: HiggsfieldMcpBridge;
  now?: () => string;
};

export type HiggsfieldProviderRuntimeState = {
  mode: "mock" | "mcp" | "rest";
  headline: string;
  detail?: string;
};

export type HiggsfieldProviderFactoryOptions = {
  mcpConfig?: HiggsfieldMcpConfig | null;
  mcpBridge?: HiggsfieldMcpBridge;
  restConfig?: import("./higgsfield-config").HiggsfieldConfig | null;
  restClient?: import("./higgsfield-client").HiggsfieldClient;
  now?: () => string;
};

export type HiggsfieldProviderInstance = MediaGenerationProvider;
