import { memo, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";
import { compactUiMetrics } from "../theme/compact-ui-metrics";

type Props = {
  active: boolean;
  onPress: () => void;
  children: ReactNode;
  rightAccessory?: ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  density?: "default" | "compact";
};

export const AnchoredDropdownOption = memo(function AnchoredDropdownOption({
  active,
  onPress,
  children,
  rightAccessory,
  disabled,
  accessibilityLabel,
  style,
  density = "default",
}: Props) {
  const { colors } = useAppTheme();
  const backgroundColor = active ? colors.primaryBg : colors.card;
  const borderColor = active ? colors.primaryBg : colors.border;
  const isCompact = density === "compact";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityLabel ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          minHeight: compactUiMetrics.touchTarget,
          justifyContent: "center",
          paddingVertical: isCompact ? 6 : 8,
          paddingHorizontal: isCompact ? 8 : 12,
          borderRadius: isCompact ? 12 : 14,
          marginVertical: isCompact ? 0 : 2,
          backgroundColor,
          borderWidth: 1,
          borderColor,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
        {rightAccessory ? <View>{rightAccessory}</View> : null}
      </View>
    </Pressable>
  );
});
