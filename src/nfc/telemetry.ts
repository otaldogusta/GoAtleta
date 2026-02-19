import * as Sentry from "@sentry/react-native";

type NfcLogContext = Record<string, unknown>;

export function logNfcEvent(message: string, data?: NfcLogContext) {
  Sentry.addBreadcrumb({
    category: "nfc",
    message,
    level: "info",
    data,
  });
}

export function logNfcError(error: unknown, context?: NfcLogContext) {
  Sentry.withScope((scope) => {
    scope.setTag("module", "nfc");
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}
