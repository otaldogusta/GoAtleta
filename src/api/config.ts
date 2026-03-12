import Constants from "expo-constants";

const extra =
  Constants.expoConfig?.extra ??
   
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

const normalizeBoolean = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

export const ENABLE_SOCIAL_LOGIN = normalizeBoolean(getExtraString("ENABLE_SOCIAL_LOGIN"));
export const ENABLE_MANUAL_LINKING = normalizeBoolean(getExtraString("ENABLE_MANUAL_LINKING"));
