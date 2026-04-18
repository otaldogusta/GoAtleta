import { Text, View } from "react-native";

import { useAppTheme } from "../../../ui/app-theme";

type SyncStatus = "in_sync" | "out_of_sync" | "overridden" | "stale_parent";

type Props = {
  status?: SyncStatus;
  compact?: boolean;
};

export function PlanningSyncStatusChip({ status = "in_sync", compact = false }: Props) {
  const { colors } = useAppTheme();

  const palette =
    status === "out_of_sync"
      ? {
          bg: colors.warningBg,
          text: colors.warningText,
          border: colors.warningBorder || colors.warningText,
          label: "Revisar",
          helper: "Vale revisar este plano.",
        }
      : status === "overridden"
        ? {
            bg: colors.primaryBg,
            text: colors.primaryText,
            border: colors.primaryBg,
            label: "Ajustado",
            helper: "Seus ajustes foram mantidos.",
          }
        : status === "stale_parent"
          ? {
              bg: colors.warningBg,
              text: colors.warningText,
              border: colors.warningBorder || colors.warningText,
              label: "Revisar",
              helper: "Este plano recebeu novas mudanças.",
            }
          : {
              bg: colors.successBg,
              text: colors.successText,
              border: colors.successBorder || colors.successText,
              label: "Atualizado",
              helper: null,
            };

  return (
    <View style={{ alignSelf: "flex-start", gap: 6 }}>
      <View
        style={{
          alignSelf: "flex-start",
          paddingHorizontal: compact ? 8 : 10,
          paddingVertical: compact ? 4 : 5,
          borderRadius: 999,
          backgroundColor: palette.bg,
          borderWidth: 1,
          borderColor: palette.border,
        }}
      >
        <Text style={{ color: palette.text, fontSize: compact ? 10 : 11, fontWeight: "700" }}>{palette.label}</Text>
      </View>
      {palette.helper && !compact ? (
        <Text style={{ color: colors.muted, fontSize: compact ? 10 : 11 }}>
          {palette.helper}
        </Text>
      ) : null}
    </View>
  );
}
