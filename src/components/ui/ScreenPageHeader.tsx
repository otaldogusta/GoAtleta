import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { BackTitleHeader } from "./BackTitleHeader";
import { ScreenTopChrome } from "./ScreenTopChrome";

type ScreenPageHeaderProps = {
  title: string;
  onBack: () => void;
  eyebrow?: string;
  titleAccessory?: ReactNode;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  horizontalBleed?: number;
};

export function ScreenPageHeader({
  title,
  onBack,
  eyebrow,
  titleAccessory,
  subtitle,
  right,
  children,
  style,
  contentStyle,
  horizontalBleed = 24,
}: ScreenPageHeaderProps) {
  const { colors } = useAppTheme();

  return (
    <ScreenTopChrome
      style={style}
      horizontalBleed={horizontalBleed}
      contentStyle={[
        {
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 2,
        },
        contentStyle,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0, gap: eyebrow || subtitle ? 3 : 0 }}>
          {eyebrow ? (
            <Text style={{ color: colors.muted, marginLeft: 36, fontSize: 12, fontWeight: "600" }}>
              {eyebrow}
            </Text>
          ) : null}
          <BackTitleHeader title={title} onBack={onBack} accessory={titleAccessory} style={{ marginBottom: 0 }} />
          {subtitle ? (
            <Text numberOfLines={2} style={{ color: colors.muted, marginLeft: 36 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={{ flexShrink: 0 }}>{right}</View> : null}
      </View>
      {children}
    </ScreenTopChrome>
  );
}
