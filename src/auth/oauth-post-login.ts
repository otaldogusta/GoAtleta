import type { AuthSession } from "./session";

const NEW_ACCOUNT_WINDOW_MS = 10 * 60 * 1000;

export const isRecentlyCreatedAuthUser = (
  user: AuthSession["user"] | null | undefined,
  nowMs = Date.now(),
) => {
  const createdAtMs = Date.parse(user?.created_at ?? "");
  return Number.isFinite(createdAtMs) && nowMs - createdAtMs >= 0 && nowMs - createdAtMs <= NEW_ACCOUNT_WINDOW_MS;
};

export const resolveOAuthEntryTarget = ({
  session,
  pendingDestination,
  hasPendingInvite,
  nowMs,
}: {
  session: AuthSession | null;
  pendingDestination: string;
  hasPendingInvite: boolean;
  nowMs?: number;
}) => {
  if (!hasPendingInvite && isRecentlyCreatedAuthUser(session?.user, nowMs)) {
    return "/student/home";
  }
  return pendingDestination;
};
