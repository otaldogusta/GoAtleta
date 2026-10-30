import AsyncStorage from "@react-native-async-storage/async-storage";
import { hasVerifiedEmailAccess } from "./email-verification-state";
import { sanitizePostLoginRedirect } from "./post-login-redirect";

const STUDENT_KEY = "pending_student_invite_v1";
const TRAINER_KEY = "pending_trainer_invite_v1";
const STUDENT_RELATIONSHIP_KEY = "pending_student_relationship_invite_v1";
const INVITE_KEYS = [STUDENT_KEY, TRAINER_KEY, STUDENT_RELATIONSHIP_KEY];
let pendingWrite: Promise<void> = Promise.resolve();

const writeInvite = (work: () => Promise<void>) => {
  pendingWrite = pendingWrite.catch(() => undefined).then(work);
  return pendingWrite;
};

// A newly selected invitation replaces older entry intentions, including ones
// left by a different account on this browser. Serialize writes across routes.
const selectInvite = (key: string, value: string) => writeInvite(async () => {
  await Promise.all(INVITE_KEYS.filter((other) => other !== key).map((other) => AsyncStorage.removeItem(other)));
  await AsyncStorage.setItem(key, value);
});

export const clearPendingInvites = () => writeInvite(async () => {
  await Promise.all(INVITE_KEYS.map((key) => AsyncStorage.removeItem(key)));
});

export const savePendingInvite = async (token: string) => {
  const trimmed = token.trim();
  if (!trimmed) return;
  await selectInvite(STUDENT_KEY, trimmed);
};

export const getPendingInvite = async (): Promise<string> => {
  await pendingWrite;
  const value = await AsyncStorage.getItem(STUDENT_KEY);
  return value ?? "";
};

export const clearPendingInvite = async () => {
  await writeInvite(() => AsyncStorage.removeItem(STUDENT_KEY));
};

export const savePendingTrainerInvite = async (code: string) => {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return;
  await selectInvite(TRAINER_KEY, trimmed);
};

export const getPendingTrainerInvite = async (): Promise<string> => {
  await pendingWrite;
  const value = await AsyncStorage.getItem(TRAINER_KEY);
  return value ?? "";
};

export const clearPendingTrainerInvite = async () => {
  await writeInvite(() => AsyncStorage.removeItem(TRAINER_KEY));
};

export const savePendingRelationshipInvite = async (token: string) => {
  const trimmed = token.trim();
  if (!trimmed) return;
  await selectInvite(STUDENT_RELATIONSHIP_KEY, trimmed);
};

export const getPendingRelationshipInvite = async (): Promise<string> => {
  await pendingWrite;
  const value = await AsyncStorage.getItem(STUDENT_RELATIONSHIP_KEY);
  return value ?? "";
};

export const clearPendingRelationshipInvite = async () => {
  await writeInvite(() => AsyncStorage.removeItem(STUDENT_RELATIONSHIP_KEY));
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

// The root owns post-auth navigation. Resolve persisted invitations before the
// default portal so the login screen and the root cannot race one another.
export const resolvePostAuthEntryTarget = async ({
  user,
  routeTrainerCode,
  next,
  defaultTarget,
}: {
  user: Parameters<typeof hasVerifiedEmailAccess>[0] & { email?: string | null };
  routeTrainerCode?: string;
  next?: unknown;
  defaultTarget: string;
}) => {
  if (routeTrainerCode?.trim()) await savePendingTrainerInvite(routeTrainerCode);
  if (!hasVerifiedEmailAccess(user)) {
    return `/verify-email?email=${encodeURIComponent(user?.email ?? "")}`;
  }
  const [pendingStudentToken, pendingRelationshipToken, pendingTrainerCode] = await Promise.all([
    getPendingInvite(), getPendingRelationshipInvite(), getPendingTrainerInvite(),
  ]);
  return resolvePendingInviteRedirect({
    pendingStudentToken, pendingRelationshipToken, pendingTrainerCode,
    defaultTarget: sanitizePostLoginRedirect(next) ?? defaultTarget,
  });
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
  hasPlatformAccess = false,
}: {
  hasSession: boolean;
  role?: string | null;
  pathname: string;
  isInviteRoute: boolean;
  hasPlatformAccess?: boolean;
}) =>
  hasSession &&
  role === "pending" &&
  pathname !== "/pending" &&
  pathname !== "/verify-email" &&
  pathname !== "/student/home" &&
  pathname !== "/student-plan" &&
  pathname !== "/student/profile" &&
  pathname !== "/student/profile/settings" &&
  !(hasPlatformAccess && (pathname === "/platform" || pathname.startsWith("/platform/"))) &&
  !isInviteRoute;
