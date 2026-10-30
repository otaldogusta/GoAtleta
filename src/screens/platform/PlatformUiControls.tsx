import { View } from "react-native";
import { compactUiMetrics as metrics, radius } from "../../theme/tokens";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { OperationalText as Text } from "../../ui/OperationalText";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";

export const platformHighlighted = (state: { pressed: boolean }) => state.pressed || Boolean((state as { hovered?: boolean }).hovered);

/** The court's compact control surface, with its touch space kept outside the paint. */
export function PlatformAction({ label, icon, iconOnly = false, onPress, disabled = false, selected = false, variant = "outline", accessibilityLabel }: {
  label: string;
  icon?: GoAtletaIconName;
  iconOnly?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
  variant?: "primary" | "outline" | "danger";
  accessibilityLabel?: string;
}) {
  const { colors } = useAppTheme();
  const tonal = variant === "primary" || selected;
  const ink = variant === "danger" ? colors.dangerText : tonal ? colors.successText : colors.text;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    suppressWebHoverFeedback disableWebPressScale
    style={{ minWidth: metrics.touchTarget, minHeight: metrics.touchTarget, maxWidth: "100%", alignSelf: "flex-start", paddingVertical: (metrics.touchTarget - metrics.controlHeight) / 2, justifyContent: "center", opacity: disabled ? 0.55 : 1 }}>
    {state => <View pointerEvents="none" style={{ minHeight: metrics.controlHeight, minWidth: iconOnly ? metrics.controlHeight : undefined, maxWidth: "100%", paddingHorizontal: metrics.gap, paddingVertical: metrics.smallGap,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: metrics.smallGap, borderRadius: radius.full,
      backgroundColor: tonal ? colors.successBg : platformHighlighted(state) ? colors.secondaryBg : "transparent",
      borderWidth: 1, borderColor: tonal ? platformHighlighted(state) ? colors.borderStrong : colors.successBorder : platformHighlighted(state) ? colors.border : "transparent", opacity: state.pressed ? 0.9 : 1 }}>
      {icon ? <GoAtletaIcon name={icon} size={metrics.iconSize} color={ink} /> : null}
      {!iconOnly ? <Text style={{ color: ink, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight, fontWeight: "600", flexShrink: 1, textAlign: "center" }}>{label}</Text> : null}
    </View>}
  </Pressable>;
}

export function PlatformMetric({ icon, value, label, compactLabel, color, compact = false }: {
  icon: GoAtletaIconName;
  value: string;
  label: string;
  compactLabel?: string;
  color: string;
  compact?: boolean;
}) {
  const { colors } = useAppTheme();
  return <View accessible accessibilityLabel={`${value} ${label}`} style={{ flex: 1, minWidth: 0, borderRadius: radius.internal, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    paddingHorizontal: compact ? metrics.smallGap : 12, paddingVertical: metrics.gap, flexDirection: "row", alignItems: "center", gap: compact ? metrics.smallGap : metrics.gap }}>
    {!compact ? <GoAtletaIcon name={icon} size={metrics.iconSize} color={color} /> : null}
    <Text style={{ color: colors.text, fontSize: 20, lineHeight: 24, fontWeight: "700" }}>{value}</Text>
    <Text style={{ flex: 1, minWidth: 0, color, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight, fontWeight: "500" }}>{compact ? compactLabel ?? label : label}</Text>
  </View>;
}
