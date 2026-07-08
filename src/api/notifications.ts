import { getSessionUserId, getValidAccessToken } from "../auth/session";
import { getActiveOrganizationId } from "../db/client";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import {
  supabaseRestDelete,
  supabaseRestGet,
  supabaseRestPatch,
  supabaseRestPost,
} from "./rest";
import { sendPushToUser } from "./push";

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
  actor_user_id: string | null;
  type: AppNotificationType;
  title: string;
  body: string;
  action_url: string | null;
  source_type: string | null;
  source_id: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export type AppNotification = {
  id: string;
  organizationId: string;
  recipientUserId: string;
  actorUserId: string | null;
  type: AppNotificationType;
  title: string;
  body: string;
  actionUrl: string | null;
  sourceType: string | null;
  sourceId: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  read: boolean;
};

export type CreateNotificationInput = {
  organizationId?: string | null;
  recipientUserId?: string | null;
  actorUserId?: string | null;
  type?: AppNotificationType;
  title: string;
  body: string;
  actionUrl?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  sendPush?: boolean;
};

const NOTIFICATION_SELECT =
  "id,organization_id,recipient_user_id,actor_user_id,type,title,body,action_url,source_type,source_id,metadata,read_at,created_at";

const mapNotification = (row: NotificationRow): AppNotification => ({
  id: row.id,
  organizationId: row.organization_id,
  recipientUserId: row.recipient_user_id,
  actorUserId: row.actor_user_id,
  type: row.type,
  title: row.title,
  body: row.body,
  actionUrl: row.action_url,
  sourceType: row.source_type,
  sourceId: row.source_id,
  metadata: row.metadata ?? {},
  readAt: row.read_at,
  createdAt: row.created_at,
  read: Boolean(row.read_at),
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
  const actorUserId = String(input.actorUserId ?? (await getSessionUserId()) ?? "").trim();
  const title = input.title.trim();
  const body = input.body.trim();

  if (!organizationId || !recipientUserId || !title || !body) return null;

  return {
    organization_id: organizationId,
    recipient_user_id: recipientUserId,
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

const callCreateNotificationFunction = async (input: CreateNotificationInput) => {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Sessão inválida. Faça login novamente.");

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(input),
  });

  const raw = await response.text();
  const parsed = raw
    ? (JSON.parse(raw) as { error?: string; notification?: NotificationRow })
    : null;
  if (!response.ok) {
    throw new Error(parsed?.error || "Falha ao criar notificação.");
  }
  return parsed?.notification ? mapNotification(parsed.notification) : null;
};

export async function listNotifications(options: {
  organizationId?: string | null;
  limit?: number;
  unreadOnly?: boolean;
} = {}): Promise<AppNotification[]> {
  const organizationId = await resolveOrganizationId(options.organizationId);
  const recipientUserId = await getSessionUserId();
  if (!organizationId || !recipientUserId) return [];

  const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
  const unreadFilter = options.unreadOnly ? "&read_at=is.null" : "";
  try {
    const rows = await supabaseRestGet<NotificationRow[]>(
      `/notifications?select=${NOTIFICATION_SELECT}&organization_id=eq.${encodeURIComponent(
        organizationId
      )}&recipient_user_id=eq.${encodeURIComponent(
        recipientUserId
      )}${unreadFilter}&order=created_at.desc&limit=${limit}`
    );
    return (rows ?? []).map(mapNotification);
  } catch (error) {
    if (isMissingNotificationsTable(error)) return [];
    throw error;
  }
}

export async function getUnreadNotificationCount(
  organizationId?: string | null
): Promise<number> {
  const rows = await listNotifications({ organizationId, unreadOnly: true, limit: 100 });
  return rows.length;
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<AppNotification | null> {
  const payload = await buildCreatePayload(input);
  if (!payload) return null;

  let notification: AppNotification | null = null;
  try {
    const currentUserId = await getSessionUserId();
    const targetIsCurrentUser = payload.recipient_user_id === currentUserId;

    notification = targetIsCurrentUser
      ? mapNotification(
          (
            await supabaseRestPost<NotificationRow[]>("/notifications", [payload])
          )[0]
        )
      : await callCreateNotificationFunction({
          ...input,
          organizationId: payload.organization_id,
          recipientUserId: payload.recipient_user_id,
          actorUserId: payload.actor_user_id,
          type: payload.type,
          actionUrl: payload.action_url,
          sourceType: payload.source_type,
          sourceId: payload.source_id,
          metadata: payload.metadata,
        });
  } catch (error) {
    if (isMissingNotificationsTable(error)) return null;
    throw error;
  }

  if (input.sendPush && notification) {
    await sendPushToUser({
      organizationId: notification.organizationId,
      targetUserId: notification.recipientUserId,
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
    });
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
      "return=minimal"
    );
  } catch (error) {
    if (isMissingNotificationsTable(error)) return;
    throw error;
  }
}

export async function markAllNotificationsRead(
  organizationId?: string | null
): Promise<void> {
  const resolvedOrganizationId = await resolveOrganizationId(organizationId);
  const recipientUserId = await getSessionUserId();
  if (!resolvedOrganizationId || !recipientUserId) return;
  try {
    await supabaseRestPatch(
      `/notifications?organization_id=eq.${encodeURIComponent(
        resolvedOrganizationId
      )}&recipient_user_id=eq.${encodeURIComponent(recipientUserId)}&read_at=is.null`,
      { read_at: new Date().toISOString() },
      "return=minimal"
    );
  } catch (error) {
    if (isMissingNotificationsTable(error)) return;
    throw error;
  }
}

export async function clearMyNotifications(organizationId?: string | null): Promise<void> {
  const resolvedOrganizationId = await resolveOrganizationId(organizationId);
  const recipientUserId = await getSessionUserId();
  if (!resolvedOrganizationId || !recipientUserId) return;
  try {
    await supabaseRestDelete(
      `/notifications?organization_id=eq.${encodeURIComponent(
        resolvedOrganizationId
      )}&recipient_user_id=eq.${encodeURIComponent(recipientUserId)}`,
      "return=minimal"
    );
  } catch (error) {
    if (isMissingNotificationsTable(error)) return;
    throw error;
  }
}
