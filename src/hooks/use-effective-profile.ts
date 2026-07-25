import { useMemo } from "react";

import { useRole } from "../auth/role";
import { useOptionalOrganization } from "../providers/OrganizationProvider";
import { resolveEffectiveProfile, type EffectiveProfile } from "../core/effective-profile";

export function useEffectiveProfile(): EffectiveProfile {
  const { role, devProfilePreview } = useRole();
  const activeOrganization = useOptionalOrganization()?.activeOrganization ?? null;

  return useMemo(() => {
    if (devProfilePreview === "admin") return "admin";
    if (devProfilePreview === "professor") return "professor";
    if (devProfilePreview === "student") return "student";
    return resolveEffectiveProfile({
      role,
      orgRoleLevel: activeOrganization?.role_level,
    });
  }, [role, activeOrganization?.role_level, devProfilePreview]);
}
