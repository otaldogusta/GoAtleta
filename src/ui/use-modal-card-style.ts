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
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const padding = options.padding ?? 12;
  const gap = options.gap ?? 10;
  const radius = options.radius ?? 18;
  const fullWidth = options.fullWidth ?? false;
  const flushBottom = options.flushBottom ?? false;
  const maxHeight =
    options.maxHeight ?? (Platform.OS === "web" ? "90%" : "100%");
  const webBottomSpacing = Platform.OS === "web" ? 16 : 0;
  const resolvedMaxWidth =
    options.maxWidth ?? (Platform.OS === "web" ? 720 : undefined);

  return {
    maxHeight,
    width: "100%",
    backgroundColor: colors.card,
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
  } as ViewStyle;
}
