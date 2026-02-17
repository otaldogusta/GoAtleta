import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AdminPendingAttendance,
  AdminPendingSessionLogs,
  AdminRecentActivity,
  listAdminPendingAttendance,
  listAdminPendingSessionLogs,
  listAdminRecentActivity,
} from "../../src/api/reports";
import { useOrganization } from "../../src/providers/OrganizationProvider";
import { useAppTheme } from "../../src/ui/app-theme";
import { Pressable } from "../../src/ui/Pressable";
import { ShimmerBlock } from "../../src/ui/Shimmer";
import TrainerReportsScreen from "./trainer";

type DashboardTab = "attendance" | "session" | "activity";

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
];

export default function ReportsScreen() {
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
      const [attendanceRows, sessionRows, activityRows] = await Promise.all([
        listAdminPendingAttendance({ organizationId }),
        listAdminPendingSessionLogs({ organizationId }),
        listAdminRecentActivity({ organizationId, limit: 50 }),
      ]);
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

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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
    const activeClasses = new Set([
      ...pendingAttendance.map((item) => item.classId),
      ...pendingSessions.map((item) => item.classId),
      ...recentActivity.map((item) => item.classId),
    ]).size;
    return {
      attendancePending,
      sessionPending,
      recentActions,
      activeClasses,
    };
  }, [pendingAttendance, pendingSessions, recentActivity]);

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
                  params: { id: session.classId, tab: "relatório", date: todayDateKey },
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
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800" }}>
          Dashboard de Coordenação
        </Text>
        <Text style={{ color: colors.muted }}>
          Pendências e atividade recente da organização{" "}
          {activeOrganization?.name ? `• ${activeOrganization.name}` : ""}
        </Text>
      </View>

      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: 8,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {tabItems.map((item) => {
            const selected = tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: selected ? colors.primaryBg : colors.secondaryBg,
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

        <Pressable
          onPress={() => void loadDashboard()}
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 10,
            paddingVertical: 6,
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

  if (!isAdmin) return <TrainerReportsScreen />;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: 16, gap: 12 }}>
          {header}
          <View style={{ gap: 10 }}>
            <ShimmerBlock style={{ height: 98, borderRadius: 16 }} />
            <ShimmerBlock style={{ height: 98, borderRadius: 16 }} />
            <ShimmerBlock style={{ height: 98, borderRadius: 16 }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={listItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        initialNumToRender={8}
        windowSize={9}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={60}
        removeClippedSubviews={Platform.OS === "android"}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        ListHeaderComponent={header}
        ListEmptyComponent={
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
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </SafeAreaView>
  );
}
