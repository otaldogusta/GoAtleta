import type { BeforeSendEvent } from "@vercel/analytics/react";
import { sanitizeNavigationUrl } from "./navigation-privacy";

export function sanitizeVercelAnalyticsEvent(
  event: BeforeSendEvent,
): BeforeSendEvent | null {
  const safeUrl = sanitizeNavigationUrl(event.url);
  if (!safeUrl) return null;

  return {
    ...event,
    url: safeUrl,
  };
}
