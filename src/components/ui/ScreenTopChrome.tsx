import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";

type ScreenTopChromeProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  fadeHeight?: number;
};

export function ScreenTopChrome({
  children,
  style,
  contentStyle,
  fadeHeight = 14,
}: ScreenTopChromeProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[{ backgroundColor: colors.background }, style]}>
      <View style={contentStyle}>{children}</View>
      <LinearGradient
        pointerEvents="none"
        colors={[colors.background, "rgba(0,0,0,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ height: fadeHeight }}
      />
    </View>
  );
}
