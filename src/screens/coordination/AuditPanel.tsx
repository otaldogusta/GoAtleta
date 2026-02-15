import { Text, useWindowDimensions, View } from "react-native";

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
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 430;

  if (loading || (pendingAttendanceCount === 0 && pendingReportsCount === 0)) {
    return null;
  }

  return (
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
          Ações rápidas
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
            Prioridades
          </Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        {pendingAttendanceCount > 0 ? (
          <Pressable
            onPress={onOpenReports}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 12,
              borderRadius: 14,
              backgroundColor: colors.primaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: isCompactLayout ? 13 : 14, flex: 1 }}>
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
              padding: 12,
              borderRadius: 14,
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
