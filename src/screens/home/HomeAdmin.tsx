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

function CoordinationSummaryCard() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { activeOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
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
      { label: "Relat?rios pendentes", value: counts.pendingReports },
      { label: "Atividade (7d)", value: counts.recentActivity },
    ],
    [counts.pendingAttendance, counts.pendingReports, counts.recentActivity]
  );

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
            Coordena??o
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Carregando indicadores da organiza??o...
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
              Coordena??o
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Vis?o r?pida das pend?ncias da organiza??o.
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

          <Pressable
            onPress={() => router.push({ pathname: "/reports" })}
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
            <Text style={{ color: colors.text, fontWeight: "700" }}>Abrir dashboard</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push({ pathname: "/org-members" })}
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
            <Text style={{ color: colors.text, fontWeight: "700" }}>Gerenciar membros</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function HomeAdmin() {
  return <HomeProfessorScreen adminHeader={<CoordinationSummaryCard />} />;
}
