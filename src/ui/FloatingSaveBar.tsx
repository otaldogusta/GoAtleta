import { View } from "react-native";

import { radius, shadow, zIndex } from "../theme/tokens";
import { Button } from "./Button";
import { useAppTheme } from "./app-theme";

type FloatingSaveBarProps = {
  visible: boolean;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  maxWidth?: number;
  bottom?: number;
};

export function FloatingSaveBar({
  visible,
  label,
  onPress,
  disabled = false,
  loading = false,
  loadingLabel,
  maxWidth = 728,
  bottom = 18,
}: FloatingSaveBarProps) {
  const { colors } = useAppTheme();

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        right: 0,
        bottom,
        left: 0,
        zIndex: zIndex.fab,
        alignItems: "center",
        paddingHorizontal: 16,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth,
          padding: 8,
          borderRadius: radius.container,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          ...shadow.elevated,
        }}
      >
        <Button
          label={label}
          onPress={onPress}
          disabled={disabled}
          loading={loading}
          loadingLabel={loadingLabel}
        />
      </View>
    </View>
  );
}
