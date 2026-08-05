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

export type {
  AppNotification,
  CreateNotificationInput,
  NotificationArchiveScope,
};

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

const readAll = async () => {
  try {
    const items = await listNotifications();
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
  limit = 20,
  offset = 0,
  archiveScope = "active",
}: {
  limit?: number;
  offset?: number;
  archiveScope?: NotificationArchiveScope;
} = {}): Promise<NotificationsPage> => {
  const pageSize = Math.max(1, Math.min(Math.floor(limit), 50));
  try {
    const rows = await listNotifications({
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

const refreshListeners = async () => {
  const items = await readAll();
  emit(items);
  return items;
};

export const subscribeNotifications = (listener: Listener) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
};

export const getNotifications = async () => {
  return await readAll();
};

export const addNotification = async (
  title: string,
  body: string,
  options: Omit<CreateNotificationInput, "title" | "body"> = {},
) => {
  const candidate = { title, body };
  if (!isUserVisibleNotification(candidate)) return null;
  try {
    const created = await createNotification({
      ...options,
      title,
      body,
    });
    await refreshListeners();
    return created;
  } catch {
    return null;
  }
};

export const markAllRead = async () => {
  await markAllNotificationsRead();
  await refreshListeners();
};

export const markNotificationRead = async (id: string) => {
  await markRemoteNotificationRead(id);
  await refreshListeners();
};

export const archiveRead = async () => {
  await archiveReadNotifications();
  await refreshListeners();
};

export const restoreNotification = async (id: string) => {
  await restoreRemoteNotification(id);
  await refreshListeners();
};

export const clearNotifications = async () => {
  await clearMyNotifications();
  emit([]);
};

export const getUnreadCount = async () => {
  return await getUnreadNotificationCount();
};
