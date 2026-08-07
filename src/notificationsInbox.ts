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

let listeners: Listener[] = [];

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

const emit = (items: AppNotification[]) => {
  const visibleItems = items.filter(isUserVisibleNotification);
  listeners.forEach((listener) => listener(visibleItems));
};

const readAll = async (inboxScope: NotificationInboxScope) => {
  try {
    const items = await listNotifications({ inboxScope });
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
}: {
  inboxScope: NotificationInboxScope;
  limit?: number;
  offset?: number;
  archiveScope?: NotificationArchiveScope;
}): Promise<NotificationsPage> => {
  const pageSize = Math.max(1, Math.min(Math.floor(limit), 50));
  try {
    const rows = await listNotifications({
      inboxScope,
      limit: pageSize + 1,
      offset,
      archiveScope,
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

const refreshListeners = async (inboxScope: NotificationInboxScope) => {
  const items = await readAll(inboxScope);
  emit(items);
  return items;
};

export const subscribeNotifications = (listener: Listener) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
};

export const getNotifications = async (inboxScope: NotificationInboxScope) => {
  return await readAll(inboxScope);
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
    await refreshListeners(options.inboxScope);
    return created;
  } catch {
    return null;
  }
};

export const markAllRead = async (inboxScope: NotificationInboxScope) => {
  await markAllNotificationsRead(inboxScope);
  await refreshListeners(inboxScope);
};

export const markNotificationRead = async (
  id: string,
  inboxScope: NotificationInboxScope,
) => {
  await markRemoteNotificationRead(id);
  await refreshListeners(inboxScope);
};

export const archiveRead = async (inboxScope: NotificationInboxScope) => {
  await archiveReadNotifications(inboxScope);
  await refreshListeners(inboxScope);
};

export const restoreNotification = async (
  id: string,
  inboxScope: NotificationInboxScope,
) => {
  await restoreRemoteNotification(id);
  await refreshListeners(inboxScope);
};

export const clearNotifications = async (inboxScope: NotificationInboxScope) => {
  await clearMyNotifications(inboxScope);
  emit([]);
};

export const getUnreadCount = async (inboxScope: NotificationInboxScope) => {
  return await getUnreadNotificationCount(inboxScope);
};
