import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";

import type { ThemeColors } from "../../ui/app-theme";
import { compactUiMetrics } from "../../theme/tokens";

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
          padding: 12,
          gap: 8,
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
      <Text style={{ color: colors.text, fontSize: compactUiMetrics.titleFontSize, fontWeight: "900" }}>{title}</Text>
      <Text style={{ color: colors.muted }}>{description}</Text>
    </View>
  );
}
