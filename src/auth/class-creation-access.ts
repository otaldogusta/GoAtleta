import type { MemberPermissionKey } from "../api/members";

export const canCreateClasses = ({
  organizationId,
  roleLevel,
  memberPermissions,
  permissionsLoading,
}: {
  organizationId?: string | null;
  roleLevel?: number | null;
  memberPermissions: Partial<Record<MemberPermissionKey, boolean>>;
  permissionsLoading: boolean;
}) => Boolean(
  organizationId && (
    (roleLevel ?? 0) >= 50 || (
      !permissionsLoading &&
      memberPermissions.classes === true &&
      memberPermissions.classes_create === true
    )
  )
);
