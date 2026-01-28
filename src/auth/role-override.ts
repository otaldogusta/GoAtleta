import AsyncStorage from "@react-native-async-storage/async-storage";

export type RoleOverride = "trainer" | "student";

const KEY = "role_override_v1";

export async function getRoleOverride(): Promise<RoleOverride | null> {
  if (!__DEV__) return null;
  const value = await AsyncStorage.getItem(KEY);
  if (value === "trainer" || value === "student") return value;
  return null;
}

export async function setRoleOverride(value: RoleOverride | null) {
  if (!__DEV__) return;
  if (!value) {
    await AsyncStorage.removeItem(KEY);
    return;
  }
  await AsyncStorage.setItem(KEY, value);
}
