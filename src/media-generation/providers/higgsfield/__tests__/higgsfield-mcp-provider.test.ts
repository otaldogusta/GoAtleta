import type { ExerciseMediaAsset } from "../../../../exercise-media/exercise-media.types";
import type { MediaGenerationProvider } from "../../../media-generation-provider";
import type { MediaGenerationRequest } from "../../../media-generation.types";
import { getHiggsfieldConfig } from "../higgsfield-config";
import { createHiggsfieldProvider, getHiggsfieldProviderRuntimeState } from "../higgsfield-provider-factory";
import { HiggsfieldRealProvider } from "../higgsfield-provider.real";
import { HiggsfieldMockProvider } from "../higgsfield-provider.mock";
import { HiggsfieldMcpProvider } from "../higgsfield-mcp-provider";
import type { HiggsfieldMcpBridge } from "../higgsfield-mcp-provider.types";
import type { HiggsfieldMcpConfig } from "../higgsfield-mcp-config";

const MCP_CONFIG: HiggsfieldMcpConfig = {
  enabled: true,
  serverUrl: "https://mcp.higgsfield.ai",
};

const REQUEST: MediaGenerationRequest = {
  kind: "exercise_video",
  exerciseName: "Stiff",
};

describe("HiggsfieldMcpProvider", () => {
  const now = () => "2026-05-08T00:00:00.000Z";

  it("returns failed when MCP bridge is unavailable", async () => {
    const provider = new HiggsfieldMcpProvider({
      config: MCP_CONFIG,
      now,
    });

    const result = await provider.generate(REQUEST);

    expect(provider.isConfigured()).toBe(true);
    expect(result.status).toBe("failed");
    expect(result.error).toContain("bridge local");
  });

  it("never returns approved automatically", async () => {
    const bridge: HiggsfieldMcpBridge = {
      isAvailable: () => true,
      generate: async () => ({
        requestId: "req-1",
        providerName: "bridge",
        kind: "exercise_video",
        status: "completed",
        prompt: "prompt",
        asset: {
          id: "asset-1",
          exerciseKey: "stiff",
          title: "Stiff",
          kind: "video",
          source: "higgsfield",
          status: "approved",
          uri: "https://example.com/stiff.mp4",
          createdAt: now(),
        } satisfies ExerciseMediaAsset,
        completedAt: now(),
      }),
    };

    const provider = new HiggsfieldMcpProvider({
      config: MCP_CONFIG,
      bridge,
      now,
    });

    const result = await provider.generate(REQUEST);
    expect(result.status).toBe("completed");
    expect(result.asset).toMatchObject({
      status: "draft",
    });
  });
});

describe("Higgsfield MCP factory", () => {
  const previousApiKey = process.env.HIGGSFIELD_API_KEY;
  const previousExpoApiKey = process.env.EXPO_PUBLIC_HIGGSFIELD_API_KEY;
  const previousMcpEnabled = process.env.HIGGSFIELD_MCP_ENABLED;
  const previousExpoMcpEnabled = process.env.EXPO_PUBLIC_HIGGSFIELD_MCP_ENABLED;
  const previousMcpServer = process.env.HIGGSFIELD_MCP_SERVER_URL;
  const previousExpoMcpServer = process.env.EXPO_PUBLIC_HIGGSFIELD_MCP_SERVER_URL;

  afterEach(() => {
    const restore = (key: string, value: string | undefined) => {
      if (typeof value === "string") {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    };

    restore("HIGGSFIELD_API_KEY", previousApiKey);
    restore("EXPO_PUBLIC_HIGGSFIELD_API_KEY", previousExpoApiKey);
    restore("HIGGSFIELD_MCP_ENABLED", previousMcpEnabled);
    restore("EXPO_PUBLIC_HIGGSFIELD_MCP_ENABLED", previousExpoMcpEnabled);
    restore("HIGGSFIELD_MCP_SERVER_URL", previousMcpServer);
    restore("EXPO_PUBLIC_HIGGSFIELD_MCP_SERVER_URL", previousExpoMcpServer);
  });

  it("falls back to mock when MCP and REST are absent", () => {
    delete process.env.HIGGSFIELD_API_KEY;
    delete process.env.EXPO_PUBLIC_HIGGSFIELD_API_KEY;
    delete process.env.HIGGSFIELD_MCP_ENABLED;
    delete process.env.EXPO_PUBLIC_HIGGSFIELD_MCP_ENABLED;
    delete process.env.HIGGSFIELD_MCP_SERVER_URL;
    delete process.env.EXPO_PUBLIC_HIGGSFIELD_MCP_SERVER_URL;

    const provider = createHiggsfieldProvider();
    expect(provider).toBeInstanceOf(HiggsfieldMockProvider);
  });

  it("creates MCP provider when MCP config exists", () => {
    process.env.HIGGSFIELD_MCP_ENABLED = "true";
    process.env.HIGGSFIELD_MCP_SERVER_URL = "https://mcp.higgsfield.ai";
    delete process.env.HIGGSFIELD_API_KEY;

    const provider = createHiggsfieldProvider();
    expect(provider).toBeInstanceOf(HiggsfieldMcpProvider);
  });

  it("prioritizes MCP over REST", () => {
    process.env.HIGGSFIELD_MCP_ENABLED = "true";
    process.env.HIGGSFIELD_MCP_SERVER_URL = "https://mcp.higgsfield.ai";
    process.env.HIGGSFIELD_API_KEY = "rest-key";

    const provider = createHiggsfieldProvider();
    expect(provider).toBeInstanceOf(HiggsfieldMcpProvider);
  });

  it("uses REST only when MCP is absent and REST exists", () => {
    delete process.env.HIGGSFIELD_MCP_ENABLED;
    delete process.env.HIGGSFIELD_MCP_SERVER_URL;
    process.env.HIGGSFIELD_API_KEY = "rest-key";

    const provider = createHiggsfieldProvider();
    expect(getHiggsfieldConfig()).not.toBeNull();
    expect(provider).toBeInstanceOf(HiggsfieldRealProvider);
  });

  it("exposes MCP status for the UI without requiring API key", () => {
    const status = getHiggsfieldProviderRuntimeState({
      mcpConfig: MCP_CONFIG,
    });

    expect(status.mode).toBe("mcp");
    expect(status.headline).toBe("Higgsfield MCP configurado");
    expect(status.detail).toBe("Bridge MCP indisponível");
  });
});
