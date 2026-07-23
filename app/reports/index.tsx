import { useRouter } from "expo-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    AdminPendingAttendance,
    AdminPendingSessionLogs,
    AdminRecentActivity,
    listAdminPendingAttendance,
    listAdminPendingSessionLogs,
    listAdminRecentActivity,
} from "../../src/api/reports";
import { ScreenPageHeader } from "../../src/components/ui/ScreenPageHeader";
import { markRender, measureAsync } from "../../src/observability/perf";
import { useOrganization } from "../../src/providers/OrganizationProvider";
import { useAppTheme } from "../../src/ui/app-theme";
import { Pressable } from "../../src/ui/Pressable";
import { ShimmerBlock } from "../../src/ui/Shimmer";
import { ScreenLoadingState } from "../../src/components/ui/ScreenLoadingState";
import type { ActivityCatalogAuditReport } from "../../src/core/volleyball/activity-catalog-audit";
import { navigateBackOrReplace } from "../../src/navigation/safe-router";

type DashboardTab = "attendance" | "session" | "activity" | "catalog";

type DashboardListItem =
  | { id: string; kind: "attendance"; value: AdminPendingAttendance }
  | { id: string; kind: "session"; value: AdminPendingSessionLogs }
  | { id: string; kind: "activity"; value: AdminRecentActivity };

const formatDateKey = (value: Date) => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDateBr = (value: string | null | undefined) => {
  if (!value) return "-";
  const datePart = value.includes("T") ? value.split("T")[0] : value;
  const parts = datePart.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const formatDateTimeBr = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const shortUserId = (value: string | null | undefined) => {
  if (!value) return "Sistema";
  return value.length > 8 ? `${value.slice(0, 8)}...` : value;
};

const tabItems: { id: DashboardTab; label: string }[] = [
  { id: "attendance", label: "Chamada pendente" },
  { id: "session", label: "Relatórios pendentes" },
  { id: "activity", label: "Atividade" },
  { id: "catalog", label: "Catálogo" },
];

const LazyTrainerReportsScreen = lazy(() => import("./trainer"));
const LazyCatalogAuditPanel = lazy(() =>
  import("../../src/screens/reports/CatalogAuditPanel").then((module) => ({
    default: module.CatalogAuditPanel,
  }))
);
const styles = StyleSheet.create({
  catalogAuditFallback: {
    height: 180,
    borderRadius: 16,
  },
});

export default function ReportsScreen() {
  markRender("screen.reportsAdmin.render.root");

  const router = useRouter();
  const { colors } = useAppTheme();
  const { activeOrganization } = useOrganization();
  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const todayDateKey = useMemo(() => formatDateKey(new Date()), []);

  const [tab, setTab] = useState<DashboardTab>("attendance");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAttendance, setPendingAttendance] = useState<AdminPendingAttendance[]>([]);
  const [pendingSessions, setPendingSessions] = useState<AdminPendingSessionLogs[]>([]);
  const [recentActivity, setRecentActivity] = useState<AdminRecentActivity[]>([]);
  const [catalogAuditReport, setCatalogAuditReport] = useState<ActivityCatalogAuditReport | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const catalogRequestedOrgIdRef = useRef<string | null>(null);

  const loadDashboard = useCallback(async () => {
    const organizationId = activeOrganization?.id;
    if (!organizationId || !isAdmin) {
      setPendingAttendance([]);
      setPendingSessions([]);
      setRecentActivity([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [attendanceRows, sessionRows, activityRows] = await measureAsync(
        "screen.reportsAdmin.load.dashboard",
        () =>
          Promise.all([
            listAdminPendingAttendance({ organizationId }),
            listAdminPendingSessionLogs({ organizationId }),
            listAdminRecentActivity({ organizationId, limit: 50 }),
          ]),
        { screen: "reportsAdmin", organizationId }
      );
      setPendingAttendance(attendanceRows);
      setPendingSessions(sessionRows);
      setRecentActivity(activityRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar dashboard.");
      setPendingAttendance([]);
      setPendingSessions([]);
      setRecentActivity([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrganization?.id, isAdmin]);

  const loadCatalogAudit = useCallback(
    async (force = false) => {
      const organizationId = activeOrganization?.id;
      if (!organizationId || !isAdmin) {
        setCatalogAuditReport(null);
        setCatalogError(null);
        setCatalogLoading(false);
        return;
      }
      if (!force && catalogRequestedOrgIdRef.current === organizationId) return;

      catalogRequestedOrgIdRef.current = organizationId;
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const [{ buildActivityCatalogAuditReport }, { getTrainingPlans }] = await Promise.all([
          import("../../src/core/volleyball/activity-catalog-audit"),
          import("../../src/db/seed"),
        ]);
        const trainingPlans = await measureAsync(
          "screen.reportsAdmin.load.catalog",
          () =>
            getTrainingPlans({
              organizationId,
              status: "final",
              orderBy: "createdat_desc",
              limit: 300,
            }),
          { screen: "reportsAdmin", organizationId }
        );
        if (catalogRequestedOrgIdRef.current !== organizationId) return;
        setCatalogAuditReport(buildActivityCatalogAuditReport(trainingPlans));
      } catch (err) {
        if (catalogRequestedOrgIdRef.current !== organizationId) return;
        setCatalogAuditReport(null);
        setCatalogError(err instanceof Error ? err.message : "Falha ao carregar auditoria.");
      } finally {
        if (catalogRequestedOrgIdRef.current === organizationId) {
          setCatalogLoading(false);
        }
      }
    },
    [activeOrganization?.id, isAdmin]
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    catalogRequestedOrgIdRef.current = null;
    setCatalogAuditReport(null);
    setCatalogError(null);
    setCatalogLoading(false);
  }, [activeOrganization?.id]);

  useEffect(() => {
    if (tab === "catalog") {
      void loadCatalogAudit();
    }
  }, [loadCatalogAudit, tab]);

  const reloadVisibleData = useCallback(() => {
    void loadDashboard();
    if (tab === "catalog") {
      void loadCatalogAudit(true);
    }
  }, [loadCatalogAudit, loadDashboard, tab]);

  const listItems = useMemo<DashboardListItem[]>(() => {
    if (tab === "attendance") {
      return pendingAttendance.map((item) => ({
        id: `${item.classId}_${item.targetDate}`,
        kind: "attendance",
        value: item,
      }));
    }
    if (tab === "session") {
      return pendingSessions.map((item) => ({
        id: `${item.classId}_${item.periodStart}`,
        kind: "session",
        value: item,
      }));
    }
    if (tab === "catalog") {
      return [];
    }
    return recentActivity.map((item, index) => ({
      id: `${item.kind}_${item.classId}_${item.occurredAt}_${index}`,
      kind: "activity",
      value: item,
    }));
  }, [pendingAttendance, pendingSessions, recentActivity, tab]);

  const emptyState = useMemo(() => {
    if (tab === "attendance") {
      return {
        title: "Tudo em dia",
        text: "Nenhuma turma com chamada pendente hoje.",
      };
    }
    if (tab === "session") {
      return {
        title: "Tudo em dia",
        text: "Nenhuma turma sem relatório nos últimos 7 dias.",
      };
    }
    return {
      title: "Tudo em dia",
      text: "Sem atividade nos últimos 7 dias.",
    };
  }, [tab]);

  const executiveSummary = useMemo(() => {
    const attendancePending = pendingAttendance.length;
    const sessionPending = pendingSessions.length;
    const recentActions = recentActivity.length;
    const catalogUses = catalogAuditReport?.usage.totalCatalogActivitiesUsed ?? 0;
    const catalogUnknownReferences =
      catalogAuditReport?.usage.unknownCatalogReferences.length ?? 0;
    const activeClasses = new Set([
      ...pendingAttendance.map((item) => item.classId),
      ...pendingSessions.map((item) => item.classId),
      ...recentActivity.map((item) => item.classId),
    ]).size;
    return {
      attendancePending,
      sessionPending,
      recentActions,
      catalogUses,
      catalogUnknownReferences,
      activeClasses,
    };
  }, [catalogAuditReport, pendingAttendance, pendingSessions, recentActivity]);

  const renderItem = useCallback(
    ({ item }: { item: DashboardListItem }) => {
      if (item.kind === "attendance") {
        const attendance = item.value;
        return (
          <View
            style={{
              padding: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              {attendance.className}
            </Text>
            <Text style={{ color: colors.muted }}>
              Unidade: {attendance.unit || "-"} • Alunos: {attendance.studentCount}
            </Text>
            <Text style={{ color: colors.muted }}>
              Data alvo: {formatDateBr(attendance.targetDate)}
            </Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/class/[id]/attendance",
                  params: { id: attendance.classId, date: attendance.targetDate || todayDateKey },
                })
              }
              style={{
                alignSelf: "flex-start",
                marginTop: 4,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Fazer chamada</Text>
            </Pressable>
          </View>
        );
      }

      if (item.kind === "session") {
        const session = item.value;
        return (
          <View
            style={{
              padding: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              {session.className}
            </Text>
            <Text style={{ color: colors.muted }}>Unidade: {session.unit || "-"}</Text>
            <Text style={{ color: colors.muted }}>
              Último relatório: {session.lastReportAt ? formatDateTimeBr(session.lastReportAt) : "nunca"}
            </Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/class/[id]/session",
                  params: { id: session.classId, tab: "relatório", date: session.suggestedDate },
                })
              }
              style={{
                alignSelf: "flex-start",
                marginTop: 4,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Criar relatório</Text>
            </Pressable>
          </View>
        );
      }

      const activity = item.value;
      return (
        <View
          style={{
            padding: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            gap: 6,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "800" }}>
            {activity.kind === "attendance" ? "Chamada" : "Relatório"} • {activity.className}
          </Text>
          <Text style={{ color: colors.muted }}>
            Unidade: {activity.unit || "-"} • Em: {formatDateTimeBr(activity.occurredAt)}
          </Text>
          <Text style={{ color: colors.muted }}>
            Responsável: {shortUserId(activity.actorUserId)} • Registros: {activity.affectedRows}
          </Text>
          {activity.referenceDate ? (
            <Text style={{ color: colors.muted }}>
              Referência: {formatDateBr(activity.referenceDate)}
            </Text>
          ) : null}
        </View>
      );
    },
    [colors, router, todayDateKey]
  );

  const header = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <View style={{ gap: 8 }}>
        <View
          style={{
            flexDirection: "row",
            gap: 6,
            flexWrap: "wrap",
            borderRadius: 999,
            backgroundColor: colors.secondaryBg,
            padding: 6,
          }}
        >
          {tabItems.map((item) => {
            const selected = tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                style={{
                  flexGrow: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: selected ? colors.primaryBg : colors.card,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: selected ? colors.primaryText : colors.text,
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

      </View>

      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: 12,
          gap: 8,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
          Resumo executivo
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
              Chamada pendente: {executiveSummary.attendancePending}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
              Relatórios pendentes: {executiveSummary.sessionPending}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
              Atividade recente: {executiveSummary.recentActions}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
              Catálogo usado: {executiveSummary.catalogUses}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
              Referências pendentes: {executiveSummary.catalogUnknownReferences}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
              Turmas em foco: {executiveSummary.activeClasses}
            </Text>
          </View>
        </View>
      </View>

      {error ? (
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 12,
          }}
        >
          <Text style={{ color: colors.dangerSolidBg, fontWeight: "700" }}>Erro</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>{error}</Text>
        </View>
      ) : null}
    </View>
  );

  if (!isAdmin) {
    return (
      <Suspense fallback={<ScreenLoadingState />}>
        <LazyTrainerReportsScreen />
      </Suspense>
    );
  }

  if (loading) {
    return <ScreenLoadingState />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenPageHeader
        title="Painel de Coordenação"
        subtitle={`Pendências e atividade recente da organização${activeOrganization?.name ? ` • ${activeOrganization.name}` : ""}`}
        onBack={() => navigateBackOrReplace({ router, fallback: "/coord/dashboard" })}
        right={
          <Pressable
            onPress={reloadVisibleData}
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
              Recarregar
            </Text>
          </Pressable>
        }
      />
      <FlatList
        data={listItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        initialNumToRender={8}
        windowSize={9}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={60}
        removeClippedSubviews={Platform.OS === "android"}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28 }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          tab === "catalog" ? (
            <Suspense fallback={<ShimmerBlock style={styles.catalogAuditFallback} />}>
              <LazyCatalogAuditPanel
                report={catalogAuditReport}
                loading={catalogLoading}
                error={catalogError}
                onRefresh={() => void loadCatalogAudit(true)}
              />
            </Suspense>
          ) : (
            <View
              style={{
                padding: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>{emptyState.title}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>{emptyState.text}</Text>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </SafeAreaView>
  );
}
