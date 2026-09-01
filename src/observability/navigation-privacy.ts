const DYNAMIC_SEGMENT = "_id";
const NAVIGATION_BASE_URL = "https://navigation.goatleta.invalid";

const sanitizePathname = (pathname: string) => {
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

  if ((root === "invite" || root === "family-invite") && segments[2]) {
    segments[2] = "_token";
  }

  return segments.join("/");
};

export const sanitizeNavigationPath = (value: string): string | null => {
  const candidate = String(value ?? "").trim();
  if (!candidate) return null;

  const isPath = candidate.startsWith("/");
  const isAbsoluteUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(candidate);
  if (!isPath && !isAbsoluteUrl) return null;

  try {
    const url = isAbsoluteUrl
      ? new URL(candidate)
      : new URL(candidate, NAVIGATION_BASE_URL);
    return sanitizePathname(url.pathname);
  } catch {
    return null;
  }
};

export const sanitizeNavigationUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    url.pathname = sanitizePathname(url.pathname);
    url.search = "";
    url.hash = "";
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return null;
  }
};
