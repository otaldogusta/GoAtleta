import { Platform } from "react-native";
import type { ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "./app-theme";

type ModalCardOptions = {
  maxHeight?: string;
  padding?: number;
  radius?: number;
  gap?: number;
  fullWidth?: boolean;
  maxWidth?: number;
  flushBottom?: boolean;
};

export function useModalCardStyle(options: ModalCardOptions = {}) {
  const { colors, mode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const padding = options.padding ?? 16;
  const gap = options.gap ?? 10;
  const radius = options.radius ?? 20;
  const fullWidth = options.fullWidth ?? false;
  const flushBottom = options.flushBottom ?? false;
  const maxHeight =
    options.maxHeight ?? (Platform.OS === "web" ? "90%" : "100%");
  const webBottomSpacing = Platform.OS === "web" ? 16 : 0;
  const resolvedMaxWidth =
    options.maxWidth ?? (Platform.OS === "web" ? 720 : undefined);

  const lightWeb = Platform.OS === "web" && mode === "light";
  const webGlassStyle =
    Platform.OS === "web"
      ? ({
          backdropFilter: "blur(18px) saturate(130%)",
          WebkitBackdropFilter: "blur(18px) saturate(130%)",
          backgroundImage:
            mode === "light"
              ? "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,250,250,0.94) 100%)"
              : "linear-gradient(180deg, rgba(22,32,54,0.88) 0%, rgba(16,25,46,0.84) 100%)",
        } as ViewStyle)
      : null;

  return {
    maxHeight,
    width: "100%",
    backgroundColor: lightWeb ? "rgba(255,255,255,0.9)" : colors.card,
    borderWidth: 1,
    borderColor: lightWeb ? "rgba(15,23,42,0.14)" : colors.border,
    padding,
    paddingBottom: padding + insets.bottom + webBottomSpacing,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: flushBottom ? 0 : radius,
    borderBottomRightRadius: flushBottom ? 0 : radius,
    gap,
    alignSelf: fullWidth ? "stretch" : "center",
    maxWidth: fullWidth ? undefined : resolvedMaxWidth,
    marginBottom: flushBottom ? 0 : webBottomSpacing,
    ...webGlassStyle,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  } as ViewStyle;
}
