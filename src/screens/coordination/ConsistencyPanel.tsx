import { FlatList, Text, View } from "react-native";

import {
    type AdminPendingAttendance,
    type AdminPendingSessionLogs,
} from "../../api/reports";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";

type AppColors = ReturnType<typeof useAppTheme>["colors"];

type ConsistencyPanelProps = {
  colors: AppColors;
  loading: boolean;
  pendingAttendance: AdminPendingAttendance[];
  pendingReports: AdminPendingSessionLogs[];
  onOpenAttendance: (params: { classId: string; targetDate: string }) => void;
  onOpenReport: (params: { classId: string; periodStart: string }) => void;
  formatDateBr: (value: string | null | undefined) => string;
  formatDateTimeBr: (value: string | null | undefined) => string;
};

export function ConsistencyPanel({
  colors,
  loading,
  pendingAttendance,
  pendingReports,
  onOpenAttendance,
  onOpenReport,
  formatDateBr,
  formatDateTimeBr,
}: ConsistencyPanelProps) {
  return (
    <>
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
          <FlatList
            data={pendingAttendance}
            keyExtractor={(item) => `${item.classId}_${item.targetDate}`}
            scrollEnabled={false}
            initialNumToRender={10}
            windowSize={6}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  onOpenAttendance({
                    classId: item.classId,
                    targetDate: item.targetDate,
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
            )}
          />
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
          <FlatList
            data={pendingReports}
            keyExtractor={(item) => `${item.classId}_${item.periodStart}`}
            scrollEnabled={false}
            initialNumToRender={10}
            windowSize={6}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => {
              const daysSinceReport = item.lastReportAt
                ? Math.floor((Date.now() - new Date(item.lastReportAt).getTime()) / (1000 * 60 * 60 * 24))
                : 999;
              const isCritical = daysSinceReport > 7;
              const cardBorderColor = isCritical ? colors.dangerBorder : colors.border;
              const cardBackgroundColor = isCritical ? colors.dangerBg : colors.secondaryBg;
              const titleColor = isCritical ? colors.dangerText : colors.text;
              const subtitleColor = isCritical ? colors.dangerText : colors.muted;

              return (
                <Pressable
                  onPress={() =>
                    onOpenReport({
                      classId: item.classId,
                      periodStart: item.periodStart,
                    })
                  }
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: cardBorderColor,
                    backgroundColor: cardBackgroundColor,
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
                    <Text style={{ color: titleColor, fontWeight: "700", flex: 1 }}>
                      {item.className}
                    </Text>
                    {isCritical ? (
                      <View
                        style={{
                          paddingVertical: 3,
                          paddingHorizontal: 7,
                          borderRadius: 999,
                          backgroundColor: colors.dangerSolidBg,
                        }}
                      >
                        <Text style={{ color: colors.primaryText, fontSize: 10, fontWeight: "800" }}>
                          {daysSinceReport}d
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ color: subtitleColor, fontSize: 12 }}>
                    {item.unit || "Sem unidade"} • Último: {formatDateTimeBr(item.lastReportAt)}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </>
  );
}
