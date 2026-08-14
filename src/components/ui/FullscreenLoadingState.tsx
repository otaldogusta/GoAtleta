import { ActivityIndicator, Platform, Text, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { ScreenBackdrop } from "./ScreenBackdrop";

type FullscreenLoadingStateProps = {
  label?: string;
  overlay?: boolean;
};

const overlayStyle =
  Platform.OS === "web"
    ? ({ position: "fixed", top: 0, right: 0, bottom: 0, left: 0 } as const)
    : ({ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const);

export function FullscreenLoadingState({
  label = "Carregando...",
  overlay = false,
}: FullscreenLoadingStateProps) {
  const { colors } = useAppTheme();
  const backgroundColor = Platform.OS === "web"
    ? "var(--goatleta-boot-background)"
    : colors.background;
  const foregroundColor = Platform.OS === "web"
    ? "var(--goatleta-boot-text)"
    : colors.text;

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      style={[
        {
          flex: 1,
          backgroundColor,
        },
        overlay
          ? {
              ...overlayStyle,
              zIndex: 10000,
            }
          : null,
      ]}
      testID="fullscreen-loading-state"
    >
      <ScreenBackdrop variant="boot" />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <ActivityIndicator size="large" color={foregroundColor} />
        <Text style={{ color: foregroundColor, fontWeight: "600" }}>{label}</Text>
      </View>
    </View>
  );
}
