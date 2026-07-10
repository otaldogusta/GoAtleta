import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "react-native";

import type { ThemeColors } from "../../ui/app-theme";

type PanelProps = {
  children: ReactNode;
  colors: ThemeColors;
  style?: StyleProp<ViewStyle>;
};

export function RegulationPanel({ children, colors, style }: PanelProps) {
  return (
    <View
      style={[
        {
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: 18,
          gap: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function RegulationSectionHeader({
  title,
  description,
  colors,
}: {
  title: string;
  description: string;
  colors: ThemeColors;
}) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>{title}</Text>
      <Text style={{ color: colors.muted }}>{description}</Text>
    </View>
  );
}
