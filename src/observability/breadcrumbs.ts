import * as Sentry from "@sentry/react-native";

export const logNavigation = (pathname: string) => {
  if (!pathname) return;
  Sentry.addBreadcrumb({
    category: "navigation",
    message: `Route: ${pathname}`,
    level: "info",
  });
};

export const logAction = (name: string, data: Record<string, unknown>) => {
  if (!name) return;
  Sentry.addBreadcrumb({
    category: "action",
    message: name,
    data,
    level: "info",
  });
};
