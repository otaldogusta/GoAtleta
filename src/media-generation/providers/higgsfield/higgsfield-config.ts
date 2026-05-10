export type HiggsfieldConfig = {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  endpoints: {
    exerciseVideo: string;
    exerciseImage: string;
    coachAvatar: string;
    marketingCard: string;
  };
};

function readEnvValue(key: string): string {
  if (typeof process === "undefined" || !process.env) {
    return "";
  }

  const value = process.env[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getHiggsfieldApiKey(): string {
  return readEnvValue("HIGGSFIELD_API_KEY") || readEnvValue("EXPO_PUBLIC_HIGGSFIELD_API_KEY");
}

export function isHiggsfieldConfigured(): boolean {
  return Boolean(getHiggsfieldApiKey());
}

export function getHiggsfieldConfig(): HiggsfieldConfig | null {
  const apiKey = getHiggsfieldApiKey();
  if (!apiKey) {
    return null;
  }

  const baseUrl = normalizeBaseUrl(
    readEnvValue("HIGGSFIELD_API_BASE_URL") ||
      readEnvValue("EXPO_PUBLIC_HIGGSFIELD_API_BASE_URL") ||
      "https://api.higgsfield.ai",
  );

  const timeoutSeed =
    readEnvValue("HIGGSFIELD_API_TIMEOUT_MS") || readEnvValue("EXPO_PUBLIC_HIGGSFIELD_API_TIMEOUT_MS");
  const timeoutMs = Number.parseInt(timeoutSeed || "45000", 10);

  return {
    apiKey,
    baseUrl,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 45000,
    endpoints: {
      exerciseVideo: "/v1/media/exercise-video",
      exerciseImage: "/v1/media/exercise-image",
      coachAvatar: "/v1/media/coach-avatar",
      marketingCard: "/v1/media/marketing-card",
    },
  };
}
