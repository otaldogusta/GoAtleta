import type { MediaGenerationProvider } from "../../media-generation-provider";
import { HiggsfieldMockProvider } from "./higgsfield-provider.mock";
import { getHiggsfieldConfig } from "./higgsfield-config";
import { createHiggsfieldMcpBridge } from "./higgsfield-mcp-bridge";
import { getHiggsfieldMcpConfig } from "./higgsfield-mcp-config";
import {
  type HiggsfieldProviderFactoryOptions,
  type HiggsfieldProviderRuntimeState,
} from "./higgsfield-mcp-provider.types";
import { HiggsfieldMcpProvider } from "./higgsfield-mcp-provider";
import { HiggsfieldRealProvider } from "./higgsfield-provider.real";

export function createHiggsfieldProvider(
  options: HiggsfieldProviderFactoryOptions = {},
): MediaGenerationProvider {
  const mcpConfig = options.mcpConfig ?? getHiggsfieldMcpConfig();
  if (mcpConfig) {
    return new HiggsfieldMcpProvider({
      config: mcpConfig,
      bridge: options.mcpBridge ?? createHiggsfieldMcpBridge(),
      now: options.now,
    });
  }

  const restConfig = options.restConfig ?? getHiggsfieldConfig();
  if (restConfig) {
    return new HiggsfieldRealProvider({
      config: restConfig,
      client: options.restClient,
      now: options.now,
    });
  }

  return new HiggsfieldMockProvider({ now: options.now });
}

export function getHiggsfieldProviderRuntimeState(
  options: HiggsfieldProviderFactoryOptions = {},
): HiggsfieldProviderRuntimeState {
  const mcpConfig = options.mcpConfig ?? getHiggsfieldMcpConfig();
  if (mcpConfig) {
    const bridge = options.mcpBridge ?? createHiggsfieldMcpBridge();
    return {
      mode: "mcp",
      headline: "Higgsfield MCP configurado",
      detail: bridge.isAvailable()
        ? "Geração disponível via agent/CLI."
        : "Bridge MCP indisponível",
    };
  }

  const restConfig = options.restConfig ?? getHiggsfieldConfig();
  if (restConfig) {
    return {
      mode: "rest",
      headline: "REST experimental",
      detail: "Use apenas para integrações de teste.",
    };
  }

  return {
    mode: "mock",
    headline: "Modo simulado",
    detail: "O mock mantém o fluxo funcional sem credenciais.",
  };
}
