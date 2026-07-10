import { Children, isValidElement, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { useResponsiveLayout } from "../../ui/use-responsive-layout";

export type ResponsiveGridComposition = "1" | "8/4" | "6/6";

type ResponsiveGridProps = {
  children: ReactNode;
  columns: {
    compact: "1";
    desktop: Exclude<ResponsiveGridComposition, "1">;
  };
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

const desktopFlexFor = (
  composition: Exclude<ResponsiveGridComposition, "1">,
  index: number
) => {
  if (composition === "6/6") return 1;
  return index === 0 ? 2 : 1;
};

export function ResponsiveGrid({
  children,
  columns,
  gap = 16,
  style,
}: ResponsiveGridProps) {
  const { isDesktop } = useResponsiveLayout();
  const items = Children.toArray(children);

  return (
    <View
      style={[
        {
          width: "100%",
          flexDirection: isDesktop ? "row" : "column",
          alignItems: "stretch",
          gap,
        },
        style,
      ]}
    >
      {items.map((item, index) => (
        <View
          key={isValidElement(item) && item.key ? String(item.key) : `static-region-${index}`}
          style={
            isDesktop
              ? { flex: desktopFlexFor(columns.desktop, index), minWidth: 0 }
              : { width: "100%", minWidth: 0 }
          }
        >
          {item}
        </View>
      ))}
    </View>
  );
}
