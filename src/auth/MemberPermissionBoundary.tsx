import { useRouter } from "expo-router";
import { useEffect, type ReactNode } from "react";

import type { MemberPermissionKey } from "../api/members";
import { useOrganization } from "../providers/OrganizationProvider";

type MemberPermissionBoundaryProps = {
  children: ReactNode;
  permissionKey: MemberPermissionKey;
  redirectTo: "/prof/home" | "/coord/dashboard";
};

export function MemberPermissionBoundary({
  children,
  permissionKey,
  redirectTo,
}: MemberPermissionBoundaryProps) {
  const router = useRouter();
  const {
    activeOrganization,
    memberPermissions,
    permissionsLoading,
  } = useOrganization();
  const isOrgAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const blocked = !isOrgAdmin && memberPermissions[permissionKey] === false;

  useEffect(() => {
    if (!permissionsLoading && blocked) {
      router.replace(redirectTo);
    }
  }, [blocked, permissionsLoading, redirectTo, router]);

  if (permissionsLoading || blocked) return null;
  return children;
}
