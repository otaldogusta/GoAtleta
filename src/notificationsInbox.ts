import {
  AppNotification,
  CreateNotificationInput,
  clearMyNotifications,
  createNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead as markRemoteNotificationRead,
} from "./api/notifications";

export type { AppNotification, CreateNotificationInput };

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

const isUserVisibleNotification = (item: Pick<AppNotification, "title" | "body">) => {
  if (TECHNICAL_NOTIFICATION_TITLES.has(item.title)) return false;
  const body = item.body ?? "";
  return !TECHNICAL_NOTIFICATION_PATTERNS.some((pattern) => body.includes(pattern));
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
  options: Omit<CreateNotificationInput, "title" | "body"> = {}
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

export const clearNotifications = async () => {
  await clearMyNotifications();
  emit([]);
};

export const getUnreadCount = async () => {
  return await getUnreadNotificationCount();
};
