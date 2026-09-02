import AsyncStorage from "@react-native-async-storage/async-storage";

const STUDENT_KEY = "pending_student_invite_v1";
const TRAINER_KEY = "pending_trainer_invite_v1";
const STUDENT_RELATIONSHIP_KEY = "pending_student_relationship_invite_v1";

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

export const savePendingRelationshipInvite = async (token: string) => {
  const trimmed = token.trim();
  if (!trimmed) return;
  await AsyncStorage.setItem(STUDENT_RELATIONSHIP_KEY, trimmed);
};

export const getPendingRelationshipInvite = async (): Promise<string> => {
  const value = await AsyncStorage.getItem(STUDENT_RELATIONSHIP_KEY);
  return value ?? "";
};

export const clearPendingRelationshipInvite = async () => {
  await AsyncStorage.removeItem(STUDENT_RELATIONSHIP_KEY);
};

export const resolvePendingTrainerCode = ({
  routeCode,
  storedCode,
}: {
  routeCode?: string;
  storedCode: string;
}) => routeCode?.trim().toUpperCase() || storedCode.trim().toUpperCase();

export const requiresInviteEmailVerification = (user?: {
  email?: string | null;
  is_anonymous?: boolean | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
} | null) => {
  if (!user || user.is_anonymous === true) return true;
  if (!String(user.email ?? "").trim()) return true;
  const appMetadata = user?.app_metadata ?? {};
  const providers = [
    ...(Array.isArray(appMetadata.providers) ? appMetadata.providers : []),
    appMetadata.provider,
  ]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);
  const hasTrustedExternalProvider = providers.some((provider) =>
    ["google", "apple", "facebook"].includes(provider)
  );
  if (hasTrustedExternalProvider) return false;
  return !(
    typeof appMetadata.email_verified_hybrid_at === "string"
    && Boolean(appMetadata.email_verified_hybrid_at.trim())
  );
};

export const requiresTrainerInviteEmailVerification =
  requiresInviteEmailVerification;

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
  pendingRelationshipToken = "",
  defaultTarget,
}: {
  pendingStudentToken: string;
  pendingTrainerCode: string;
  pendingRelationshipToken?: string;
  defaultTarget: string;
}) => {
  const relationshipToken = pendingRelationshipToken.trim();
  if (relationshipToken) {
    return `/family-invite/${encodeURIComponent(relationshipToken)}`;
  }
  return pendingStudentToken.trim() || pendingTrainerCode.trim()
    ? "/pending"
    : defaultTarget;
};

export const shouldReturnTrainerInviteToSignup = ({
  authLoading,
  hasSession,
  trainerCode,
}: {
  authLoading: boolean;
  hasSession: boolean;
  trainerCode: string;
}) => !authLoading && !hasSession && Boolean(trainerCode.trim());

export const shouldRedirectPendingRole = ({
  hasSession,
  role,
  pathname,
  isInviteRoute,
}: {
  hasSession: boolean;
  role?: string | null;
  pathname: string;
  isInviteRoute: boolean;
}) =>
  hasSession &&
  role === "pending" &&
  pathname !== "/pending" &&
  pathname !== "/verify-email" &&
  !isInviteRoute;
