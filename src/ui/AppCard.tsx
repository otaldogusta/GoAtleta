import type { ReactNode } from "react";
import { Platform, View, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "./app-theme";

export function AppCard({
  children,
  compact = false,
  style,
}: {
  children: ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        {
          gap: compact ? 8 : 10,
          padding: compact ? 12 : 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          shadowColor: "#000",
          shadowOpacity: Platform.OS === "web" ? 0.03 : 0,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 2 },
          elevation: 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
