import AsyncStorage from "@react-native-async-storage/async-storage";

export type DevProfilePreview = "auto" | "student" | "professor" | "admin";

const PREVIEW_KEY = "dev-profile-preview-v1";
const LEGACY_ROLE_KEY = "role_override_v1";
const LEGACY_ADMIN_KEY = "dev-admin-preview";

const toPreview = (value: string | null): DevProfilePreview | null => {
  if (value === "student") return "student";
  if (value === "professor") return "professor";
  if (value === "admin") return "admin";
  if (value === "trainer") return "professor";
  return null;
};

const migrateLegacyPreview = async () => {
  const current = await AsyncStorage.getItem(PREVIEW_KEY);
  if (current) {
    await AsyncStorage.removeItem(LEGACY_ROLE_KEY);
    await AsyncStorage.removeItem(LEGACY_ADMIN_KEY);
    return;
  }

  const [legacyRole, legacyAdmin] = await Promise.all([
    AsyncStorage.getItem(LEGACY_ROLE_KEY),
    AsyncStorage.getItem(LEGACY_ADMIN_KEY),
  ]);

  let next: DevProfilePreview = "auto";
  if (legacyAdmin === "1") {
    next = "admin";
  } else if (legacyRole === "student") {
    next = "student";
  } else if (legacyRole === "trainer") {
    next = "professor";
  }

  if (next !== "auto") {
    await AsyncStorage.setItem(PREVIEW_KEY, next);
  }

  await AsyncStorage.removeItem(LEGACY_ROLE_KEY);
  await AsyncStorage.removeItem(LEGACY_ADMIN_KEY);
};

export async function getDevProfilePreview(): Promise<DevProfilePreview> {
  if (!__DEV__) return "auto";
  await migrateLegacyPreview();
  const raw = await AsyncStorage.getItem(PREVIEW_KEY);
  return toPreview(raw) ?? "auto";
}

export async function setDevProfilePreview(value: DevProfilePreview): Promise<void> {
  if (!__DEV__) return;
  if (value === "auto") {
    await AsyncStorage.removeItem(PREVIEW_KEY);
    return;
  }
  await AsyncStorage.setItem(PREVIEW_KEY, value);
}
