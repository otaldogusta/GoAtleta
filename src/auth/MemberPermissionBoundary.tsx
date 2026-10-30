import { useRouter } from "expo-router";
import { useEffect, type ReactNode } from "react";

import type { MemberPermissionKey } from "../api/members";
import { FullscreenLoadingState } from "../components/ui/FullscreenLoadingState";
import { useOrganization } from "../providers/organization-context";

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
    isLoading: organizationLoading,
    permissionsLoading,
  } = useOrganization();
  const isOrgAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const blocked = !isOrgAdmin && memberPermissions[permissionKey] !== true;

  useEffect(() => {
    if (!organizationLoading && !permissionsLoading && blocked) {
      router.replace(redirectTo);
    }
  }, [blocked, organizationLoading, permissionsLoading, redirectTo, router]);

  if (organizationLoading || permissionsLoading || blocked) return <FullscreenLoadingState />;
  return children;
}
