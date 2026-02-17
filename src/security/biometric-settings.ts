import AsyncStorage from "@react-native-async-storage/async-storage";

export const BIOMETRICS_ENABLED_KEY = "security_biometrics_enabled_v1";

export async function getBiometricsEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(BIOMETRICS_ENABLED_KEY);
    return raw === "true";
  } catch {
    return false;
  }
}

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await AsyncStorage.setItem(BIOMETRICS_ENABLED_KEY, "true");
    return;
  }
  await AsyncStorage.removeItem(BIOMETRICS_ENABLED_KEY);
}
