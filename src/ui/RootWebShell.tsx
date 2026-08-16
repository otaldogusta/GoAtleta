import { usePathname } from "expo-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Platform } from "react-native";

import { useEffectiveProfile } from "../hooks/use-effective-profile";
import {
  getExplicitProfileRouteScope,
  isProfileRouteScope,
  resolveProfileRouteScope,
  shouldWrapSharedProfileRoute,
  WEB_SHELL_LAST_SCOPE_KEY,
} from "../navigation/profile-route-scope";
import { AppShell } from "./AppShell";
import { resolveWebLocalStorage } from "./web-local-storage";

const getWebLocalStorage = () => {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    return resolveWebLocalStorage(Platform.OS, window.localStorage);
  } catch {
    return null;
  }
};

const getStoredWebScopeRole = () => {
  const storage = getWebLocalStorage();
  if (!storage) return null;
  try {
    const stored = storage.getItem(WEB_SHELL_LAST_SCOPE_KEY);
    return isProfileRouteScope(stored) ? stored : null;
  } catch {
    return null;
  }
};

export function RootWebShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const effectiveProfile = useEffectiveProfile();
  const explicitRole = getExplicitProfileRouteScope(pathname);
  const storedRole = getStoredWebScopeRole();
  const selectedRole = resolveProfileRouteScope({
    pathname,
    effectiveProfile,
    storedScope: storedRole,
  });

  useEffect(() => {
    if (!explicitRole) return;
    const storage = getWebLocalStorage();
    if (!storage) return;
    try {
      storage.setItem(WEB_SHELL_LAST_SCOPE_KEY, explicitRole);
    } catch {
      // Storage can be blocked by the browser. Route resolution still works
      // from the current profile without persistence.
    }
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
