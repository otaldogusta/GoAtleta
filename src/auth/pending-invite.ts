import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "pending_student_invite_v1";

export const savePendingInvite = async (token: string) => {
  const trimmed = token.trim();
  if (!trimmed) return;
  await AsyncStorage.setItem(KEY, trimmed);
};

export const getPendingInvite = async (): Promise<string> => {
  const value = await AsyncStorage.getItem(KEY);
  return value ?? "";
};

export const clearPendingInvite = async () => {
  await AsyncStorage.removeItem(KEY);
};
