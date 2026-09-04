import { useMemo } from "react";

import { useRole } from "../auth/role";
import { useAuth } from "../auth/auth";
import { canUseProfilePreview } from "../dev/profile-preview-access";
import { useOptionalOrganization } from "../providers/OrganizationProvider";
import { resolveEffectiveProfile, type EffectiveProfile } from "../core/effective-profile";

export function useEffectiveProfile(): EffectiveProfile {
  const { role, devProfilePreview } = useRole();
  const { session } = useAuth();
  const preview = canUseProfilePreview(session?.user?.email) ? devProfilePreview : "auto";
  const activeOrganization = useOptionalOrganization()?.activeOrganization ?? null;

  return useMemo(() => {
    if (preview === "admin") return "admin";
    if (preview === "professor") return "professor";
    if (preview === "student") return "student";
    return resolveEffectiveProfile({
      role,
      orgRoleLevel: activeOrganization?.role_level,
    });
  }, [role, activeOrganization?.role_level, preview]);
}
