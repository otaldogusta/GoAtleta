import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";

import {
  listAdminPendingAttendance,
  listAdminPendingSessionLogs,
  listAdminRecentActivity,
} from "../../api/reports";
import { useOrganization } from "../../providers/OrganizationProvider";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { HomeProfessorScreen } from "./HomeProfessor";

type CoordinationTabId = "dashboard" | "members";

function CoordinationSummaryCard() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { activeOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CoordinationTabId>("dashboard");
  const [counts, setCounts] = useState({
    pendingAttendance: 0,
    pendingReports: 0,
    recentActivity: 0,
  });

  const loadSummary = useCallback(async () => {
    if (!activeOrganization?.id) {
      setCounts({ pendingAttendance: 0, pendingReports: 0, recentActivity: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [attendanceRows, reportsRows, activityRows] = await Promise.all([
        listAdminPendingAttendance({ organizationId: activeOrganization.id }),
        listAdminPendingSessionLogs({ organizationId: activeOrganization.id }),
        listAdminRecentActivity({ organizationId: activeOrganization.id, limit: 50 }),
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
  }, [activeOrganization?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [loadSummary])
  );

  const summaryValues = useMemo(
    () => [
      { label: "Chamada pendente", value: counts.pendingAttendance },
      { label: "Relatórios pendentes", value: counts.pendingReports },
      { label: "Atividade (7d)", value: counts.recentActivity },
    ],
    [counts.pendingAttendance, counts.pendingReports, counts.recentActivity]
  );

  const actionTabs = useMemo(
    () => [
      {
        id: "dashboard" as const,
        label: "Dashboard",
        helperText: "Acompanhar pendências e atividade recente da organização.",
        ctaLabel: "Abrir dashboard",
        route: "/reports" as const,
      },
      {
        id: "members" as const,
        label: "Gerenciar membros",
        helperText: "Editar cargos, turmas responsáveis e permissões de telas.",
        ctaLabel: "Abrir gerenciamento",
        route: "/org-members" as const,
      },
    ],
    []
  );

  const selectedAction = actionTabs.find((tab) => tab.id === activeTab) ?? actionTabs[0];

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        gap: 10,
      }}
    >
      {loading ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
            Coordenação
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Carregando indicadores da organização...
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
              Coordenação
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Visão rápida das pendências da organização.
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {summaryValues.map((item) => (
              <View
                key={item.label}
                style={{
                  minWidth: 128,
                  flexGrow: 1,
                  padding: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  gap: 2,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                  {item.value}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.inputBg,
              padding: 6,
              gap: 6,
            }}
          >
            <View style={{ flexDirection: "row", gap: 6 }}>
              {actionTabs.map((tab) => {
                const isSelected = tab.id === activeTab;
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={{
                      flex: 1,
                      paddingVertical: 9,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.border : "transparent",
                      backgroundColor: isSelected ? colors.secondaryBg : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? colors.text : colors.muted,
                        fontWeight: "700",
                        fontSize: 12,
                        textAlign: "center",
                      }}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ gap: 8, paddingHorizontal: 4, paddingBottom: 2 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{selectedAction.helperText}</Text>
              <Pressable
                onPress={() => router.push({ pathname: selectedAction.route })}
                style={{
                  alignSelf: "flex-start",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {selectedAction.ctaLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default function HomeAdmin() {
  return <HomeProfessorScreen adminHeader={<CoordinationSummaryCard />} />;
}
