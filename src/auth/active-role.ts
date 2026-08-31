import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SelectableUserRole } from "./role-types";

export type { SelectableUserRole } from "./role-types";

const ACTIVE_ROLE_KEY_PREFIX = "goatleta:active-role:";
const ACTIVE_FAMILY_STUDENT_KEY_PREFIX = "goatleta:active-family-student:";

const storageKey = (userId: string) => `${ACTIVE_ROLE_KEY_PREFIX}${userId}`;
const familyStudentStorageKey = (userId: string) =>
  `${ACTIVE_FAMILY_STUDENT_KEY_PREFIX}${userId}`;

export const getActiveRolePreference = async (
  userId: string
): Promise<SelectableUserRole | null> => {
  const stored = await AsyncStorage.getItem(storageKey(userId));
  return stored === "trainer" || stored === "student" || stored === "family"
    ? stored
    : null;
};

export const setActiveRolePreference = async (
  userId: string,
  role: SelectableUserRole
): Promise<void> => {
  await AsyncStorage.setItem(storageKey(userId), role);
};

export const getActiveFamilyStudentPreference = async (
  userId: string,
): Promise<string | null> => {
  const stored = await AsyncStorage.getItem(familyStudentStorageKey(userId));
  const normalized = stored?.trim() ?? "";
  return normalized || null;
};

export const setActiveFamilyStudentPreference = async (
  userId: string,
  studentId: string,
): Promise<void> => {
  const normalized = studentId.trim();
  if (!normalized) {
    await AsyncStorage.removeItem(familyStudentStorageKey(userId));
    return;
  }
  await AsyncStorage.setItem(familyStudentStorageKey(userId), normalized);
};
