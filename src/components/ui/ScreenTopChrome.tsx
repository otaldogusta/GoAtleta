import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Platform, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";

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
  const responsiveLayout = useResponsiveLayout();
  const effectiveHorizontalBleed =
    Platform.OS === "web" && !responsiveLayout.usesWorkspaceShell ? 0 : horizontalBleed;
  const stickyStyle =
    Platform.OS === "web"
      ? ({
          position: "sticky",
          top: 0,
        } as unknown as ViewStyle)
      : null;
  const webFullBleedStyle =
    Platform.OS === "web" && fullBleed
      ? ({
          marginLeft: -effectiveHorizontalBleed,
          marginRight: -effectiveHorizontalBleed,
          boxSizing: "border-box",
          paddingLeft: effectiveHorizontalBleed,
          paddingRight: effectiveHorizontalBleed,
          overflow: "visible",
        } as unknown as ViewStyle)
      : null;
  const bleedStyle =
    Platform.OS !== "web" && effectiveHorizontalBleed > 0
      ? ({
          marginHorizontal: -effectiveHorizontalBleed,
          paddingHorizontal: effectiveHorizontalBleed,
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
