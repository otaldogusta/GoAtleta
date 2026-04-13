import * as Sentry from "@sentry/react-native";

const renderCounters = new Map<string, number>();
const renderLastMarkedAt = new Map<string, number>();
const RENDER_MARK_THROTTLE_MS = 1000;

const addPerfBreadcrumb = (
  name: string,
  status: "ok" | "error",
  ms: number,
  data?: Record<string, unknown>
) => {
  Sentry.addBreadcrumb({
    category: "perf",
    message: status === "ok" ? name : `${name} failed`,
    data: { ms, status, ...(data ?? {}) },
    level: status === "ok" ? "info" : "error",
  });
};

export const measureAsync = async <T>(
  name: string,
  fn: () => Promise<T>,
  data?: Record<string, unknown>
) => {
  const start = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - start;
    addPerfBreadcrumb(name, "ok", ms, data);
    return result;
  } catch (error) {
    const ms = Date.now() - start;
    addPerfBreadcrumb(name, "error", ms, data);
    throw error;
  }
};

export const measure = async <T>(
  name: string,
  fn: () => Promise<T>,
  data?: Record<string, unknown>
) => measureAsync(name, fn, data);

export const markRender = (name: string, data?: Record<string, unknown>) => {
  if (!__DEV__) return;

  const now = Date.now();
  const last = renderLastMarkedAt.get(name) ?? 0;
  if (now - last < RENDER_MARK_THROTTLE_MS) return;

  renderLastMarkedAt.set(name, now);
  const nextCount = (renderCounters.get(name) ?? 0) + 1;
  renderCounters.set(name, nextCount);

  Sentry.addBreadcrumb({
    category: "perf",
    message: name,
    data: { count: nextCount, ...(data ?? {}) },
    level: "info",
  });
};
