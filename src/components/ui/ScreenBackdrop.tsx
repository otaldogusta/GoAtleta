import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";

type ScreenBackdropProps = {
  variant?: "default" | "boot";
};

export function ScreenBackdrop({ variant = "default" }: ScreenBackdropProps) {
  const { colors, mode } = useAppTheme();
  const gradientColors = Platform.OS === "web" && variant === "boot"
    ? [
        "var(--goatleta-boot-background)",
        "var(--goatleta-boot-card)",
        "var(--goatleta-boot-input)",
      ]
    : mode === "dark"
      ? variant === "boot"
        ? [colors.background, colors.card, colors.inputBg]
        : [colors.background, colors.card, colors.secondaryBg]
      : variant === "boot"
        ? [colors.background, colors.card, colors.secondaryBg]
        : [colors.background, colors.card, colors.secondaryBg];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={gradientColors as [string, string, string]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
