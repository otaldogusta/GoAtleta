import { Text, View } from "react-native";

import type { ThemeColors } from "../../../ui/app-theme";

type SummaryItem = {
  label: string;
  value: number;
  tone?: "default" | "warning" | "success";
};

type Props = {
  colors: ThemeColors;
  items: SummaryItem[];
};

function resolveToneColors(
  colors: ThemeColors,
  tone: SummaryItem["tone"],
): { backgroundColor: string; borderColor: string; textColor: string; badgeBg: string } {
  if (tone === "warning") {
    return {
      backgroundColor: colors.card,
      borderColor: colors.border,
      textColor: colors.text,
      badgeBg: "rgba(245, 158, 11, 0.12)",
    };
  }

  if (tone === "success") {
    return {
      backgroundColor: colors.card,
      borderColor: colors.border,
      textColor: colors.text,
      badgeBg: "rgba(34, 197, 94, 0.12)",
    };
  }

  return {
    backgroundColor: colors.card,
    borderColor: colors.border,
    textColor: colors.text,
    badgeBg: colors.secondaryBg,
  };
}

export function ExerciseSummaryCards({ colors, items }: Props) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {items.map((item) => {
        const toneColors = resolveToneColors(colors, item.tone);
        return (
          <View
            key={item.label}
            style={{
              flexGrow: 1,
              minWidth: 148,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: toneColors.borderColor,
              backgroundColor: toneColors.backgroundColor,
              gap: 10,
            }}
          >
            <View
              style={{
                alignSelf: "flex-start",
                paddingVertical: 5,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: toneColors.badgeBg,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "700" }}>
                {item.label}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: toneColors.textColor,
              }}
            >
              {item.value}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
