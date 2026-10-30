import { type ReactNode } from "react";
import { Animated, View } from "react-native";
import { OperationalText as Text } from "./OperationalText";

import type { ThemeColors } from "./app-theme";
import { GoAtletaIcon } from "./icon-registry";
import { Pressable } from "./Pressable";
import { compactUiMetrics } from "../theme/compact-ui-metrics";

type Props = {
  title: string;
  summary?: string;
  open: boolean;
  onPress: () => void;
  colors: ThemeColors;
  animatedStyle?: object;
  isVisible?: boolean;
  children: ReactNode;
};

export function ModalSectionCard({
  title,
  summary,
  open,
  onPress,
  colors,
  animatedStyle,
  isVisible = true,
  children,
}: Props) {
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, overflow: "hidden" }}>
      <Pressable
        onPress={onPress}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: compactUiMetrics.touchTarget, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight, fontWeight: "700" }}>{title}</Text>
          {summary ? <Text style={{ color: colors.muted, fontSize: 11 }}>{summary}</Text> : null}
        </View>
        <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </Pressable>
      {open ? <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12 }} /> : null}
      {isVisible ? (
        <Animated.View style={[animatedStyle ?? null, { overflow: "hidden" }]}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}
