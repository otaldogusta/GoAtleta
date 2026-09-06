import { useCallback, useEffect, useRef, useState } from "react";
import { measureAsync } from "../../../observability/perf";
import { getFriendlyErrorMessage } from "../../../ui/error-messages";
import {
  loadCoordinationDashboard,
  loadCoordinationInsights,
  type CoordinationDashboardData,
  type CoordinationInsights,
} from "../application/load-coordination-dashboard";

const emptyInsights: CoordinationInsights = { recentActivity: [], signals: [], classRadarItems: [] };
const emptyData: CoordinationDashboardData = {
  classes: [], pendingAttendance: [], pendingReports: [], failedWrites: [],
  organizationMembers: [], memberClassHeads: [], organizationClasses: [],
  pendingTrainerInvites: [], pendingAccessRequests: [],
  pendingWritesDiagnostics: { total: 0, highRetry: 0, maxRetry: 0, deadLetterCandidates: 0, deadLetterStored: 0 },
};

type DashboardState = {
  scopeKey: string;
  data: CoordinationDashboardData;
  insights: CoordinationInsights;
  loading: boolean;
  refreshing: boolean;
  loadedOrganizationId: string | null;
  error: string | null;
};

type DashboardScope = {
  userId: string | null;
  organizationId: string | null;
  enabled: boolean;
};

export function useCoordinationDashboard({ userId, organizationId, enabled }: DashboardScope) {
  const canLoad = enabled && Boolean(userId && organizationId);
  const scopeKey = JSON.stringify([userId, organizationId, canLoad]);
  const [state, setState] = useState<DashboardState | null>(null);
  const requestRef = useRef(0);
  const activeScopeRef = useRef<string | null>(null);

  useEffect(() => {
    activeScopeRef.current = scopeKey;
    return () => {
      activeScopeRef.current = null;
      requestRef.current += 1;
    };
  }, [scopeKey]);

  const loadDashboard = useCallback(async (refreshing = false) => {
    if (!canLoad || !organizationId || activeScopeRef.current !== scopeKey) return;
    const requestId = ++requestRef.current;
    const isCurrent = () => activeScopeRef.current === scopeKey && requestRef.current === requestId;
    setState((current) => ({
      scopeKey,
      data: current?.scopeKey === scopeKey ? current.data : emptyData,
      insights: emptyInsights,
      loadedOrganizationId: current?.scopeKey === scopeKey ? current.loadedOrganizationId : null,
      loading: true, refreshing, error: null,
    }));

    try {
      const data = await measureAsync(
        "screen.coordination.load.dashboard",
        () => loadCoordinationDashboard(organizationId),
        { screen: "coordination", organizationId },
      );
      if (!isCurrent()) return;
      setState({ scopeKey, data, insights: emptyInsights, loading: false,
        refreshing: false, loadedOrganizationId: organizationId, error: null });

      void loadCoordinationInsights(organizationId, data.classes).then((insights) => {
        if (!isCurrent()) return;
        setState((current) => current?.scopeKey === scopeKey ? { ...current, insights } : current);
      }).catch(() => {
        // The operational snapshot stays usable when optional intelligence fails.
      });
    } catch (error) {
      if (!isCurrent()) return;
      setState({ scopeKey, data: emptyData, insights: emptyInsights, loading: false,
        refreshing: false, loadedOrganizationId: organizationId,
        error: getFriendlyErrorMessage(error, "Falha ao carregar dados da coordenação.") });
    }
  }, [canLoad, organizationId, scopeKey]);

  const refreshDashboard = useCallback(() => loadDashboard(true), [loadDashboard]);
  const visible = canLoad && state?.scopeKey === scopeKey ? state : null;
  return {
    ...(visible?.data ?? emptyData),
    ...(visible?.insights ?? emptyInsights),
    loading: canLoad && (visible?.loading ?? true),
    refreshing: visible?.refreshing ?? false,
    loadedOrganizationId: visible?.loadedOrganizationId ?? null,
    error: visible?.error ?? null,
    loadDashboard,
    refreshDashboard,
  };
}
