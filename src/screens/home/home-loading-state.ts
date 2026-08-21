type HomeScheduleRequestKeyInput = {
  userId?: string | null;
  role?: string | null;
  organizationId?: string | null;
  contextLoading: boolean;
  adminMode: boolean;
};

export function resolveHomeScheduleRequestKey({
  userId,
  role,
  organizationId,
  contextLoading,
  adminMode,
}: HomeScheduleRequestKeyInput): string | null {
  if (!userId || role !== "trainer" || contextLoading) return null;
  return [userId, organizationId ?? "no-organization", adminMode ? "coord" : "prof"].join(":");
}

export function shouldShowInitialHomeLoading({
  contextLoading,
  requestKey,
  resolvedRequestKey,
}: {
  contextLoading: boolean;
  requestKey: string | null;
  resolvedRequestKey: string | null;
}): boolean {
  if (contextLoading) return true;
  return requestKey !== null && requestKey !== resolvedRequestKey;
}
