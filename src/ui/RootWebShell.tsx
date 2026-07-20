import { usePathname } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import type { AppRole } from "../components/navigation/tab-config";
import { useEffectiveProfile, type EffectiveProfile } from "../core/effective-profile";
import { AppShell } from "./AppShell";

const WEB_SHELL_LAST_SCOPE_KEY = "goatleta:web-shell-last-scope";

const normalizePath = (value: string) => {
  if (!value) return "/";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "/";
  return trimmed.replace(/\/+$/, "");
};

const isAppRole = (value: string | null): value is AppRole =>
  value === "prof" || value === "coord" || value === "student";

const getExplicitRoleForPath = (pathname: string): AppRole | null => {
  const path = normalizePath(pathname);
  if (path === "/prof" || path.startsWith("/prof/")) return "prof";
  if (path === "/coord" || path.startsWith("/coord/") || path === "/coordination") {
    return "coord";
  }
  if (path === "/student" || path.startsWith("/student/")) return "student";
  return null;
};

const shouldWrapSharedRoute = (pathname: string) => {
  const path = normalizePath(pathname);
  return (
    path === "/profile" ||
    path === "/classes" ||
    path === "/class" ||
    path.startsWith("/class/")
  );
};

const getFallbackRole = (effectiveProfile: EffectiveProfile): AppRole => {
  if (effectiveProfile === "admin") return "coord";
  if (effectiveProfile === "student") return "student";
  return "prof";
};

export function RootWebShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const effectiveProfile = useEffectiveProfile();
  const explicitRole = getExplicitRoleForPath(pathname);
  const [lastExplicitRole, setLastExplicitRole] = useState<AppRole | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(WEB_SHELL_LAST_SCOPE_KEY);
    if (isAppRole(stored)) {
      setLastExplicitRole(stored);
    }
  }, []);

  useEffect(() => {
    if (!explicitRole) return;
    setLastExplicitRole(explicitRole);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(WEB_SHELL_LAST_SCOPE_KEY, explicitRole);
  }, [explicitRole]);

  if (!shouldWrapSharedRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <AppShell role={lastExplicitRole ?? getFallbackRole(effectiveProfile)}>
      {children}
    </AppShell>
  );
}
