import {
  assertSessionIdentity, getSessionIdentity, getSessionUserId,
  type SessionIdentity,
} from "../auth/session";
import { getActiveOrganizationId } from "./client";

export type PendingWriteOrigin = { userId: string; organizationId: string };
export type PendingWriteContext = { origin: PendingWriteOrigin; identity: SessionIdentity };

/** Captured before the first write, including before an offline failure. */
export const capturePendingWriteContext = async (
  organizationId?: string | null,
  expectedOrigin?: PendingWriteOrigin,
): Promise<PendingWriteContext> => {
  await getSessionUserId();
  const identity = getSessionIdentity();
  const resolvedOrg = organizationId ?? await getActiveOrganizationId();
  assertSessionIdentity(identity);
  if (!identity.userId || !resolvedOrg) throw new Error("Sessão expirada ou organização indisponível.");
  const origin = { userId: identity.userId, organizationId: resolvedOrg };
  if (expectedOrigin && !samePendingWriteOrigin(origin, expectedOrigin)) {
    throw new Error("SYNC_PAUSED_AUTH");
  }
  return { origin, identity };
};

export const samePendingWriteOrigin = (
  left: PendingWriteOrigin | null | undefined,
  right: PendingWriteOrigin | null | undefined,
) => Boolean(left && right && left.userId === right.userId && left.organizationId === right.organizationId);

export const getCurrentPendingWriteOrigin = async (): Promise<PendingWriteOrigin | null> => {
  const identity = getSessionIdentity();
  const organizationId = await getActiveOrganizationId();
  assertSessionIdentity(identity);
  return identity.userId && organizationId ? { userId: identity.userId, organizationId } : null;
};
