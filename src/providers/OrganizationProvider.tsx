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
};

const OrganizationContext = createContext<OrganizationContextValue | null>(
  null
);

export function OrganizationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganizationId, setActiveOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user's organizations from Supabase RPC
  const fetchOrganizations = useCallback(async () => {
    if (!session?.access_token) {
      setOrganizations([]);
      setActiveOrgId(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/get_my_organizations`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        throw new Error("Failed to fetch organizations");
      }

      const data = (await res.json()) as Organization[];
      setOrganizations(data);

      // Auto-select logic
      if (data.length === 0) {
        // No orgs: clear active
        await AsyncStorage.removeItem(ACTIVE_ORG_KEY);
        setActiveOrgId(null);
      } else if (data.length === 1) {
        // Exactly 1 org: auto-select
        const orgId = data[0].id;
        await AsyncStorage.setItem(ACTIVE_ORG_KEY, orgId);
        setActiveOrgId(orgId);
      } else {
        // Multiple orgs: restore from storage or default to first
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

  // Set active organization and persist
  const setActiveOrganizationId = useCallback(
    async (orgId: string | null) => {
      if (orgId) {
        await AsyncStorage.setItem(ACTIVE_ORG_KEY, orgId);
      } else {
        await AsyncStorage.removeItem(ACTIVE_ORG_KEY);
      }
      setActiveOrgId(orgId);
    },
    []
  );

  // Create new organization (calls RPC create_organization_with_admin)
  const createOrganization = useCallback(
    async (name: string): Promise<string> => {
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/create_organization_with_admin`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ org_name: name }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to create organization");
      }

      const orgId = (await res.json()) as string;

      // Refetch organizations and auto-select new one
      await fetchOrganizations();
      await setActiveOrganizationId(orgId);

      return orgId;
    },
    [session, fetchOrganizations, setActiveOrganizationId]
  );

  // On mount or session change: fetch orgs
  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const activeOrganization = useMemo(
    () => organizations.find((o) => o.id === activeOrganizationId) ?? null,
    [organizations, activeOrganizationId]
  );

  const value = useMemo(
    () => ({
      organizations,
      activeOrganizationId,
      activeOrganization,
      isLoading,
      setActiveOrganizationId,
      fetchOrganizations,
      createOrganization,
    }),
    [
      organizations,
      activeOrganizationId,
      activeOrganization,
      isLoading,
      setActiveOrganizationId,
      fetchOrganizations,
      createOrganization,
    ]
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) {
    throw new Error(
      "useOrganization must be used within OrganizationProvider"
    );
  }
  return ctx;
}
