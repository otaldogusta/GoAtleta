import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Platform } from "react-native";
import { useRenderDiagnostic } from "../dev/useRenderDiagnostic";

import { clearAiCache } from "../api/ai";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import {
    getMyMemberPermissions,
    type MemberPermissionKey,
} from "../api/members";
import { useAuth } from "../auth/auth";
import { forceRefreshAccessToken } from "../auth/session";
import { smartSync } from "../core/smart-sync";
import { clearLocalReadCaches } from "../db/seed";
import {
    getDevProfilePreview,
    setDevProfilePreview as persistDevProfilePreview,
    type DevProfilePreview,
} from "../dev/profile-preview";

const ACTIVE_ORG_KEY = "active-org-id";

const createAbortError = () => {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
};

const postSupabaseRpc = async ({
  path,
  token,
  signal,
  body,
}: {
  path: string;
  token: string;
  signal?: AbortSignal;
  body?: string;
}) => {
  const url = `${SUPABASE_URL}/rest/v1/rpc/${path}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    return await fetch(url, {
      method: "POST",
      headers,
      body,
      signal,
    });
  } catch (error) {
    const shouldFallbackToXhr =
      Platform.OS === "web" &&
      typeof XMLHttpRequest !== "undefined" &&
      error instanceof TypeError;

    if (!shouldFallbackToXhr) {
      throw error;
    }

    return await new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      const cleanup = () => {
        if (signal) {
          signal.removeEventListener("abort", handleAbort);
        }
      };

      const handleAbort = () => {
        cleanup();
        xhr.abort();
        reject(createAbortError());
      };

      xhr.open("POST", url, true);
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.onload = () => {
        cleanup();
        resolve(
          new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: {
              "Content-Type": xhr.getResponseHeader("content-type") || "application/json",
            },
          })
        );
      };

      xhr.onerror = () => {
        cleanup();
        reject(new TypeError("Network request failed"));
      };

      xhr.onabort = () => {
        cleanup();
        reject(createAbortError());
      };

      if (signal) {
        if (signal.aborted) {
          handleAbort();
          return;
        }
        signal.addEventListener("abort", handleAbort, { once: true });
      }

      xhr.send(body);
    });
  }
};

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
  const hasLoadedOrganizationsRef = useRef(false);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const permissionsInFlightRef = useRef<Promise<void> | null>(null);
  const permissionsRequestKeyRef = useRef("");
  const lastFetchTokenRef = useRef("");
  const lastFetchErrorAtRef = useRef(0);

  useRenderDiagnostic("OrganizationProvider", {
    activeOrganizationId,
    isLoading,
    permissionsLoading,
    "organizations.length": organizations.length,
    sessionUserId: session?.user?.id ?? null,
  });

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
    const userId = session?.user?.id ?? "";
    const organizationId = activeOrganizationId ?? "";
    if (!userId || !organizationId) {
      permissionsRequestKeyRef.current = "";
      setMemberPermissions({});
      setPermissionsLoading(false);
      return;
    }

    const requestKey = `${userId}:${organizationId}`;
    if (permissionsInFlightRef.current && permissionsRequestKeyRef.current === requestKey) {
      await permissionsInFlightRef.current;
      return;
    }

    permissionsRequestKeyRef.current = requestKey;

    let requestPromise: Promise<void> = Promise.resolve();
    requestPromise = (async () => {
      setPermissionsLoading(true);
      try {
        const rows = await getMyMemberPermissions(organizationId);
        if (permissionsRequestKeyRef.current !== requestKey) return;

        const mapped: Partial<Record<MemberPermissionKey, boolean>> = {};
        rows.forEach((row) => {
          mapped[row.permissionKey] = row.isAllowed;
        });
        setMemberPermissions(mapped);
      } catch (err) {
        if (permissionsRequestKeyRef.current !== requestKey) return;
        console.error("OrganizationProvider permissions error:", err);
        setMemberPermissions({});
      } finally {
        if (permissionsInFlightRef.current === requestPromise) {
          permissionsInFlightRef.current = null;
        }
        if (permissionsRequestKeyRef.current === requestKey) {
          setPermissionsLoading(false);
        }
      }
    })();

    permissionsInFlightRef.current = requestPromise;
    await requestPromise;
  }, [activeOrganizationId, session]);

  useEffect(() => {
    if (!session || !activeOrganizationId) {
      setMemberPermissions({});
      setPermissionsLoading(false);
      return;
    }

    // Clear stale permissions from previous org/profile before fresh load.
    setMemberPermissions({});
    setPermissionsLoading(true);
  }, [activeOrganizationId, session?.user?.id]);

  const fetchOrganizations = useCallback(async () => {
    const accessToken = session?.access_token ?? "";
    if (!accessToken) {
      fetchControllerRef.current = null;
      lastFetchTokenRef.current = "";
      lastFetchErrorAtRef.current = 0;
      setOrganizations([]);
      setActiveOrgId(null);
      clearAiCache();
      hasLoadedOrganizationsRef.current = false;
      setIsLoading(false);
      return;
    }

    if (fetchControllerRef.current && !fetchControllerRef.current.signal.aborted) {
      return;
    }

    const now = Date.now();
    const sameToken = lastFetchTokenRef.current === accessToken;
    const isCoolingDown =
      sameToken &&
      lastFetchErrorAtRef.current > 0 &&
      now - lastFetchErrorAtRef.current < 2500;
    if (isCoolingDown) {
      return;
    }
    lastFetchTokenRef.current = accessToken;

    const isFirstLoad = !hasLoadedOrganizationsRef.current;
    if (isFirstLoad) {
      setIsLoading(true);
    }

    const controller = new AbortController();
    fetchControllerRef.current = controller;

    try {
      const fetchOrganizationsWithToken = async (token: string) =>
        postSupabaseRpc({
          path: "get_my_organizations",
          token,
          signal: controller.signal,
        });

      let res = await fetchOrganizationsWithToken(accessToken);
      if (res.status === 401) {
        const refreshed = await forceRefreshAccessToken();
        if (refreshed) {
          res = await fetchOrganizationsWithToken(refreshed);
        }
      }

      if (!res.ok) {
        const details = await res.text();
        const reason = details?.trim() || `status ${res.status}`;
        throw new Error(`Failed to fetch organizations: ${reason}`);
      }

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
      hasLoadedOrganizationsRef.current = true;
      lastFetchErrorAtRef.current = 0;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      console.error("OrganizationProvider fetch error:", err);
      if (isFirstLoad) {
        setOrganizations([]);
        setActiveOrgId(null);
      }
      hasLoadedOrganizationsRef.current = true;
      lastFetchErrorAtRef.current = Date.now();
    } finally {
      if (fetchControllerRef.current === controller) {
        fetchControllerRef.current = null;
      }
      if (isFirstLoad) {
        setIsLoading(false);
      }
    }
  }, [session?.access_token]);

  const setActiveOrganizationId = useCallback(async (orgId: string | null) => {
    if (orgId === activeOrganizationId) return;
    smartSync.handleOrganizationSwitch();
    clearAiCache();
    await clearLocalReadCaches();
    if (orgId) {
      await AsyncStorage.setItem(ACTIVE_ORG_KEY, orgId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_ORG_KEY);
    }
    setActiveOrgId(orgId);
    smartSync.resumeSync();
  }, [activeOrganizationId]);

  const createOrganization = useCallback(
    async (name: string): Promise<string> => {
      if (!session?.access_token) throw new Error("Not authenticated");

      const res = await postSupabaseRpc({
        path: "create_organization_with_admin",
        token: session.access_token,
        body: JSON.stringify({ org_name: name }),
      });

      if (!res.ok) throw new Error("Failed to create organization");

      const orgId = (await res.json()) as string;
      await fetchOrganizations();
      await setActiveOrganizationId(orgId);
      return orgId;
    },
    [session?.access_token, fetchOrganizations, setActiveOrganizationId]
  );

  useEffect(() => {
    void fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    return () => {
      fetchControllerRef.current?.abort();
      fetchControllerRef.current = null;
    };
  }, []);

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

export function useOptionalOrganization() {
  return useContext(OrganizationContext);
}
