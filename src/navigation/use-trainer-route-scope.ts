import { usePathname } from "expo-router";
import { useMemo } from "react";
import { Platform } from "react-native";

import { useEffectiveProfile } from "../hooks/use-effective-profile";
import {
  getTrainerScopedRoutes,
  isProfileRouteScope,
  resolveTrainerRouteScope,
  WEB_SHELL_LAST_SCOPE_KEY,
} from "./profile-route-scope";

const getStoredScope = () => {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(WEB_SHELL_LAST_SCOPE_KEY);
    return isProfileRouteScope(value) ? value : null;
  } catch {
    return null;
  }
};

export function useTrainerRouteScope() {
  const pathname = usePathname();
  const effectiveProfile = useEffectiveProfile();

  return useMemo(() => {
    const scope = resolveTrainerRouteScope({
      pathname,
      effectiveProfile,
      storedScope: getStoredScope(),
    });
    return getTrainerScopedRoutes(scope);
  }, [effectiveProfile, pathname]);
}
