import { buildMediaGenerationRequestId } from "../../media-generation-request";
import type { MediaGenerationRequest, MediaGenerationResult } from "../../media-generation.types";
import type { HiggsfieldMcpBridge } from "./higgsfield-mcp-provider.types";

function now(): string {
  return new Date().toISOString();
}

export class NoopHiggsfieldMcpBridge implements HiggsfieldMcpBridge {
  isAvailable(): boolean {
    return false;
  }

  async generate(request: MediaGenerationRequest): Promise<MediaGenerationResult> {
    return {
      requestId: buildMediaGenerationRequestId(request),
      providerName: "higgsfield-mcp",
      kind: request.kind,
      status: "failed",
      prompt: request.prompt ?? "",
      asset: null,
      error: "Higgsfield MCP configurado, mas bridge local ainda não está conectada.",
      completedAt: now(),
    };
  }
}

export function createHiggsfieldMcpBridge(): HiggsfieldMcpBridge {
  return new NoopHiggsfieldMcpBridge();
}
