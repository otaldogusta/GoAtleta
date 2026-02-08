import {
  ActivityIndicator,
  Text,
  View,
} from "react-native";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  variant:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "danger"
    | "success"
    | "warning"
    | "info";
  disabled: boolean;
  loading: boolean;
}) {
  const { colors } = useAppTheme();
  const palette = {
    primary: {
      bg: colors.primaryBg,
      text: colors.primaryText,
      border: colors.primaryBg,
    },
    secondary: {
      bg: colors.secondaryBg,
      text: colors.secondaryText,
      border: colors.border,
    },
    outline: {
      bg: "transparent",
      text: colors.text,
      border: colors.border,
    },
    ghost: {
      bg: "transparent",
      text: colors.text,
      border: "transparent",
    },
    danger: {
      bg: colors.dangerSolidBg,
      text: colors.dangerSolidText,
      border: colors.dangerBorder,
    },
    success: {
      bg: colors.successBg,
      text: colors.successText,
      border: colors.successBg,
    },
    warning: {
      bg: colors.warningBg,
      text: colors.warningText,
      border: colors.warningBg,
    },
    info: {
      bg: colors.infoBg,
      text: colors.infoText,
      border: colors.infoBg,
    },
  } as const;
  const selected = palette[variant];
  const isOutline = variant === "outline" || variant === "ghost";
  const disabledBg = isOutline ? "transparent" : colors.primaryDisabledBg;
  const disabledBorder = isOutline ? colors.border : colors.primaryDisabledBg;
  const disabledText = colors.muted;
  const borderWidth =
    variant === "primary" || variant === "ghost" ? 0 : 1;

  const isDisabled = disabled || loading;
  const indicatorColor =
    variant === "primary" ? colors.primaryText : selected.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: isDisabled ? disabledBg : selected.bg,
          borderWidth,
          borderColor: isDisabled ? disabledBorder : selected.border,
          alignItems: "center",
          opacity: isDisabled ? 0.7 : 1,
        },
        pressed && !isDisabled
          ? { transform: [{ scale: 0.98 }], opacity: 0.92 }
          : null,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {loading ? (
          <ActivityIndicator size="small" color={indicatorColor} />
        ) : null}
        <Text
          style={{
            color: isDisabled ? disabledText : selected.text,
            fontWeight: "700",
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
