const DEFAULT_BLOCKED_ROUTES = new Set([
  "/login",
  "/signup",
  "/welcome",
  "/onboarding",
  "/reset-password",
  "/verify-email",
]);

const DEFAULT_BLOCKED_PREFIXES = ["/invite"];

const normalizePathForComparison = (path: string) => {
  if (path.length <= 1) return path;
  return path.replace(/\/+$/, "");
};

export function sanitizePostLoginRedirect(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const input = String(raw ?? "").trim();
  if (!input) return null;
  if (!input.startsWith("/") || input.startsWith("//") || input.includes("\\")) return null;

  let parsed: URL;
  try {
    parsed = new URL(input, "https://goatleta.local");
  } catch {
    return null;
  }

  if (parsed.origin !== "https://goatleta.local") return null;

  const pathname = normalizePathForComparison(parsed.pathname || "/");
  if (DEFAULT_BLOCKED_ROUTES.has(pathname)) return null;
  if (
    DEFAULT_BLOCKED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  ) {
    return null;
  }

  return `${pathname}${parsed.search}${parsed.hash}`;
}

export function buildLoginRedirectHref(nextValue: unknown): string {
  const next = sanitizePostLoginRedirect(nextValue);
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}
