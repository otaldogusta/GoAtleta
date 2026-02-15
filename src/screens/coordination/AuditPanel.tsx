import { Text, View } from "react-native";

import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";

type AppColors = ReturnType<typeof useAppTheme>["colors"];

type AuditPanelProps = {
  colors: AppColors;
  loading: boolean;
  pendingAttendanceCount: number;
  pendingReportsCount: number;
  onOpenReports: () => void;
};

export function AuditPanel({
  colors,
  loading,
  pendingAttendanceCount,
  pendingReportsCount,
  onOpenReports,
}: AuditPanelProps) {
  if (loading || (pendingAttendanceCount === 0 && pendingReportsCount === 0)) {
    return null;
  }

  return (
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
        {pendingAttendanceCount > 0 ? (
          <Pressable
            onPress={onOpenReports}
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
                {pendingAttendanceCount + pendingReportsCount}
              </Text>
            </View>
          </Pressable>
        ) : null}
        {pendingReportsCount > 0 ? (
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
  );
}
