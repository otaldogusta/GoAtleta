import { memo, type ReactNode } from "react";
import { type StyleProp, type ViewStyle, View } from "react-native";

import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";

type Props = {
  active: boolean;
  onPress: () => void;
  children: ReactNode;
  rightAccessory?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  activeBackgroundColor?: string;
  inactiveBackgroundColor?: string;
  activeBorderColor?: string;
  inactiveBorderColor?: string;
};

export const AnchoredDropdownOption = memo(function AnchoredDropdownOption({
  active,
  onPress,
  children,
  rightAccessory,
  disabled,
  style,
  activeBackgroundColor,
  inactiveBackgroundColor,
  activeBorderColor,
  inactiveBorderColor,
}: Props) {
  const { colors } = useAppTheme();
  const backgroundColor = active
    ? activeBackgroundColor ?? colors.primaryBg
    : inactiveBackgroundColor ?? colors.card;
  const borderColor = active
    ? activeBorderColor ?? (activeBackgroundColor ?? colors.primaryBg)
    : inactiveBorderColor ?? colors.border;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderRadius: 14,
          marginVertical: 3,
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
