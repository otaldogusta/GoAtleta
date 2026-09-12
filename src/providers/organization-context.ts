import { createContext, useContext } from "react";

import type { MemberPermissionKey } from "../api/members";
import type { DevProfilePreview } from "../dev/profile-preview";

export type Organization = {
  id: string;
  name: string;
  role_level: number;
  created_at: string;
  timezone?: string | null;
};

export type OrganizationContextValue = {
  organizations: Organization[];
  activeOrganizationId: string | null;
  activeOrganization: Organization | null;
  isLoading: boolean;
  setActiveOrganizationId: (orgId: string | null) => Promise<void>;
  fetchOrganizations: () => Promise<void>;
  createOrganization: (name: string) => Promise<string>;
  devProfilePreview: DevProfilePreview;
  setDevProfilePreview: (preview: DevProfilePreview) => Promise<void>;
  memberPermissions: Partial<Record<MemberPermissionKey, boolean>>;
  permissionsLoading: boolean;
  refreshMemberPermissions: () => Promise<void>;
};

export const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error("useOrganization must be used within OrganizationProvider");
  }
  return context;
}

export function useOptionalOrganization() {
  return useContext(OrganizationContext);
}
