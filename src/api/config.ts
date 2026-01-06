import Constants from "expo-constants";

const extra =
  Constants.expoConfig?.extra ??
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Constants as any).manifest?.extra ??
  {};

const getExtraString = (key: string) => {
  const envKey = `EXPO_PUBLIC_${key}`;
  const value =
    (typeof process !== "undefined" && process.env
      ? process.env[envKey] || process.env[key]
      : undefined) ?? extra?.[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`Missing ${key} in app config extras.`);
  }
  return "";
};

const requireEnv = (key: string) => {
  const value = getExtraString(key);
  if (!value) {
    throw new Error(
      `Missing ${key}. Set EXPO_PUBLIC_${key} or app.json extra.`
    );
  }
  return value;
};

export const SUPABASE_URL = requireEnv("SUPABASE_URL");
export const SUPABASE_ANON_KEY = requireEnv("SUPABASE_ANON_KEY");
