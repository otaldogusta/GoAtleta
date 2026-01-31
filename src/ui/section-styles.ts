import { Platform, type ViewStyle } from "react-native";

import { type ThemeColors } from "./app-theme";

export type SectionTone = "neutral" | "info" | "success" | "warning" | "primary";

type SectionStyleOptions = {
  padding?: number;
  radius?: number;
  shadow?: boolean;
};

export function getSectionCardStyle(
  colors: ThemeColors,
  tone: SectionTone = "neutral",
  options: SectionStyleOptions = {}
): ViewStyle {
  const { padding = 14, radius = 18, shadow = true } = options;
  const toneMap = {
    neutral: { bg: colors.card, accent: "transparent", accentWidth: 0 },
    info: { bg: colors.card, accent: colors.infoBg, accentWidth: 3 },
    success: { bg: colors.inputBg, accent: colors.successBg, accentWidth: 3 },
    warning: { bg: colors.card, accent: colors.warningBg, accentWidth: 3 },
    primary: { bg: colors.card, accent: colors.primaryBg, accentWidth: 3 },
  } as const;
  const selected = toneMap[tone];

  return {
    gap: 10,
    padding,
    borderRadius: radius,
    backgroundColor: selected.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: selected.accentWidth,
    borderLeftColor: selected.accent,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        } as ViewStyle)
      : null),
    ...(shadow
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.22,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 12 },
          elevation: 8,
        }
      : null),
  };
}
