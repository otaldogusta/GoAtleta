import { memo, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";

type Props = {
  active: boolean;
  onPress: () => void;
  children: ReactNode;
  rightAccessory?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  density?: "default" | "compact";
};

export const AnchoredDropdownOption = memo(function AnchoredDropdownOption({
  active,
  onPress,
  children,
  rightAccessory,
  disabled,
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
      style={[
        {
          paddingVertical: isCompact ? 7 : 12,
          paddingHorizontal: isCompact ? 8 : 12,
          borderRadius: isCompact ? 12 : 14,
          marginVertical: isCompact ? 0 : 3,
          backgroundColor,
          borderWidth: 1,
          borderColor,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1 }}>{children}</View>
        {rightAccessory ? <View>{rightAccessory}</View> : null}
      </View>
    </Pressable>
  );
});
