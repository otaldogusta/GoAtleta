import { View } from "react-native";
import { compactUiMetrics as metrics, radius } from "../../theme/tokens";
import { OperationalText as Text } from "../../ui/OperationalText";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";

export const studentHighlighted = (state: { pressed: boolean }) =>
  state.pressed || Boolean((state as { hovered?: boolean }).hovered);

/** Compact operational surface; the touch target remains outside its paint. */
export function StudentAction({ label, onPress, disabled = false, primary = false }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      suppressWebHoverFeedback disableWebPressScale
      style={{ minHeight: metrics.touchTarget, minWidth: metrics.touchTarget, maxWidth: "100%", alignSelf: "flex-start", paddingVertical: (metrics.touchTarget - metrics.controlHeight) / 2, justifyContent: "center", opacity: disabled ? 0.55 : 1 }}>
      {state => (
        <View pointerEvents="none" style={{ minHeight: metrics.controlHeight, maxWidth: "100%", paddingHorizontal: metrics.gap, paddingVertical: metrics.smallGap, borderRadius: radius.full,
          borderWidth: 1, borderColor: primary ? studentHighlighted(state) ? colors.borderStrong : colors.successBorder : studentHighlighted(state) ? colors.border : "transparent",
          backgroundColor: primary ? colors.successBg : studentHighlighted(state) ? colors.secondaryBg : "transparent", alignItems: "center", justifyContent: "center", opacity: state.pressed ? 0.9 : 1 }}>
          <Text style={{ color: disabled ? colors.muted : primary ? colors.successText : colors.text, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight, fontWeight: "600", textAlign: "center", flexShrink: 1 }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
