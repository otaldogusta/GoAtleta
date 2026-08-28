import type { EffectiveProfile } from "../core/effective-profile";
import type { NotificationInboxScope } from "./inbox-scope";

const normalizeOrganizationId = (value?: string | null) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

export const resolveNotificationOrganizationId = ({
  activeOrganizationId,
  studentOrganizationId,
  inboxScope,
  effectiveProfile,
}: {
  activeOrganizationId?: string | null;
  studentOrganizationId?: string | null;
  inboxScope?: NotificationInboxScope | null;
  effectiveProfile?: EffectiveProfile | null;
}) => {
  const activeOrganization = normalizeOrganizationId(activeOrganizationId);
  const studentOrganization = normalizeOrganizationId(studentOrganizationId);
  const prefersStudentOrganization =
    inboxScope === "student" || effectiveProfile === "student";

  return prefersStudentOrganization
    ? studentOrganization ?? activeOrganization
    : activeOrganization ?? studentOrganization;
};
