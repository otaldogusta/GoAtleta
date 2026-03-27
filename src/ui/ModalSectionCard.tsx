import { Ionicons } from "@expo/vector-icons";
import { type ReactNode } from "react";
import { Animated, Text, View } from "react-native";

import type { ThemeColors } from "./app-theme";
import { Pressable } from "./Pressable";

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
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{title}</Text>
          {summary ? <Text style={{ color: colors.muted, fontSize: 11 }}>{summary}</Text> : null}
        </View>
        <Ionicons name="chevron-down" size={16} color={colors.muted} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
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
