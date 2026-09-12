import {
  registerWebPushSubscription,
  unregisterWebPushSubscription,
  type StoredWebPushSubscription,
} from "../api/web-push-subscriptions";

export type WebNotificationPermission = "unsupported" | NotificationPermission;
export type WebPushStatus =
  | "unsupported"
  | "unconfigured"
  | "default"
  | "denied"
  | "subscribed"
  | "unsubscribed";

const getNotificationApi = () =>
  typeof window !== "undefined" && "Notification" in window ? window.Notification : null;

const getVapidPublicKey = () =>
  typeof process === "undefined"
    ? ""
    : String(process.env.EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? "").trim();

const supportsWebPush = () => Boolean(
  typeof window !== "undefined"
    && window.isSecureContext
    && "serviceWorker" in navigator
    && "PushManager" in window
    && getNotificationApi(),
);

const urlBase64ToUint8Array = (value: string) => {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = window.atob(base64);
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
};

const serializeSubscription = (subscription: PushSubscription): StoredWebPushSubscription => {
  const json = subscription.toJSON();
  const p256dh = String(json.keys?.p256dh ?? "");
  const auth = String(json.keys?.auth ?? "");
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("O navegador retornou uma inscrição web push incompleta.");
  }
  return { endpoint: json.endpoint, p256dh, auth };
};

const getRegistration = async () => {
  await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
  return await navigator.serviceWorker.ready;
};

export const getWebNotificationPermission = (): WebNotificationPermission => {
  const api = getNotificationApi();
  return api ? api.permission : "unsupported";
};

export const requestWebNotificationPermission = async (): Promise<WebNotificationPermission> => {
  const api = getNotificationApi();
  if (!api) return "unsupported";
  if (api.permission !== "default") return api.permission;
  return await api.requestPermission();
};

export const getWebPushStatus = async (): Promise<WebPushStatus> => {
  if (!supportsWebPush()) return "unsupported";
  if (!getVapidPublicKey()) return "unconfigured";
  const permission = getWebNotificationPermission();
  if (permission === "default" || permission === "denied") return permission;
  const registration = await getRegistration();
  return await registration.pushManager.getSubscription() ? "subscribed" : "unsubscribed";
};

export const enableWebPush = async (organizationId: string): Promise<WebPushStatus> => {
  if (!supportsWebPush()) return "unsupported";
  const vapidPublicKey = getVapidPublicKey();
  if (!vapidPublicKey) return "unconfigured";
  const permission = await requestWebNotificationPermission();
  if (permission !== "granted") return permission;

  const registration = await getRegistration();
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  await registerWebPushSubscription(organizationId, serializeSubscription(subscription));
  return "subscribed";
};

export const disableWebPush = async (organizationId: string): Promise<void> => {
  if (!supportsWebPush()) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const serialized = serializeSubscription(subscription);
  await unregisterWebPushSubscription(organizationId, serialized);
  await subscription.unsubscribe();
};
