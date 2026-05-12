import { Text, View } from "react-native";

import { useAppTheme } from "./app-theme";

export type AppBadgeTone = "neutral" | "attention" | "positive";

export function AppBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: AppBadgeTone;
}) {
  const { colors } = useAppTheme();
  const palette = {
    neutral: { bg: colors.secondaryBg, text: colors.secondaryText, border: colors.border },
    attention: { bg: colors.warningBg, text: colors.warningText, border: colors.warningBorder },
    positive: { bg: colors.successBg, text: colors.successText, border: colors.successBorder },
  } as const;
  const selected = palette[tone];

  return (
    <View
      style={{
        minHeight: 26,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "flex-start",
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected.border,
        backgroundColor: selected.bg,
      }}
    >
      <Text style={{ color: selected.text, fontSize: 10, fontWeight: "800", lineHeight: 12 }}>{label}</Text>
    </View>
  );
}
