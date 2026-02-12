import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
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

type DashboardTab = "attendance" | "session" | "activity";

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

  if (!isAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: "center" }}>
          <View
            style={{
              padding: 16,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>
              Acesso restrito
            </Text>
            <Text style={{ color: colors.muted }}>
              Esta área é exclusiva para administradores da organização.
            </Text>
            <Pressable
              onPress={() => router.replace("/")}
              style={{
                marginTop: 6,
                alignSelf: "flex-start",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar para início</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
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

        {loading ? (
          <View style={{ gap: 10 }}>
            <ShimmerBlock style={{ height: 98, borderRadius: 16 }} />
            <ShimmerBlock style={{ height: 98, borderRadius: 16 }} />
            <ShimmerBlock style={{ height: 98, borderRadius: 16 }} />
          </View>
        ) : null}

        {!loading && tab === "attendance" ? (
          <View style={{ gap: 10 }}>
            {pendingAttendance.length === 0 ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Tudo em dia</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>
                  Nenhuma turma com chamada pendente hoje.
                </Text>
              </View>
            ) : (
              pendingAttendance.map((item) => (
                <View
                  key={`${item.classId}_${item.targetDate}`}
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
                    {item.className}
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    Unidade: {item.unit || "-"} • Alunos: {item.studentCount}
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    Data alvo: {formatDateBr(item.targetDate)}
                  </Text>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/class/[id]/attendance",
                        params: { id: item.classId, date: item.targetDate || todayDateKey },
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
              ))
            )}
          </View>
        ) : null}

        {!loading && tab === "session" ? (
          <View style={{ gap: 10 }}>
            {pendingSessions.length === 0 ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Tudo em dia</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>
                  Nenhuma turma sem relatório nos últimos 7 dias.
                </Text>
              </View>
            ) : (
              pendingSessions.map((item) => (
                <View
                  key={`${item.classId}_${item.periodStart}`}
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
                    {item.className}
                  </Text>
                  <Text style={{ color: colors.muted }}>Unidade: {item.unit || "-"}</Text>
                  <Text style={{ color: colors.muted }}>
                    Último relatório: {item.lastReportAt ? formatDateTimeBr(item.lastReportAt) : "nunca"}
                  </Text>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/class/[id]/session",
                        params: { id: item.classId, tab: "relatório", date: todayDateKey },
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
              ))
            )}
          </View>
        ) : null}

        {!loading && tab === "activity" ? (
          <View style={{ gap: 10 }}>
            {recentActivity.length === 0 ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Tudo em dia</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>
                  Sem atividade nos últimos 7 dias.
                </Text>
              </View>
            ) : (
              recentActivity.map((item, index) => (
                <View
                  key={`${item.kind}_${item.classId}_${item.occurredAt}_${index}`}
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
                    {item.kind === "attendance" ? "Chamada" : "Relatório"} • {item.className}
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    Unidade: {item.unit || "-"} • Em: {formatDateTimeBr(item.occurredAt)}
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    Responsável: {shortUserId(item.actorUserId)} • Registros: {item.affectedRows}
                  </Text>
                  {item.referenceDate ? (
                    <Text style={{ color: colors.muted }}>
                      Referência: {formatDateBr(item.referenceDate)}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
