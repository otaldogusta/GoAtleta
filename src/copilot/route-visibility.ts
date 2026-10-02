const publicRoutes = new Set([
  "/welcome",
  "/login",
  "/signup",
  "/verify-email",
  "/reset-password",
  "/pending",
  "/auth-callback",
  "/staff-invite",
]);

const invitePrefixes = ["/invite", "/family-invite", "/staff-invite"];

export function isCopilotPublicRoute(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return publicRoutes.has(path) || invitePrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
