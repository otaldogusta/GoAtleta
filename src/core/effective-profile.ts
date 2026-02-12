import { useMemo } from "react";

import type { UserRole } from "../auth/role";
import { useRole } from "../auth/role";
import { useOrganization } from "../providers/OrganizationProvider";

export type EffectiveProfile = "student" | "professor" | "admin";

export const resolveEffectiveProfile = (params: {
  role: UserRole | null;
  orgRoleLevel?: number | null;
}): EffectiveProfile => {
  const role = params.role;
  const orgRoleLevel = params.orgRoleLevel ?? 0;

  if (role === "student") return "student";
  if (role === "trainer" && orgRoleLevel >= 50) return "admin";
  return "professor";
};

export const useEffectiveProfile = (): EffectiveProfile => {
  const { role } = useRole();
  const { activeOrganization } = useOrganization();

  return useMemo(
    () =>
      resolveEffectiveProfile({
        role,
        orgRoleLevel: activeOrganization?.role_level,
      }),
    [role, activeOrganization?.role_level]
  );
};
