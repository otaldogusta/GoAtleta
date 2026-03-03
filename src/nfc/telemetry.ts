import * as Sentry from "@sentry/react-native";

type NfcLogContext = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN = /(uid|tag|token|phone|email|cpf|name)/i;

const maskString = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return normalized;
  if (normalized.length <= 4) return "***";
  return `${normalized.slice(0, 2)}***${normalized.slice(-2)}`;
};

const sanitizeValue = (key: string, value: unknown): unknown => {
  if (value == null) return value;
  if (typeof value === "string") {
    return SENSITIVE_KEY_PATTERN.test(key) ? maskString(value) : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(key, entry));
  }
  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    return Object.entries(objectValue).reduce<Record<string, unknown>>((acc, [childKey, childValue]) => {
      acc[childKey] = sanitizeValue(childKey, childValue);
      return acc;
    }, {});
  }
  return String(value);
};

const sanitizeContext = (context?: NfcLogContext) => {
  if (!context) return undefined;
  return Object.entries(context).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[key] = sanitizeValue(key, value);
    return acc;
  }, {});
};

export function logNfcEvent(message: string, data?: NfcLogContext) {
  Sentry.addBreadcrumb({
    category: "nfc",
    message,
    level: "info",
    data: sanitizeContext(data),
  });
}

export function logNfcError(error: unknown, context?: NfcLogContext) {
  Sentry.withScope((scope) => {
    scope.setTag("module", "nfc");
    const safeContext = sanitizeContext(context);
    if (safeContext) {
      Object.entries(safeContext).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}
