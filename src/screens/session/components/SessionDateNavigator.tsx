import { Text, View } from "react-native";

import { ptBR } from "../../../constants/copy/pt-br";
import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";

type Props = {
  colors: ThemeColors;
  dateLabel: string;
  timeLabel: string;
  fallbackTimeLabel: string;
  onPrevious: () => void;
  onNext: () => void;
};

export function SessionDateNavigator({
  colors,
  dateLabel,
  timeLabel,
  fallbackTimeLabel,
  onPrevious,
  onNext,
}: Props) {
  return (
    <View
      style={{
        padding: 16,
        borderRadius: 20,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 12,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ptBR.common.accessibility.previousClass}
          onPress={onPrevious}
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <GoAtletaIcon name="chevronBack" size={18} color={colors.text} />
        </Pressable>

        <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>
            {dateLabel}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>
            {timeLabel || fallbackTimeLabel}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ptBR.common.accessibility.nextClass}
          onPress={onNext}
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <GoAtletaIcon name="chevronForward" size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}
