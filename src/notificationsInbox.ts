import {
  AppNotification,
  CreateNotificationInput,
  NotificationArchiveScope,
  archiveReadNotifications,
  clearMyNotifications,
  createNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead as markRemoteNotificationRead,
  restoreNotification as restoreRemoteNotification,
} from "./api/notifications";
import type { NotificationInboxScope } from "./notifications/inbox-scope";

export type {
  AppNotification,
  CreateNotificationInput,
  NotificationArchiveScope,
};
export type { NotificationInboxScope };

type Listener = (items: AppNotification[]) => void;

type ListenerSubscription = {
  listener: Listener;
  key: string;
  inboxScope: NotificationInboxScope;
  organizationId: string | null;
};

let listeners: ListenerSubscription[] = [];

const normalizeSubscriptionOrganizationId = (organizationId?: string | null) =>
  String(organizationId ?? "").trim() || null;

const getSubscriptionKey = (
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
) => `${inboxScope}:${normalizeSubscriptionOrganizationId(organizationId) ?? ""}`;

const TECHNICAL_NOTIFICATION_TITLES = new Set(["Erro fatal", "Erro no app"]);
const TECHNICAL_NOTIFICATION_PATTERNS = [
  "Requiring unknown module",
  "Unexpected token '<'",
  "Stack:",
  "SyntaxError:",
  "ReferenceError:",
  "TypeError:",
  "Invariant Violation",
];

const isUserVisibleNotification = (
  item: Pick<AppNotification, "title" | "body">,
) => {
  if (TECHNICAL_NOTIFICATION_TITLES.has(item.title)) return false;
  const body = item.body ?? "";
  return !TECHNICAL_NOTIFICATION_PATTERNS.some((pattern) =>
    body.includes(pattern),
  );
};

const emit = (
  items: AppNotification[],
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
) => {
  const visibleItems = items.filter(isUserVisibleNotification);
  const key = getSubscriptionKey(inboxScope, organizationId);
  listeners.forEach((subscription) => {
    if (subscription.key === key) {
      subscription.listener(visibleItems);
    }
  });
};

const readAll = async (
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
) => {
  try {
    const items = await listNotifications({ inboxScope, organizationId });
    return items.filter(isUserVisibleNotification);
  } catch {
    return [];
  }
};

export type NotificationsPage = {
  items: AppNotification[];
  hasMore: boolean;
  nextOffset: number;
};

export const getNotificationsPage = async ({
  inboxScope,
  limit = 20,
  offset = 0,
  archiveScope = "active",
  organizationId,
}: {
  inboxScope: NotificationInboxScope;
  limit?: number;
  offset?: number;
  archiveScope?: NotificationArchiveScope;
  organizationId?: string | null;
}): Promise<NotificationsPage> => {
  const pageSize = Math.max(1, Math.min(Math.floor(limit), 50));
  try {
    const rows = await listNotifications({
      inboxScope,
      limit: pageSize + 1,
      offset,
      archiveScope,
      organizationId,
    });
    const hasMore = rows.length > pageSize;
    const pageRows = rows.slice(0, pageSize);
    return {
      items: pageRows.filter(isUserVisibleNotification),
      hasMore,
      nextOffset: offset + pageRows.length,
    };
  } catch {
    return { items: [], hasMore: false, nextOffset: offset };
  }
};

const refreshListeners = async (
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
) => {
  const normalizedOrganizationId = normalizeSubscriptionOrganizationId(organizationId);
  const contexts = new Map<
    string,
    { inboxScope: NotificationInboxScope; organizationId: string | null }
  >();
  const addContext = (
    contextInboxScope: NotificationInboxScope,
    contextOrganizationId: string | null,
  ) => {
    const key = getSubscriptionKey(contextInboxScope, contextOrganizationId);
    if (!contexts.has(key)) {
      contexts.set(key, {
        inboxScope: contextInboxScope,
        organizationId: contextOrganizationId,
      });
    }
  };

  addContext(inboxScope, normalizedOrganizationId);
  listeners.forEach((subscription) => {
    if (subscription.organizationId !== normalizedOrganizationId) return;
    const receivesMutation =
      inboxScope === "all" ||
      subscription.inboxScope === "all" ||
      subscription.inboxScope === inboxScope;
    if (receivesMutation) {
      addContext(subscription.inboxScope, subscription.organizationId);
    }
  });

  await Promise.all(
    Array.from(contexts.values()).map(async (context) => {
      const items = await readAll(context.inboxScope, context.organizationId);
      emit(items, context.inboxScope, context.organizationId);
    }),
  );
};

export const subscribeNotifications = (
  listener: Listener,
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
) => {
  const subscription = {
    listener,
    key: getSubscriptionKey(inboxScope, organizationId),
    inboxScope,
    organizationId: normalizeSubscriptionOrganizationId(organizationId),
  };
  listeners.push(subscription);
  return () => {
    listeners = listeners.filter((item) => item !== subscription);
  };
};

export const getNotifications = async (
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
) => {
  return await readAll(inboxScope, organizationId);
};

export const addNotification = async (
  title: string,
  body: string,
  options: Omit<CreateNotificationInput, "title" | "body">,
) => {
  const candidate = { title, body };
  if (!isUserVisibleNotification(candidate)) return null;
  try {
    const created = await createNotification({
      ...options,
      title,
      body,
    });
    await refreshListeners(
      options.inboxScope,
      created?.organizationId ?? options.organizationId,
    );
    return created;
  } catch {
    return null;
  }
};

export const markAllRead = async (
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
) => {
  await markAllNotificationsRead(inboxScope, organizationId);
  await refreshListeners(inboxScope, organizationId);
};

export const markNotificationRead = async (
  id: string,
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
) => {
  await markRemoteNotificationRead(id);
  await refreshListeners(inboxScope, organizationId);
};

export const archiveRead = async (
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
) => {
  await archiveReadNotifications(inboxScope, organizationId);
  await refreshListeners(inboxScope, organizationId);
};

export const restoreNotification = async (
  id: string,
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
) => {
  await restoreRemoteNotification(id, organizationId);
  await refreshListeners(inboxScope, organizationId);
};

export const clearNotifications = async (
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
) => {
  await clearMyNotifications(inboxScope, organizationId);
  await refreshListeners(inboxScope, organizationId);
};

export const getUnreadCount = async (
  inboxScope: NotificationInboxScope,
  organizationId?: string | null,
) => {
  return await getUnreadNotificationCount(inboxScope, organizationId);
};
