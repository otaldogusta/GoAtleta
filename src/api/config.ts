import Constants from "expo-constants";

type LegacyManifestCarrier = {
  manifest?: {
    extra?: Record<string, unknown>;
  };
};

const legacyManifestExtra =
  (Constants as unknown as LegacyManifestCarrier).manifest?.extra ?? {};

const extra = Constants.expoConfig?.extra ?? legacyManifestExtra;

const readExtraValue = (key: string) => {
  const envKey = `EXPO_PUBLIC_${key}`;
  return (
    (typeof process !== "undefined" && process.env
      ? process.env[envKey] || process.env[key]
      : undefined) ?? extra?.[key]
  );
};

const getExtraString = (key: string) => {
  const value = readExtraValue(key);
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (__DEV__) {
    console.warn(`Missing ${key} in app config extras.`);
  }
  return "";
};

const requireEnv = (key: string) => {
  const value = getExtraString(key);
  if (!value) {
    throw new Error(`Missing ${key}. Set EXPO_PUBLIC_${key} or app.json extra.`);
  }
  return value;
};

export const SUPABASE_URL = requireEnv("SUPABASE_URL");
export const SUPABASE_ANON_KEY = requireEnv("SUPABASE_ANON_KEY");

const normalizeBoolean = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const getOptionalExtraString = (key: string) => {
  const value = readExtraValue(key);
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return "";
};

export const ENABLE_SOCIAL_LOGIN = normalizeBoolean(
  getOptionalExtraString("ENABLE_SOCIAL_LOGIN")
);
export const ENABLE_MANUAL_LINKING = normalizeBoolean(
  getOptionalExtraString("ENABLE_MANUAL_LINKING")
);
