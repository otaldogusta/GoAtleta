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
  fullBleed?: boolean;
};

export function ScreenTopChrome({
  children,
  style,
  contentStyle,
  fadeHeight = 14,
  horizontalBleed = 0,
  fullBleed = true,
}: ScreenTopChromeProps) {
  const { colors } = useAppTheme();
  const stickyStyle =
    Platform.OS === "web"
      ? ({
          position: "sticky",
          top: 0,
        } as ViewStyle)
      : null;
  const webFullBleedStyle =
    Platform.OS === "web" && fullBleed
      ? ({
          marginLeft: -horizontalBleed,
          marginRight: -horizontalBleed,
          boxSizing: "border-box",
          paddingLeft: horizontalBleed,
          paddingRight: horizontalBleed,
          overflow: "visible",
        } as unknown as ViewStyle)
      : null;
  const bleedStyle =
    Platform.OS !== "web" && horizontalBleed > 0
      ? ({
          marginHorizontal: -horizontalBleed,
          paddingHorizontal: horizontalBleed,
        } as ViewStyle)
      : null;

  return (
    <View
      style={[
        { backgroundColor: colors.background, zIndex: 100, elevation: 8 },
        stickyStyle,
        webFullBleedStyle,
        bleedStyle,
        style,
      ]}
    >
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
