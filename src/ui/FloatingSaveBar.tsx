import { View } from "react-native";

import { radius, shadow, zIndex } from "../theme/tokens";
import { Button } from "./Button";

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
  maxWidth = 440,
  bottom = 18,
}: FloatingSaveBarProps) {
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
          borderRadius: radius.internal,
          ...shadow.card,
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
