import { usePathname } from "expo-router";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { useEffectiveProfile } from "../hooks/use-effective-profile";
import {
  getExplicitProfileRouteScope,
  isProfileRouteScope,
  resolveProfileRouteScope,
  shouldWrapSharedProfileRoute,
  WEB_SHELL_LAST_SCOPE_KEY,
} from "../navigation/profile-route-scope";
import { AppShell } from "./AppShell";

const getStoredWebScopeRole = () => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(WEB_SHELL_LAST_SCOPE_KEY);
    return isProfileRouteScope(stored) ? stored : null;
  } catch {
    return null;
  }
};

export function RootWebShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const effectiveProfile = useEffectiveProfile();
  const explicitRole = getExplicitProfileRouteScope(pathname);
  const storedRole = typeof window === "undefined" ? null : getStoredWebScopeRole();
  const selectedRole = resolveProfileRouteScope({
    pathname,
    effectiveProfile,
    storedScope: storedRole,
  });

  useEffect(() => {
    if (!explicitRole) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(WEB_SHELL_LAST_SCOPE_KEY, explicitRole);
  }, [explicitRole]);

  if (!shouldWrapSharedProfileRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <AppShell role={selectedRole}>
      {children}
    </AppShell>
  );
}
