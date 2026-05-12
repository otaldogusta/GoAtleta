import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export function AppScreenContent({
  children,
  padding = "normal",
  style,
}: {
  children: ReactNode;
  padding?: "normal" | "compact" | "none";
  style?: StyleProp<ViewStyle>;
}) {
  const topPadding = padding === "none" ? 0 : padding === "compact" ? 10 : 14;

  return (
    <View style={[{ flex: 1, minHeight: 0, paddingTop: topPadding }, style]}>
      {children}
    </View>
  );
}
