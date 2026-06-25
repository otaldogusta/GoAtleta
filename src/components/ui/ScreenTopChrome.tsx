import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Platform, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";

type ScreenTopChromeProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  fadeHeight?: number;
  horizontalBleed?: number;
};

export function ScreenTopChrome({
  children,
  style,
  contentStyle,
  fadeHeight = 14,
  horizontalBleed = 0,
}: ScreenTopChromeProps) {
  const { colors } = useAppTheme();
  const stickyStyle =
    Platform.OS === "web"
      ? ({
          position: "sticky",
          top: 0,
        } as ViewStyle)
      : null;
  const bleedStyle =
    horizontalBleed > 0
      ? ({
          marginHorizontal: -horizontalBleed,
          paddingHorizontal: horizontalBleed,
        } as ViewStyle)
      : null;

  return (
    <View style={[{ backgroundColor: colors.background, zIndex: 100, elevation: 8 }, stickyStyle, bleedStyle, style]}>
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
