import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import {
  getMyMemberPermissions,
  type MemberPermissionKey,
} from "../api/members";
import {
  getDevProfilePreview,
  setDevProfilePreview as persistDevProfilePreview,
  type DevProfilePreview,
} from "../dev/profile-preview";
import { useAuth } from "../auth/auth";

const ACTIVE_ORG_KEY = "active-org-id";

type Organization = {
  id: string;
  name: string;
  role_level: number;
  created_at: string;
};

type OrganizationContextValue = {
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

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganizationId, setActiveOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [devProfilePreview, setDevProfilePreviewState] = useState<DevProfilePreview>("auto");
  const [memberPermissions, setMemberPermissions] = useState<
    Partial<Record<MemberPermissionKey, boolean>>
  >({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const preview = await getDevProfilePreview();
        if (!alive) return;
        setDevProfilePreviewState(preview);
      } catch {
        if (!alive) return;
        setDevProfilePreviewState("auto");
      }
    })();
    return () => {
      alive = false;
    };
  }, [session?.user?.id]);

  const setDevProfilePreview = useCallback(async (preview: DevProfilePreview) => {
    setDevProfilePreviewState(preview);
    await persistDevProfilePreview(preview);
  }, []);

  const refreshMemberPermissions = useCallback(async () => {
    if (!session || !activeOrganizationId) {
      setMemberPermissions({});
      setPermissionsLoading(false);
      return;
    }

    setPermissionsLoading(true);
    try {
      const rows = await getMyMemberPermissions(activeOrganizationId);
      const mapped: Partial<Record<MemberPermissionKey, boolean>> = {};
      rows.forEach((row) => {
        mapped[row.permissionKey] = row.isAllowed;
      });
      setMemberPermissions(mapped);
    } catch (err) {
      console.error("OrganizationProvider permissions error:", err);
      setMemberPermissions({});
    } finally {
      setPermissionsLoading(false);
    }
  }, [activeOrganizationId, session]);

  const fetchOrganizations = useCallback(async () => {
    if (!session?.access_token) {
      setOrganizations([]);
      setActiveOrgId(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_my_organizations`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error("Failed to fetch organizations");

      const data = (await res.json()) as Organization[];
      setOrganizations(data);

      if (data.length === 0) {
        await AsyncStorage.removeItem(ACTIVE_ORG_KEY);
        setActiveOrgId(null);
      } else if (data.length === 1) {
        const orgId = data[0].id;
        await AsyncStorage.setItem(ACTIVE_ORG_KEY, orgId);
        setActiveOrgId(orgId);
      } else {
        const saved = await AsyncStorage.getItem(ACTIVE_ORG_KEY);
        const validSaved = saved && data.some((o) => o.id === saved);
        const selected = validSaved ? saved : data[0].id;
        await AsyncStorage.setItem(ACTIVE_ORG_KEY, selected);
        setActiveOrgId(selected);
      }
    } catch (err) {
      console.error("OrganizationProvider fetch error:", err);
      setOrganizations([]);
      setActiveOrgId(null);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const setActiveOrganizationId = useCallback(async (orgId: string | null) => {
    if (orgId) {
      await AsyncStorage.setItem(ACTIVE_ORG_KEY, orgId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_ORG_KEY);
    }
    setActiveOrgId(orgId);
  }, []);

  const createOrganization = useCallback(
    async (name: string): Promise<string> => {
      if (!session?.access_token) throw new Error("Not authenticated");

      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_organization_with_admin`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ org_name: name }),
      });

      if (!res.ok) throw new Error("Failed to create organization");

      const orgId = (await res.json()) as string;
      await fetchOrganizations();
      await setActiveOrganizationId(orgId);
      return orgId;
    },
    [session, fetchOrganizations, setActiveOrganizationId]
  );

  useEffect(() => {
    void fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    void refreshMemberPermissions();
  }, [refreshMemberPermissions]);

  const activeOrganization = useMemo(() => {
    const org = organizations.find((o) => o.id === activeOrganizationId) ?? null;
    if (!org) return null;

    if (__DEV__ && devProfilePreview === "admin") {
      return { ...org, role_level: Math.max(org.role_level ?? 0, 50) };
    }
    if (__DEV__ && (devProfilePreview === "professor" || devProfilePreview === "student")) {
      return { ...org, role_level: Math.min(org.role_level ?? 0, 10) };
    }
    return org;
  }, [organizations, activeOrganizationId, devProfilePreview]);

  const value = useMemo(
    () => ({
      organizations,
      activeOrganizationId,
      activeOrganization,
      isLoading,
      setActiveOrganizationId,
      fetchOrganizations,
      createOrganization,
      devProfilePreview,
      setDevProfilePreview,
      memberPermissions,
      permissionsLoading,
      refreshMemberPermissions,
    }),
    [
      organizations,
      activeOrganizationId,
      activeOrganization,
      isLoading,
      setActiveOrganizationId,
      fetchOrganizations,
      createOrganization,
      devProfilePreview,
      setDevProfilePreview,
      memberPermissions,
      permissionsLoading,
      refreshMemberPermissions,
    ]
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
}
