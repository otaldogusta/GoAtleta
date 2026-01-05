import AsyncStorage from "@react-native-async-storage/async-storage";

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

const emit = (items: AppNotification[]) => {
  listeners.forEach((listener) => listener(items));
};

const readAll = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AppNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  const items = await readAll();
  const next: AppNotification[] = [
    {
      id: "n_" + Date.now(),
      title,
      body,
      createdAt: new Date().toISOString(),
      read: false,
    },
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
