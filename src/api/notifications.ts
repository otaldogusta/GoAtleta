import {
  assertSessionIdentity,
  getAccessToken,
  getSessionIdentity,
  getSessionUserId,
  getValidAccessToken,
  SessionIdentityChangedError,
} from "../auth/session";
import { getActiveOrganizationId, getReadCacheGeneration } from "../db/client";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import {
  supabaseRestDelete,
  supabaseRestGet,
  supabaseRestPatch,
} from "./rest";
import { sendPushToUser } from "./push";
import {
  notificationInboxFilter,
  type NotificationInboxScope,
} from "../notifications/inbox-scope";

export type AppNotificationType =
  | "training_created"
  | "training_saved"
  | "birthday"
  | "consultation_event"
  | "absence_notice_created"
  | "absence_notice_status_changed"
  | "regulation_updated"
  | "generic";

type NotificationRow = {
  id: string;
  organization_id: string;
  recipient_user_id: string;
  inbox_scope: NotificationInboxScope;
  actor_user_id: string | null;
  type: AppNotificationType;
  title: string;
  body: string;
  action_url: string | null;
  source_type: string | null;
  source_id: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  archived_at?: string | null;
  created_at: string;
};

export type AppNotification = {
  id: string;
  organizationId: string;
  recipientUserId: string;
  inboxScope: NotificationInboxScope;
  actorUserId: string | null;
  type: AppNotificationType;
  title: string;
  body: string;
  actionUrl: string | null;
  sourceType: string | null;
  sourceId: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  read: boolean;
  archived: boolean;
};

export type NotificationArchiveScope = "active" | "archived" | "all";

export type CreateNotificationInput = {
  organizationId?: string | null;
  recipientUserId?: string | null;
  inboxScope: NotificationInboxScope;
  actorUserId?: string | null;
  type?: AppNotificationType;
  title: string;
  body: string;
  actionUrl?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  sendPush?: boolean;
  dedupe?: boolean;
};

const NOTIFICATION_SELECT =
  "id,organization_id,recipient_user_id,inbox_scope,actor_user_id,type,title,body,action_url,source_type,source_id,metadata,read_at,archived_at,created_at";
const NOTIFICATION_SELECT_LEGACY =
  "id,organization_id,recipient_user_id,inbox_scope,actor_user_id,type,title,body,action_url,source_type,source_id,metadata,read_at,created_at";

// Share only concurrent identical reads, never a settled inbox snapshot.
const notificationReads = new Map<string, Promise<AppNotification[]>>();
let notificationReadGeneration = 0;
class NotificationReadInvalidatedError extends Error {}
const invalidateNotificationReads = () => {
  notificationReadGeneration += 1;
  notificationReads.clear();
};

const mapNotification = (row: NotificationRow): AppNotification => ({
  id: row.id,
  organizationId: row.organization_id,
  recipientUserId: row.recipient_user_id,
  inboxScope: row.inbox_scope ?? "all",
  actorUserId: row.actor_user_id,
  type: row.type,
  title: row.title,
  body: row.body,
  actionUrl: row.action_url,
  sourceType: row.source_type,
  sourceId: row.source_id,
  metadata: row.metadata ?? {},
  readAt: row.read_at,
  archivedAt: row.archived_at ?? null,
  createdAt: row.created_at,
  read: Boolean(row.read_at),
  archived: Boolean(row.archived_at),
});

const isMissingNotificationsTable = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("PGRST205") ||
    message.includes("public.notifications") ||
    (message.toLowerCase().includes("schema cache") &&
      message.toLowerCase().includes("notifications"))
  );
};

const isMissingArchivedAtColumn = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.toLowerCase().includes("archived_at");
};

const resolveOrganizationId = async (organizationId?: string | null) => {
  const resolved = organizationId ?? (await getActiveOrganizationId());
  return String(resolved ?? "").trim();
};

const resolveRecipientUserId = async (recipientUserId?: string | null) => {
  const resolved = recipientUserId ?? (await getSessionUserId());
  return String(resolved ?? "").trim();
};

const buildCreatePayload = async (input: CreateNotificationInput) => {
  const organizationId = await resolveOrganizationId(input.organizationId);
  const recipientUserId = await resolveRecipientUserId(input.recipientUserId);
  const actorUserId = String(
    input.actorUserId ?? (await getSessionUserId()) ?? "",
  ).trim();
  const title = input.title.trim();
  const body = input.body.trim();

  if (!organizationId || !recipientUserId || !title || !body) return null;

  return {
    organization_id: organizationId,
    recipient_user_id: recipientUserId,
    inbox_scope: input.inboxScope,
    actor_user_id: actorUserId || null,
    type: input.type ?? "generic",
    title,
    body,
    action_url: input.actionUrl?.trim() || null,
    source_type: input.sourceType?.trim() || null,
    source_id: input.sourceId?.trim() || null,
    metadata: input.metadata ?? {},
  };
};

const callCreateNotificationFunction = async (
  input: CreateNotificationInput,
  assertContextCurrent?: () => Promise<void>,
) => {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Sessão inválida. Faça login novamente.");

  await assertContextCurrent?.();
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/create-notification`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(input),
    },
  );

  const raw = await response.text();
  const parsed = raw
    ? (JSON.parse(raw) as {
        error?: string;
        notification?: NotificationRow;
        created?: boolean;
      })
    : null;
  if (!response.ok) {
    throw new Error(parsed?.error || "Falha ao criar notificação.");
  }
  return {
    notification: parsed?.notification
      ? mapNotification(parsed.notification)
      : null,
    created: parsed?.created !== false,
  };
};

type ListNotificationOptions = {
  inboxScope: NotificationInboxScope;
  organizationId?: string | null;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  archiveScope?: NotificationArchiveScope;
};

export async function listNotifications(options: ListNotificationOptions): Promise<AppNotification[]> {
  return readNotifications(options);
}

async function readNotifications(options: ListNotificationOptions): Promise<AppNotification[]> {
  const identity = getSessionIdentity();
  const cacheGeneration = getReadCacheGeneration();
  const organizationId = await resolveOrganizationId(options.organizationId);
  const recipientUserId = await getSessionUserId();
  assertSessionIdentity(identity);
  if (cacheGeneration !== getReadCacheGeneration()) throw new SessionIdentityChangedError();
  if (!organizationId || !recipientUserId) return [];
  const readGeneration = notificationReadGeneration;
  const assertIdentityCurrent = () => {
    assertSessionIdentity(identity);
    if (identity.userId !== recipientUserId || cacheGeneration !== getReadCacheGeneration()) throw new SessionIdentityChangedError();
  };
  const assertContextCurrent = () => {
    assertIdentityCurrent();
    if (readGeneration !== notificationReadGeneration) throw new NotificationReadInvalidatedError();
  };
  assertContextCurrent();

  const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  const unreadFilter = options.unreadOnly ? "&read_at=is.null" : "";
  const archiveFilter =
    options.archiveScope === "all"
      ? ""
      : options.archiveScope === "archived"
        ? "&archived_at=not.is.null"
        : "&archived_at=is.null";
  const inboxFilter = `&${notificationInboxFilter(options.inboxScope)}`;
  const key = JSON.stringify([identity.userId, identity.generation, cacheGeneration,
    readGeneration, getAccessToken(), organizationId, options.inboxScope, limit, offset,
    Boolean(options.unreadOnly), options.archiveScope ?? "active"]);
  const existing = notificationReads.get(key);
  if (existing) return existing;

  const read = async () => {
    try {
      const rows = await supabaseRestGet<NotificationRow[]>(
        `/notifications?select=${NOTIFICATION_SELECT}&organization_id=eq.${encodeURIComponent(
          organizationId,
        )}&recipient_user_id=eq.${encodeURIComponent(
          recipientUserId,
        )}${inboxFilter}${unreadFilter}${archiveFilter}&order=created_at.desc,id.desc&limit=${limit}&offset=${offset}`,
        assertContextCurrent,
      );
      assertContextCurrent();
      return (rows ?? []).map(mapNotification);
    } catch (error) {
      assertContextCurrent();
      if (isMissingArchivedAtColumn(error)) {
        if (options.archiveScope === "archived") return [];
        const rows = await supabaseRestGet<NotificationRow[]>(
          `/notifications?select=${NOTIFICATION_SELECT_LEGACY}&organization_id=eq.${encodeURIComponent(
            organizationId,
          )}&recipient_user_id=eq.${encodeURIComponent(
            recipientUserId,
          )}${inboxFilter}${unreadFilter}&order=created_at.desc,id.desc&limit=${limit}&offset=${offset}`,
          assertContextCurrent,
        );
        assertContextCurrent();
        return (rows ?? []).map(mapNotification);
      }
      if (isMissingNotificationsTable(error)) return [];
      throw error;
    }
  };
  const readCurrent = async (): Promise<AppNotification[]> => {
    try {
      return await read();
    } catch (error) {
      if (error instanceof NotificationReadInvalidatedError) {
        assertIdentityCurrent();
        // An older consumer must receive the refreshed inbox, not publish [] after
        // the mutation's own refresh. Never replay an account/workspace change.
        return await readNotifications(options);
      }
      throw error;
    }
  };
  const pending = readCurrent();
  notificationReads.set(key, pending);
  try {
    return await pending;
  } finally {
    if (notificationReads.get(key) === pending) notificationReads.delete(key);
  }
}

export async function getUnreadNotificationCount(
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
): Promise<number> {
  const rows = await listNotifications({
    organizationId,
    inboxScope,
    unreadOnly: true,
    limit: 100,
  });
  return rows.length;
}

export async function createNotification(
  input: CreateNotificationInput,
  assertContextCurrent?: () => Promise<void>,
): Promise<AppNotification | null> {
  await assertContextCurrent?.();
  const payload = await buildCreatePayload(input);
  if (!payload) return null;

  let notification: AppNotification | null = null;
  let createdNew = true;
  const currentUserId = await getSessionUserId();
  try {
    const remoteResult = await callCreateNotificationFunction({
      ...input,
      organizationId: payload.organization_id,
      recipientUserId: payload.recipient_user_id,
      actorUserId: payload.actor_user_id,
      type: payload.type,
      actionUrl: payload.action_url,
      sourceType: payload.source_type,
      sourceId: payload.source_id,
      metadata: payload.metadata,
      dedupe: input.dedupe,
    }, assertContextCurrent);
    await assertContextCurrent?.();
    notification = remoteResult.notification;
    createdNew = remoteResult.created;
  } catch (error) {
    if (isMissingNotificationsTable(error)) return null;
    throw error;
  } finally {
    invalidateNotificationReads();
  }

  if (
    input.sendPush &&
    createdNew &&
    notification &&
    notification.recipientUserId !== currentUserId
  ) {
    try {
      await sendPushToUser({
        organizationId: notification.organizationId,
        targetUserId: notification.recipientUserId,
        notificationType: notification.type,
        sourceType: notification.sourceType ?? "",
        notificationId: notification.id,
        title: notification.title,
        body: notification.body,
        data: {
          route: notification.actionUrl ?? "/communications",
          params: notification.sourceId
            ? {
                sourceType: notification.sourceType ?? "",
                sourceId: notification.sourceId,
              }
            : undefined,
        },
      }, ...(assertContextCurrent ? [assertContextCurrent] as const : []));
    } catch {
      // Push is best-effort; the inbox notification remains available.
    }
  }

  return notification;
}

export async function markNotificationRead(id: string): Promise<void> {
  const notificationId = String(id ?? "").trim();
  if (!notificationId) return;
  try {
    await supabaseRestPatch(
      `/notifications?id=eq.${encodeURIComponent(notificationId)}`,
      { read_at: new Date().toISOString() },
      "return=minimal",
    );
  } catch (error) {
    if (isMissingNotificationsTable(error)) return;
    throw error;
  } finally {
    invalidateNotificationReads();
  }
}

export async function markAllNotificationsRead(
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
): Promise<void> {
  const resolvedOrganizationId = await resolveOrganizationId(organizationId);
  const recipientUserId = await getSessionUserId();
  if (!resolvedOrganizationId || !recipientUserId) return;
  const inboxFilter = notificationInboxFilter(inboxScope);
  try {
    await supabaseRestPatch(
      `/notifications?organization_id=eq.${encodeURIComponent(
        resolvedOrganizationId,
      )}&recipient_user_id=eq.${encodeURIComponent(
        recipientUserId,
      )}&${inboxFilter}&read_at=is.null&archived_at=is.null`,
      { read_at: new Date().toISOString() },
      "return=minimal",
    );
  } catch (error) {
    if (isMissingArchivedAtColumn(error)) {
      await supabaseRestPatch(
        `/notifications?organization_id=eq.${encodeURIComponent(
          resolvedOrganizationId,
        )}&recipient_user_id=eq.${encodeURIComponent(
          recipientUserId,
        )}&${inboxFilter}&read_at=is.null`,
        { read_at: new Date().toISOString() },
        "return=minimal",
      );
      return;
    }
    if (isMissingNotificationsTable(error)) return;
    throw error;
  } finally {
    invalidateNotificationReads();
  }
}

export async function archiveReadNotifications(
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
): Promise<void> {
  const resolvedOrganizationId = await resolveOrganizationId(organizationId);
  const recipientUserId = await getSessionUserId();
  if (!resolvedOrganizationId || !recipientUserId) return;
  const inboxFilter = notificationInboxFilter(inboxScope);
  try {
    await supabaseRestPatch(
      `/notifications?organization_id=eq.${encodeURIComponent(
        resolvedOrganizationId,
      )}&recipient_user_id=eq.${encodeURIComponent(
        recipientUserId,
      )}&${inboxFilter}&read_at=not.is.null&archived_at=is.null`,
      { archived_at: new Date().toISOString() },
      "return=minimal",
    );
  } catch (error) {
    if (isMissingArchivedAtColumn(error)) {
      throw new Error(
        "A área de avisos arquivados ainda precisa da migration do banco.",
      );
    }
    if (isMissingNotificationsTable(error)) return;
    throw error;
  } finally {
    invalidateNotificationReads();
  }
}

export async function restoreNotification(
  id: string,
  organizationId?: string | null,
): Promise<void> {
  const notificationId = String(id ?? "").trim();
  const resolvedOrganizationId = await resolveOrganizationId(organizationId);
  const recipientUserId = await getSessionUserId();
  if (!notificationId || !resolvedOrganizationId || !recipientUserId) return;
  try {
    await supabaseRestPatch(
      `/notifications?id=eq.${encodeURIComponent(
        notificationId,
      )}&organization_id=eq.${encodeURIComponent(
        resolvedOrganizationId,
      )}&recipient_user_id=eq.${encodeURIComponent(recipientUserId)}`,
      { archived_at: null },
      "return=minimal",
    );
  } catch (error) {
    if (isMissingArchivedAtColumn(error)) {
      throw new Error(
        "A área de avisos arquivados ainda precisa da migration do banco.",
      );
    }
    if (isMissingNotificationsTable(error)) return;
    throw error;
  } finally {
    invalidateNotificationReads();
  }
}

export async function clearMyNotifications(
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
): Promise<void> {
  const resolvedOrganizationId = await resolveOrganizationId(organizationId);
  const recipientUserId = await getSessionUserId();
  if (!resolvedOrganizationId || !recipientUserId) return;
  const inboxFilter = notificationInboxFilter(inboxScope);
  try {
    await supabaseRestDelete(
      `/notifications?organization_id=eq.${encodeURIComponent(
        resolvedOrganizationId,
      )}&recipient_user_id=eq.${encodeURIComponent(
        recipientUserId,
      )}&${inboxFilter}`,
      "return=minimal",
    );
  } catch (error) {
    if (isMissingNotificationsTable(error)) return;
    throw error;
  } finally {
    invalidateNotificationReads();
  }
}
