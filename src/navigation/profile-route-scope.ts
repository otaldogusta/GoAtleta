import type { EffectiveProfile } from "../core/effective-profile";

export type ProfileRouteScope = "prof" | "coord" | "student";
export type TrainerRouteScope = Extract<ProfileRouteScope, "prof" | "coord">;

export const WEB_SHELL_LAST_SCOPE_KEY = "goatleta:web-shell-last-scope";

const normalizePath = (value: string) => {
  if (!value) return "/";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "/";
  return trimmed.replace(/\/+$/, "");
};

const isPathInside = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

export const isProfileRouteScope = (value: unknown): value is ProfileRouteScope =>
  value === "prof" || value === "coord" || value === "student";

export const getExplicitProfileRouteScope = (
  pathname: string,
): ProfileRouteScope | null => {
  const path = normalizePath(pathname);
  if (isPathInside(path, "/prof")) return "prof";
  if (isPathInside(path, "/coord") || path === "/coordination") return "coord";
  if (isPathInside(path, "/student") || path === "/student-home") return "student";
  return null;
};

const SHARED_WEB_SHELL_PREFIXES = [
  "/profile",
  "/classes",
  "/class",
  "/students",
  "/training",
  "/periodization",
  "/assistant",
  "/events",
  "/regulation-history",
  "/nfc-attendance",
  "/reports",
] as const;

export const shouldWrapSharedProfileRoute = (pathname: string) => {
  const path = normalizePath(pathname);
  return SHARED_WEB_SHELL_PREFIXES.some((prefix) => isPathInside(path, prefix));
};

const getFallbackScope = (effectiveProfile: EffectiveProfile): ProfileRouteScope => {
  if (effectiveProfile === "admin") return "coord";
  if (effectiveProfile === "student") return "student";
  return "prof";
};

export const resolveProfileRouteScope = (params: {
  pathname: string;
  effectiveProfile: EffectiveProfile;
  storedScope?: ProfileRouteScope | null;
}): ProfileRouteScope =>
  getExplicitProfileRouteScope(params.pathname) ??
  params.storedScope ??
  getFallbackScope(params.effectiveProfile);

export const resolveTrainerRouteScope = (params: {
  pathname: string;
  effectiveProfile: EffectiveProfile;
  storedScope?: ProfileRouteScope | null;
}): TrainerRouteScope => {
  const scope = resolveProfileRouteScope(params);
  return scope === "coord" ? "coord" : "prof";
};

export type TrainerScopedRoutes = {
  scope: TrainerRouteScope;
  home: "/prof/home" | "/coord/dashboard";
  classes: "/prof/classes" | "/coord/classes";
  students: "/prof/students" | "/coord/students";
  assistant: "/prof/assistant" | "/coord/assistant";
  profile: "/prof/profile" | "/coord/profile";
  planning: "/prof/planning" | "/coord/planning";
  periodization: "/prof/periodization" | "/coord/periodization";
  reports: "/prof/classes" | "/coord/management";
  nfcAttendance: "/prof/nfc-attendance" | "/coord/nfc-attendance";
  events: "/prof/calendar" | "/coord/events";
};

export const getTrainerScopedRoutes = (
  scope: TrainerRouteScope,
): TrainerScopedRoutes =>
  scope === "coord"
    ? {
        scope,
        home: "/coord/dashboard",
        classes: "/coord/classes",
        students: "/coord/students",
        assistant: "/coord/assistant",
        profile: "/coord/profile",
        planning: "/coord/planning",
        periodization: "/coord/periodization",
        reports: "/coord/management",
        nfcAttendance: "/coord/nfc-attendance",
        events: "/coord/events",
      }
    : {
        scope,
        home: "/prof/home",
        classes: "/prof/classes",
        students: "/prof/students",
        assistant: "/prof/assistant",
        profile: "/prof/profile",
        planning: "/prof/planning",
        periodization: "/prof/periodization",
        reports: "/prof/classes",
        nfcAttendance: "/prof/nfc-attendance",
        events: "/prof/calendar",
      };
