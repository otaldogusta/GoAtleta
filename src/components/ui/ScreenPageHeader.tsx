import { pageHeaderMetrics } from "../../theme/tokens";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { BackTitleHeader } from "./BackTitleHeader";
import { ScreenTopChrome } from "./ScreenTopChrome";

type ScreenPageHeaderProps = {
  title: string;
  onBack: () => void;
  onBreadcrumbNavigate?: (navigate: () => void) => void;
  eyebrow?: string;
  titleAccessory?: ReactNode;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  horizontalBleed?: number;
  fadeHeight?: number;
};

export function ScreenPageHeader({
  title,
  onBack,
  onBreadcrumbNavigate,
  eyebrow,
  titleAccessory,
  subtitle,
  right,
  children,
  style,
  contentStyle,
  horizontalBleed = 24,
  fadeHeight,
}: ScreenPageHeaderProps) {
  const { colors } = useAppTheme();

  return (
    <ScreenTopChrome
      style={style}
      horizontalBleed={horizontalBleed}
      fadeHeight={fadeHeight}
      contentStyle={[
        {
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 2,
        },
        contentStyle,
      ]}
    >
      <View style={{ minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <BackTitleHeader title={title} context={eyebrow} onBack={onBack} onBreadcrumbNavigate={onBreadcrumbNavigate} accessory={titleAccessory} style={{ marginBottom: 0 }} />
        </View>
        {right ? <View style={{ flexShrink: 0 }}>{right}</View> : null}
      </View>
      {subtitle ? (
        <Text numberOfLines={2} style={{ color: colors.muted, marginLeft: 50, fontSize: pageHeaderMetrics.fontSize, lineHeight: pageHeaderMetrics.lineHeight }}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </ScreenTopChrome>
  );
}
