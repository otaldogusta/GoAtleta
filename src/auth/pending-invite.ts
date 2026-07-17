import AsyncStorage from "@react-native-async-storage/async-storage";

const STUDENT_KEY = "pending_student_invite_v1";
const TRAINER_KEY = "pending_trainer_invite_v1";

export const savePendingInvite = async (token: string) => {
  const trimmed = token.trim();
  if (!trimmed) return;
  await AsyncStorage.setItem(STUDENT_KEY, trimmed);
};

export const getPendingInvite = async (): Promise<string> => {
  const value = await AsyncStorage.getItem(STUDENT_KEY);
  return value ?? "";
};

export const clearPendingInvite = async () => {
  await AsyncStorage.removeItem(STUDENT_KEY);
};

export const savePendingTrainerInvite = async (code: string) => {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return;
  await AsyncStorage.setItem(TRAINER_KEY, trimmed);
};

export const getPendingTrainerInvite = async (): Promise<string> => {
  const value = await AsyncStorage.getItem(TRAINER_KEY);
  return value ?? "";
};

export const clearPendingTrainerInvite = async () => {
  await AsyncStorage.removeItem(TRAINER_KEY);
};

export const resolvePendingTrainerCode = ({
  routeCode,
  storedCode,
}: {
  routeCode?: string;
  storedCode: string;
}) => routeCode?.trim().toUpperCase() || storedCode.trim().toUpperCase();

export const resolveAuthenticatedTrainerInviteEntry = ({
  hasSession,
  pathname,
  routeCode,
}: {
  hasSession: boolean;
  pathname: string;
  routeCode?: string;
}) =>
  hasSession && pathname === "/signup"
    ? routeCode?.trim().toUpperCase() ?? ""
    : "";

export const resolvePendingInviteRedirect = ({
  pendingStudentToken,
  pendingTrainerCode,
  defaultTarget,
}: {
  pendingStudentToken: string;
  pendingTrainerCode: string;
  defaultTarget: string;
}) =>
  pendingStudentToken.trim() || pendingTrainerCode.trim()
    ? "/pending"
    : defaultTarget;
