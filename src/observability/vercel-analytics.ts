import type { BeforeSendEvent } from "@vercel/analytics/react";

const DYNAMIC_SEGMENT = "_id";

function sanitizePathname(pathname: string) {
  const segments = pathname.split("/");
  const root = segments[1];

  if (root === "class" && segments[2]) {
    segments[2] = DYNAMIC_SEGMENT;

    if (segments[3] === "planning" && segments[4]) {
      segments[4] = "_month";
    }

    if (segments[3] === "scouting" && segments[4] && segments[4] !== "new") {
      segments[4] = "_session";
    }
  }

  if ((root === "events" || root === "students") && segments[2]) {
    segments[2] = DYNAMIC_SEGMENT;
  }

  if (root === "invite" && segments[2]) {
    segments[2] = "_token";
  }

  return segments.join("/");
}

export function sanitizeVercelAnalyticsEvent(
  event: BeforeSendEvent,
): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    url.pathname = sanitizePathname(url.pathname);
    url.search = "";
    url.hash = "";

    return {
      ...event,
      url: url.toString(),
    };
  } catch {
    return null;
  }
}
