export type HiggsfieldMcpConfig = {
  enabled: true;
  serverUrl: string;
};

function readEnvValue(key: string): string {
  if (typeof process === "undefined" || !process.env) {
    return "";
  }

  const value = process.env[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function getHiggsfieldMcpServerUrl(): string {
  return (
    readEnvValue("HIGGSFIELD_MCP_SERVER_URL") ||
    readEnvValue("EXPO_PUBLIC_HIGGSFIELD_MCP_SERVER_URL")
  );
}

export function isHiggsfieldMcpEnabled(): boolean {
  const raw =
    readEnvValue("HIGGSFIELD_MCP_ENABLED") || readEnvValue("EXPO_PUBLIC_HIGGSFIELD_MCP_ENABLED");

  if (!raw) {
    return false;
  }

  return normalizeBoolean(raw);
}

export function getHiggsfieldMcpConfig(): HiggsfieldMcpConfig | null {
  if (!isHiggsfieldMcpEnabled()) {
    return null;
  }

  const serverUrl = getHiggsfieldMcpServerUrl() || "https://mcp.higgsfield.ai";
  if (!serverUrl) {
    return null;
  }

  return {
    enabled: true,
    serverUrl,
  };
}
