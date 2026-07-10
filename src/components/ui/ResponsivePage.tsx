import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import type { ResponsivePageVariant } from "../../ui/responsive-layout";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";

type ResponsivePageProps = {
  children: ReactNode;
  variant?: ResponsivePageVariant;
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

export function ResponsivePage({
  children,
  variant = "content",
  gap = 16,
  style,
}: ResponsivePageProps) {
  const layout = useResponsiveLayout(variant);

  return (
    <View
      style={[
        {
          width: "100%",
          minWidth: 0,
          maxWidth: layout.maxContentWidth + layout.gutter * 2,
          alignSelf: "center",
          paddingHorizontal: layout.gutter,
          boxSizing: "border-box",
          gap,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
