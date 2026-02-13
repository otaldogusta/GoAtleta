import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  listAdminPendingAttendance,
  listAdminPendingSessionLogs,
  listAdminRecentActivity,
} from "../src/api/reports";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

type CoordinationTab = "dashboard" | "members";

export default function CoordinationScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { activeOrganization } = useOrganization();
  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const [activeTab, setActiveTab] = useState<CoordinationTab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    pendingAttendance: 0,
    pendingReports: 0,
    recentActivity: 0,
  });

  const loadSummary = useCallback(async () => {
    const organizationId = activeOrganization?.id ?? null;
    if (!organizationId || !isAdmin) {
      setCounts({ pendingAttendance: 0, pendingReports: 0, recentActivity: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [attendanceRows, reportsRows, activityRows] = await Promise.all([
        listAdminPendingAttendance({ organizationId }),
        listAdminPendingSessionLogs({ organizationId }),
        listAdminRecentActivity({ organizationId, limit: 50 }),
      ]);
      setCounts({
        pendingAttendance: attendanceRows.length,
        pendingReports: reportsRows.length,
        recentActivity: activityRows.length,
      });
    } catch {
      setCounts({ pendingAttendance: 0, pendingReports: 0, recentActivity: 0 });
    } finally {
      setLoading(false);
    }
  }, [activeOrganization?.id, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [loadSummary])
  );

  const tabItems = useMemo(
    () => [
      { id: "dashboard" as const, label: "Dashboard" },
      { id: "members" as const, label: "Gerenciar membros" },
    ],
    []
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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800" }}>
            Coordenação
          </Text>
          <Text style={{ color: colors.muted }}>
            Acesso rápido ao Dashboard e ao gerenciamento de membros
            {activeOrganization?.name ? ` • ${activeOrganization.name}` : ""}.
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

        {activeTab === "dashboard" ? (
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
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Dashboard</Text>
            <Text style={{ color: colors.muted }}>
              Pendências e atividade da organização.
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
                  {loading ? "..." : counts.pendingAttendance}
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
                  {loading ? "..." : counts.pendingReports}
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
                  {loading ? "..." : counts.recentActivity}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Atividade (7d)</Text>
              </View>
            </View>

            <Pressable
              onPress={() => router.push({ pathname: "/reports" })}
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
              <Text style={{ color: colors.text, fontWeight: "700" }}>Abrir dashboard</Text>
            </Pressable>
          </View>
        ) : (
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
              Gerenciar membros
            </Text>
            <Text style={{ color: colors.muted }}>
              Ajuste cargos, turmas responsáveis e permissões de telas da organização.
            </Text>
            <Pressable
              onPress={() => router.push({ pathname: "/org-members" })}
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
              <Text style={{ color: colors.text, fontWeight: "700" }}>Abrir gerenciamento</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
