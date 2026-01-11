import React from "react";
import { Text, View, ViewStyle, TextStyle } from "react-native";
import { useAppTheme } from "./app-theme";

type BadgeProps = {
  label?: number | string | null;
  style?: ViewStyle;
  textStyle?: TextStyle;
  maxChars?: number;
};

const formatLabel = (value: number | string, maxChars: number) => {
  const raw = String(value);
  if (raw.length <= maxChars) return raw;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    const limit = Math.max(0, Math.pow(10, maxChars - 1) - 1);
    return `${limit}+`;
  }
  return raw.slice(0, Math.max(0, maxChars - 1)) + "+";
};

export function Badge({ label, style, textStyle, maxChars = 4 }: BadgeProps) {
  const { colors } = useAppTheme();
  const hasLabel = label !== null && label !== undefined && String(label).length > 0;
  const content = hasLabel ? formatLabel(label as number | string, maxChars) : "";

  if (!hasLabel) {
    return (
      <View
        style={[
          {
            height: 6,
            width: 6,
            borderRadius: 3,
            backgroundColor: colors.dangerSolidBg,
          },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          minWidth: 16,
          height: 16,
          paddingHorizontal: 4,
          borderRadius: 8,
          backgroundColor: colors.dangerSolidBg,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        style={[
          {
            color: colors.dangerSolidText,
            fontSize: 10,
            fontWeight: "700",
          },
          textStyle,
        ]}
      >
        {content}
      </Text>
    </View>
  );
}
