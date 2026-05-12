import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "./app-theme";

export function AppScreenShell({
  children,
  contentStyle,
  header,
  maxWidth = 1280,
  stickyHeader = true,
  tabs,
}: {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  header: ReactNode;
  maxWidth?: number;
  stickyHeader?: boolean;
  tabs?: ReactNode;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: colors.background }}>
      <View
        style={{
          backgroundColor: colors.background,
          zIndex: stickyHeader ? 2 : undefined,
        }}
      >
        <View
          style={[
            {
              width: "100%",
              maxWidth,
              alignSelf: "center",
              gap: 12,
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 4,
            },
          ]}
        >
          {header}
          {tabs}
        </View>
        <LinearGradient
          colors={[colors.background, "rgba(0,0,0,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
          style={{ height: 14 }}
        />
      </View>

      <View
        style={[
          {
            flex: 1,
            minHeight: 0,
            width: "100%",
            maxWidth,
            alignSelf: "center",
            paddingHorizontal: 16,
            paddingTop: 14,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
