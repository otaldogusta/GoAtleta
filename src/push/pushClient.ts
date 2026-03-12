import * as Sentry from "@sentry/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { upsertMyPushToken } from "../api/push-tokens";
import { getNotificationsModule, isExpoGo } from "./notificationRuntime";

export type PushRoutePayload = {
  route: string;
  params?: Record<string, string>;
};

type PushRouter = {
  push: (value: unknown) => void;
};

const TOKEN_CACHE_PREFIX = "push_token_reg_v1:";
const tokenRegisterInFlight = new Map<string, Promise<void>>();

const addPushBreadcrumb = (message: string, data?: Record<string, unknown>) => {
  Sentry.addBreadcrumb({
    category: "push",
    level: "info",
    message,
    data,
  });
};

const toStringParams = (input: unknown): Record<string, string> => {
  if (!input || typeof input !== "object") return {};
  const output: Record<string, string> = {};
  Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    output[key] = String(value);
  });
  return output;
};

export const resolvePushRoutePayload = (input: unknown): PushRoutePayload | null => {
  if (!input || typeof input !== "object") return null;
  const data = input as Record<string, unknown>;
  const route = typeof data.route === "string" ? data.route.trim() : "";
  if (!route) return null;
  const params = toStringParams(data.params);
  return Object.keys(params).length > 0 ? { route, params } : { route };
};

export const ensurePushPermissions = async (): Promise<boolean> => {
  if (Platform.OS === "web" || isExpoGo) return false;
  const Notifications = getNotificationsModule();
  if (!Notifications) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      addPushBreadcrumb("push.permission.granted", { source: "current" });
      return true;
    }
    const requested = await Notifications.requestPermissionsAsync();
    const granted = Boolean(
      requested.granted ||
        requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
    addPushBreadcrumb(granted ? "push.permission.granted" : "push.permission.denied", {
      source: "request",
    });
    return granted;
  } catch (error) {
    addPushBreadcrumb("push.permission.denied", {
      source: "exception",
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

const getProjectId = () => {
  const fromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId;
   
  const fromEasConfig = (Constants as any).easConfig?.projectId as string | undefined;
  return (fromExpoConfig || fromEasConfig || "").trim();
};

export const getExpoPushTokenSafe = async (): Promise<string> => {
  if (Platform.OS === "web" || isExpoGo) return "";
  const Notifications = getNotificationsModule();
  if (!Notifications) return "";
  const allowed = await ensurePushPermissions();
  if (!allowed) return "";
  try {
    const projectId = getProjectId();
    const tokenResponse = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse.data?.trim() ?? "";
    addPushBreadcrumb(token ? "push.token.ok" : "push.token.fail", {
      projectId: projectId || null,
      hasToken: Boolean(token),
    });
    return token;
  } catch (error) {
    addPushBreadcrumb("push.token.fail", {
      error: error instanceof Error ? error.message : String(error),
    });
    return "";
  }
};

export const attachPushListeners = (router: PushRouter): (() => void) => {
  if (Platform.OS === "web" || isExpoGo) {
    return () => undefined;
  }
  const Notifications = getNotificationsModule();
  if (!Notifications) {
    return () => undefined;
  }
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    const payload = resolvePushRoutePayload(notification.request.content.data);
    addPushBreadcrumb("push.receive", {
      hasRoute: Boolean(payload?.route),
      route: payload?.route ?? null,
    });
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const payload = resolvePushRoutePayload(response.notification.request.content.data);
    if (!payload?.route) return;
    addPushBreadcrumb("push.tap.route", {
      route: payload.route,
      hasParams: Boolean(payload.params && Object.keys(payload.params).length > 0),
    });
    if (payload.params && Object.keys(payload.params).length > 0) {
      router.push({ pathname: payload.route, params: payload.params });
      return;
    }
    router.push(payload.route as never);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
};

export async function ensurePushTokenRegistered(params: {
  organizationId: string;
  deviceId?: string | null;
}): Promise<void> {
  const organizationId = String(params.organizationId ?? "").trim();
  if (!organizationId || Platform.OS === "web" || isExpoGo) return;
  const inFlightKey = organizationId;
  const existing = tokenRegisterInFlight.get(inFlightKey);
  if (existing) {
    await existing;
    return;
  }

  const task = (async () => {
    const token = await getExpoPushTokenSafe();
    if (!token) return;

    const cacheKey = `${TOKEN_CACHE_PREFIX}${organizationId}`;
    const lastRegistered = await AsyncStorage.getItem(cacheKey);
    if (lastRegistered === token) return;

    await upsertMyPushToken({
      organizationId,
      expoPushToken: token,
      platform: Platform.OS === "ios" ? "ios" : "android",
      deviceId: params.deviceId ?? null,
    });
    await AsyncStorage.setItem(cacheKey, token);
    addPushBreadcrumb("push.token.registered", {
      organizationId,
      platform: Platform.OS,
    });
  })().finally(() => {
    tokenRegisterInFlight.delete(inFlightKey);
  });

  tokenRegisterInFlight.set(inFlightKey, task);
  await task;
}
