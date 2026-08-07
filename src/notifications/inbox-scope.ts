import type { EffectiveProfile } from "../core/effective-profile";

export type NotificationInboxScope = "prof" | "coord" | "student" | "all";

export const notificationScopeForEffectiveProfile = (
  profile: EffectiveProfile,
): Exclude<NotificationInboxScope, "all"> => {
  if (profile === "admin") return "coord";
  if (profile === "student") return "student";
  return "prof";
};

export const resolveNotificationInboxScope = ({
  pathname,
  effectiveProfile,
}: {
  pathname?: string | null;
  effectiveProfile: EffectiveProfile;
}): Exclude<NotificationInboxScope, "all"> => {
  const path = String(pathname ?? "").trim();
  if (path === "/coord" || path.startsWith("/coord/")) return "coord";
  if (path === "/prof" || path.startsWith("/prof/")) return "prof";
  if (path === "/student" || path.startsWith("/student/")) return "student";
  return notificationScopeForEffectiveProfile(effectiveProfile);
};

export const notificationInboxFilter = (scope: NotificationInboxScope) =>
  scope === "all" ? "inbox_scope=eq.all" : `inbox_scope=in.(${scope},all)`;
