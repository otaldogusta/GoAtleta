import AsyncStorage from "@react-native-async-storage/async-storage";
import { safeJsonParse } from "./utils/safe-json";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

const STORAGE_KEY = "notifications_inbox_v1";

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

const isUserVisibleNotification = (item: AppNotification) => {
  if (TECHNICAL_NOTIFICATION_TITLES.has(item.title)) return false;
  const body = item.body ?? "";
  return !TECHNICAL_NOTIFICATION_PATTERNS.some((pattern) => body.includes(pattern));
};

const emit = (items: AppNotification[]) => {
  const visibleItems = items.filter(isUserVisibleNotification);
  listeners.forEach((listener) => listener(visibleItems));
};

const readAll = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = safeJsonParse<AppNotification[] | null>(raw, null);
  return Array.isArray(parsed) ? parsed.filter(isUserVisibleNotification) : [];
};

const writeAll = async (items: AppNotification[]) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  emit(items);
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

export const addNotification = async (title: string, body: string) => {
  const candidate: AppNotification = {
    id: "n_" + Date.now(),
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false,
  };
  if (!isUserVisibleNotification(candidate)) return;
  const items = await readAll();
  const next: AppNotification[] = [
    candidate,
    ...items,
  ];
  await writeAll(next);
};

export const markAllRead = async () => {
  const items = await readAll();
  if (!items.length) return;
  const next = items.map((item) => ({ ...item, read: true }));
  await writeAll(next);
};

export const clearNotifications = async () => {
  await AsyncStorage.removeItem(STORAGE_KEY);
  emit([]);
};

export const getUnreadCount = async () => {
  const items = await readAll();
  return items.filter((item) => !item.read).length;
};
