import { FlatList, Text, useWindowDimensions, View } from "react-native";

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
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 430;

  return (
    <>
      <View
        style={{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: isCompactLayout ? 12 : 16,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", flex: 1 }}>
            Chamadas pendentes
          </Text>
          <View
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
              {loading ? "..." : pendingAttendance.length}
            </Text>
          </View>
        </View>
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
                  padding: isCompactLayout ? 10 : 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>{item.className}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {item.unit || "Sem unidade"} - {item.studentCount} alunos - {formatDateBr(item.targetDate)}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>

      <View
        style={{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: isCompactLayout ? 12 : 16,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", flex: 1 }}>
            Relatorios pendentes
          </Text>
          <View
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
              {loading ? "..." : pendingReports.length}
            </Text>
          </View>
        </View>
        {loading ? (
          <Text style={{ color: colors.muted }}>Carregando...</Text>
        ) : pendingReports.length === 0 ? (
          <Text style={{ color: colors.muted }}>Nenhuma turma sem relatorio recente.</Text>
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
                ? Math.max(
                    0,
                    Math.floor((Date.now() - new Date(item.lastReportAt).getTime()) / (1000 * 60 * 60 * 24))
                  )
                : null;
              const isCritical = daysSinceReport === null || daysSinceReport > 7;
              const cardBorderColor = isCritical ? colors.dangerBorder : colors.border;
              const cardBackgroundColor = isCritical ? colors.dangerBg : colors.secondaryBg;
              const titleColor = isCritical ? colors.dangerText : colors.text;
              const subtitleColor = isCritical ? colors.dangerText : colors.muted;
              const badgeLabel = daysSinceReport === null ? "Sem relatorio" : `${daysSinceReport}d`;

              return (
                <Pressable
                  onPress={() =>
                    onOpenReport({
                      classId: item.classId,
                      periodStart: item.periodStart,
                    })
                  }
                  style={{
                    padding: isCompactLayout ? 10 : 12,
                    borderRadius: 14,
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
                          {badgeLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ color: subtitleColor, fontSize: 12 }}>
                    {item.unit || "Sem unidade"} - Ultimo:{" "}
                    {item.lastReportAt ? formatDateTimeBr(item.lastReportAt) : "Sem historico"}
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
