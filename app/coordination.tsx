import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AdminPendingAttendance,
  AdminPendingSessionLogs,
  AdminRecentActivity,
  listAdminPendingAttendance,
  listAdminPendingSessionLogs,
  listAdminRecentActivity,
} from "../src/api/reports";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { OrgMembersPanel } from "../src/screens/coordination/OrgMembersPanel";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

type CoordinationTab = "dashboard" | "members";

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

export default function CoordinationScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { activeOrganization } = useOrganization();
  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const organizationId = activeOrganization?.id ?? null;
  const organizationName = activeOrganization?.name ?? "Organização";

  const [activeTab, setActiveTab] = useState<CoordinationTab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAttendance, setPendingAttendance] = useState<AdminPendingAttendance[]>([]);
  const [pendingReports, setPendingReports] = useState<AdminPendingSessionLogs[]>([]);
  const [recentActivity, setRecentActivity] = useState<AdminRecentActivity[]>([]);

  const tabItems = useMemo(
    () => [
      { id: "dashboard" as const, label: "Dashboard" },
      { id: "members" as const, label: "Gerenciar membros" },
    ],
    []
  );

  const loadDashboard = useCallback(async () => {
    if (!organizationId || !isAdmin) {
      setPendingAttendance([]);
      setPendingReports([]);
      setRecentActivity([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [attendanceRows, reportRows, activityRows] = await Promise.all([
        listAdminPendingAttendance({ organizationId }),
        listAdminPendingSessionLogs({ organizationId }),
        listAdminRecentActivity({ organizationId, limit: 12 }),
      ]);
      setPendingAttendance(attendanceRows);
      setPendingReports(reportRows);
      setRecentActivity(activityRows);
    } catch (err) {
      setPendingAttendance([]);
      setPendingReports([]);
      setRecentActivity([]);
      setError(err instanceof Error ? err.message : "Falha ao carregar dados da coordenação.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, organizationId]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === "dashboard") {
        void loadDashboard();
      }
    }, [activeTab, loadDashboard])
  );

  if (!isAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, padding: 16 }}>
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 14,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              Coordenação
            </Text>
            <Text style={{ color: colors.muted }}>
              Você não tem acesso a esta área.
            </Text>
            <Pressable
              onPress={() => router.replace("/")}
              style={{
                alignSelf: "flex-start",
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800" }}>
            Coordenação
          </Text>
          <Text style={{ color: colors.muted }}>
            Dashboard e gestão de membros da organização • {organizationName}.
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
            {tabItems.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={{
                    flexGrow: 1,
                    minWidth: 130,
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
                      textAlign: "center",
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {activeTab === "members" ? (
        <View style={{ flex: 1 }}>
          <OrgMembersPanel embedded />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
          showsVerticalScrollIndicator={false}
        >
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

          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 14,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              Indicadores
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <View
                style={{
                  minWidth: 120,
                  flexGrow: 1,
                  padding: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                  {loading ? "..." : pendingAttendance.length}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Chamada pendente</Text>
              </View>
              <View
                style={{
                  minWidth: 120,
                  flexGrow: 1,
                  padding: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                  {loading ? "..." : pendingReports.length}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Relatórios pendentes</Text>
              </View>
              <View
                style={{
                  minWidth: 120,
                  flexGrow: 1,
                  padding: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                  {loading ? "..." : recentActivity.length}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Atividade (7d)</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions Card */}
          {!loading && (pendingAttendance.length > 0 || pendingReports.length > 0) ? (
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.primaryBg,
                backgroundColor: colors.card,
                padding: 14,
                gap: 10,
              }}
            >
              <Text style={{ color: colors.primaryText, fontSize: 16, fontWeight: "800" }}>
                Ações Rápidas
              </Text>
              <View style={{ gap: 8 }}>
                {pendingAttendance.length > 0 ? (
                  <Pressable
                    onPress={() => router.push("/reports")}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 10,
                      borderRadius: 12,
                      backgroundColor: colors.primaryBg,
                    }}
                  >
                    <Text style={{ color: colors.primaryText, fontWeight: "700", flex: 1 }}>
                      Ver todas as pendências
                    </Text>
                    <View
                      style={{
                        paddingVertical: 3,
                        paddingHorizontal: 8,
                        borderRadius: 999,
                        backgroundColor: colors.background,
                      }}
                    >
                      <Text style={{ color: colors.primaryBg, fontSize: 11, fontWeight: "800" }}>
                        {pendingAttendance.length + pendingReports.length}
                      </Text>
                    </View>
                  </Pressable>
                ) : null}
                {pendingReports.length > 0 ? (
                  <View
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 }}>
                      💡 Dica: Envie lembretes aos professores sobre relatórios pendentes usando o menu de comunicados.
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 14,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              Chamadas pendentes
            </Text>
            {loading ? (
              <Text style={{ color: colors.muted }}>Carregando...</Text>
            ) : pendingAttendance.length === 0 ? (
              <Text style={{ color: colors.muted }}>Nenhuma turma com chamada pendente.</Text>
            ) : (
              pendingAttendance.slice(0, 6).map((item) => (
                <Pressable
                  key={`${item.classId}_${item.targetDate}`}
                  onPress={() =>
                    router.push({
                      pathname: "/class/[id]/attendance",
                      params: { id: item.classId, date: item.targetDate },
                    })
                  }
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{item.className}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {item.unit || "Sem unidade"} • {item.studentCount} alunos • {formatDateBr(item.targetDate)}
                  </Text>
                </Pressable>
              ))
            )}
          </View>

          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 14,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              Relatórios pendentes
            </Text>
            {loading ? (
              <Text style={{ color: colors.muted }}>Carregando...</Text>
            ) : pendingReports.length === 0 ? (
              <Text style={{ color: colors.muted }}>Nenhuma turma sem relatório recente.</Text>
            ) : (
              pendingReports.slice(0, 6).map((item) => {
                // Check if report is critical (more than 7 days old)
                const daysSinceReport = item.lastReportAt
                  ? Math.floor(
                      (Date.now() - new Date(item.lastReportAt).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : 999;
                const isCritical = daysSinceReport > 7;

                return (
                  <Pressable
                    key={`${item.classId}_${item.periodStart}`}
                    onPress={() =>
                      router.push({
                        pathname: "/class/[id]/session",
                        params: { id: item.classId, tab: "relatório" },
                      })
                    }
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isCritical ? "#fca5a5" : colors.border,
                      backgroundColor: isCritical ? "#fef2f2" : colors.secondaryBg,
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>
                        {item.className}
                      </Text>
                      {isCritical ? (
                        <View
                          style={{
                            paddingVertical: 3,
                            paddingHorizontal: 7,
                            borderRadius: 999,
                            backgroundColor: "#dc2626",
                          }}
                        >
                          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                            {daysSinceReport}d
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {item.unit || "Sem unidade"} • Último: {formatDateTimeBr(item.lastReportAt)}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
