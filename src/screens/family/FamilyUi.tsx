import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";

import { compactUiMetrics as metrics, radius } from "../../theme/tokens";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";

export function FamilySurface({
  title,
  eyebrow,
  accessory,
  padding = 12,
  children,
}: {
  title?: string;
  eyebrow?: string;
  accessory?: ReactNode;
  padding?: number;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        width: "100%",
        minWidth: 0,
        borderRadius: radius.container,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding,
        gap: metrics.gap,
      }}
    >
      {eyebrow ? (
        <Text style={{ color: colors.muted, fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight, fontWeight: "700" }}>
          {eyebrow.toUpperCase()}
        </Text>
      ) : null}
      {title || accessory ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: metrics.gap }}>
          {title ? <Text style={{ flex: 1, minWidth: accessory ? 60 : 0, color: colors.text, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight, fontWeight: "700" }}>
            {title}
          </Text> : null}
          {accessory ? <View style={{ flexShrink: 0, maxWidth: "100%" }}>{accessory}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function FamilyEmptyState({
  icon = "family",
  title,
  description,
  action,
  padding = 12,
}: {
  icon?: GoAtletaIconName;
  title: string;
  description: string;
  action?: ReactNode;
  padding?: number;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        width: "100%",
        borderRadius: radius.container,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: metrics.gap,
      }}
    >
      <View
        style={{
          width: metrics.controlHeight,
          height: metrics.controlHeight,
          borderRadius: radius.full,
          backgroundColor: colors.successBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <GoAtletaIcon name={icon} size={metrics.iconSize} color={colors.successText} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: metrics.smallGap }}>
        <Text style={{ color: colors.text, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight, fontWeight: "700" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight }}>{description}</Text>
        {action}
      </View>
    </View>
  );
}

export function FamilyButton({ label, icon, onPress, variant = "outline", disabled = false, loading = false, loadingLabel, accessibilityLabel }: {
  label: string;
  icon?: GoAtletaIconName;
  onPress: () => void;
  variant?: "primary" | "outline" | "danger";
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  accessibilityLabel?: string;
}) {
  const { colors } = useAppTheme();
  const inactive = disabled || loading;
  const tonal = variant === "primary";
  const ink = variant === "danger" ? colors.dangerText : tonal ? colors.successText : colors.text;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? (loading ? loadingLabel ?? label : label)}
    accessibilityState={{ disabled: inactive, busy: loading }} disabled={inactive} onPress={onPress}
    suppressWebHoverFeedback disableWebPressScale
    style={{ minWidth: metrics.touchTarget, minHeight: metrics.touchTarget, maxWidth: "100%", alignSelf: "flex-start", justifyContent: "center", paddingVertical: (metrics.touchTarget - metrics.controlHeight) / 2, opacity: inactive ? 0.55 : 1 }}>
    {state => {
      const highlighted = state.pressed || Boolean((state as { hovered?: boolean }).hovered);
      return <View pointerEvents="none" style={{ minHeight: metrics.controlHeight, maxWidth: "100%", paddingHorizontal: metrics.gap, paddingVertical: metrics.smallGap,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: metrics.smallGap, borderRadius: radius.full,
        borderWidth: 1, borderColor: tonal ? highlighted ? colors.borderStrong : colors.successBorder : highlighted ? colors.border : "transparent",
        backgroundColor: tonal ? colors.successBg : highlighted ? colors.secondaryBg : "transparent", opacity: state.pressed ? 0.9 : 1 }}>
        {loading ? <ActivityIndicator size="small" color={ink} /> : icon ? <GoAtletaIcon name={icon} size={metrics.iconSize} color={ink} /> : null}
        <Text style={{ color: ink, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight, fontWeight: "600", flexShrink: 1, textAlign: "center" }}>{loading ? loadingLabel ?? label : label}</Text>
      </View>;
    }}
  </Pressable>;
}
