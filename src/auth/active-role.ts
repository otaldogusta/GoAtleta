import AsyncStorage from "@react-native-async-storage/async-storage";

import type { UserRole } from "./role";

const ACTIVE_ROLE_KEY_PREFIX = "goatleta:active-role:";

export type SelectableUserRole = Extract<UserRole, "trainer" | "student">;

const storageKey = (userId: string) => `${ACTIVE_ROLE_KEY_PREFIX}${userId}`;

export const getActiveRolePreference = async (
  userId: string
): Promise<SelectableUserRole | null> => {
  const stored = await AsyncStorage.getItem(storageKey(userId));
  return stored === "trainer" || stored === "student" ? stored : null;
};

export const setActiveRolePreference = async (
  userId: string,
  role: SelectableUserRole
): Promise<void> => {
  await AsyncStorage.setItem(storageKey(userId), role);
};
