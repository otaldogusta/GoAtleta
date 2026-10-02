import { pageHeaderMetrics as metrics } from "../../theme/tokens";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "react-native";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";

export type BreadcrumbItem = { label: string; onPress: () => void };
type Props = { title: string; context?: string; breadcrumbs?: BreadcrumbItem[]; onBack: () => void; accessory?: ReactNode; style?: StyleProp<ViewStyle>; backLabel?: string };

export function PageBreadcrumbHeader({ title, context = "Go Atleta", breadcrumbs, onBack, accessory, style, backLabel }: Props) {
  const { colors } = useAppTheme();
  return <View style={[{ flexDirection: "row", alignItems: "center", gap: metrics.gap, minWidth: 0, height: metrics.height }, style]}>
    <Pressable accessibilityRole="button" accessibilityLabel={backLabel ?? `Voltar de ${title}`} onPress={onBack} suppressWebHoverFeedback disableWebPressScale style={({ hovered, pressed }) => ({ width: metrics.backSize, height: metrics.backSize, flexShrink: 0, borderRadius: metrics.backSize / 2, alignItems: "center", justifyContent: "center", backgroundColor: hovered || pressed ? colors.secondaryBg : "transparent" })}>
      <GoAtletaIcon name="chevronBack" size={metrics.iconSize} color={colors.text} />
    </Pressable>
    <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: metrics.breadcrumbGap, flexWrap: "nowrap" }}>
      {(breadcrumbs ?? [{ label: context, onPress: onBack }]).map((item, index) => <View key={`${index}-${item.label}`} style={{ flexDirection: "row", alignItems: "center", gap: metrics.breadcrumbGap, flexShrink: 1, minWidth: 0 }}>
        <Pressable accessibilityRole="link" accessibilityLabel={`Ir para ${item.label}`} onPress={item.onPress} suppressWebHoverFeedback disableWebPressScale style={{ flexShrink: 1, minWidth: 0 }}>
          {({ hovered }) => <Text numberOfLines={1} style={{ color: hovered ? colors.text : colors.muted, textDecorationLine: hovered ? "underline" : "none", fontSize: metrics.fontSize, lineHeight: metrics.lineHeight }}>{item.label}</Text>}
        </Pressable>
        <Text style={{ color: colors.muted, fontSize: metrics.fontSize, lineHeight: metrics.lineHeight }}>›</Text>
      </View>)}
      <Text accessibilityRole="header" accessibilityLabel={title} numberOfLines={1} style={{ color: colors.text, fontSize: metrics.fontSize, lineHeight: metrics.lineHeight, fontWeight: "600", flexShrink: 1 }}>{title}</Text>
      {accessory}
    </View>
  </View>;
}
