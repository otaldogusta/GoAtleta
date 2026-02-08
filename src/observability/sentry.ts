import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";
import * as Sentry from "@sentry/react-native";

const extra =
  Constants.expoConfig?.extra ??
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Constants as any).manifest?.extra ??
  {};

const getRuntimeVersion = () => {
  const runtime = Constants.expoConfig.runtimeVersion;
  if (typeof runtime === "string") return runtime;
  if (typeof Updates.runtimeVersion === "string") return Updates.runtimeVersion;
  return "unknown";
};

export const setSentryBaseTags = () => {
  const appVersion = Constants.expoConfig.version ?? extra.APP_VERSION ?? "unknown";
  const channel =
    Updates.channel ??
    extra.EAS_UPDATE_CHANNEL ??
    extra.CHANNEL ??
    "unknown";

  Sentry.setTag("platform", Platform.OS);
  Sentry.setTag("appVersion", appVersion);
  Sentry.setTag("runtimeVersion", getRuntimeVersion());
  Sentry.setTag("channel", channel);

  if (typeof Updates.updateId === "string" && Updates.updateId.length > 0) {
    Sentry.setTag("updateId", Updates.updateId);
  }
};

export const setSentryUser = (id: string) => {
  if (!id) return;
  Sentry.setUser({ id });
};

export const clearSentryUser = () => {
  Sentry.setUser(null);
};
