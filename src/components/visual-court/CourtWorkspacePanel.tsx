import type { ReactNode } from "react";
import { Animated, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { radius, shadow } from "../../theme/tokens";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useDisclosureMotion } from "../../ui/useDisclosureMotion";
import { mobileCourtChrome } from "./court-overlay-layout";

export type CourtWorkspaceTab = "adjustments" | "steps" | "library";

type Props = {
  open: boolean;
  onToggle: () => void;
  tab: CourtWorkspaceTab;
  onTabChange: (tab: CourtWorkspaceTab) => void;
  adjustments: ReactNode;
  steps: ReactNode;
  library: ReactNode;
  disabled?: boolean;
  uiScale?: number;
  top?: number;
  bottom?: number;
};

const TABS = [
  ["adjustments", "Ajustes"],
  ["steps", "Etapas"],
  ["library", "Biblioteca"],
] as const;

/** Shares one disclosure surface while retaining each tab's local view state. */
export function CourtWorkspacePanel({ open, onToggle, tab, onTabChange, adjustments, steps, library, disabled = false, uiScale = 1, top = 144, bottom = 88 }: Props) {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const mobile = width <= 700;
  const compactWeb = mobile && Platform.OS === "web";
  const scale = mobile ? 1 : uiScale;
  const motion = useDisclosureMotion(open, { axis: mobile ? "y" : "x", distance: 24, duration: 200 });
  const panelWidth = mobile ? Math.min(440, width - 24) : 360;
  const panelBottom = mobile ? compactWeb ? bottom : Math.max(bottom, width < 460 ? 120 : bottom) : undefined;
  const panelHeight = Math.max(160, Math.min(compactWeb ? Math.min(480, height * .62) : 600, mobile ? height - top - (panelBottom ?? bottom) : (height - top - bottom) / scale));
  const gripWidth = compactWeb ? mobileCourtChrome.gripWidth : 80;
  const gripHeight = compactWeb ? mobileCourtChrome.gripHeight : 40;
  const panelHeader = compactWeb ? 32 : 44;
  const right = mobile ? (width - panelWidth) / 2 : 20 * scale;
  const contents = { adjustments, steps, library };

  return <>
    {motion.mounted ? <Animated.View accessibilityLabel="Painel da jogada" pointerEvents={open ? "auto" : "none"} accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"} aria-hidden={!open} {...(Platform.OS === "web" ? { inert: !open } : {})} style={[styles.panel, { width: panelWidth, height: panelHeight, right, top: mobile ? undefined : top, bottom: panelBottom, paddingTop: mobile ? panelHeader : 14, opacity: motion.style.opacity, transform: [...motion.style.transform, { scale }], transformOrigin: "top right", borderColor: colors.border, backgroundColor: colors.surface }, shadow.elevated]}>
      <View accessibilityRole="tablist" accessibilityLabel="Áreas da jogada" style={[styles.tabs, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
        {TABS.map(([value, label]) => <Pressable suppressWebHoverFeedback disableWebPressScale key={value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: tab === value, disabled }} aria-selected={tab === value} disabled={disabled} onPress={() => { if (!disabled) onTabChange(value); }} style={({ hovered, pressed }) => [styles.tab, mobile ? { minHeight: compactWeb ? 28 : 36 } : null, { backgroundColor: tab === value ? colors.primaryBg : hovered || pressed ? colors.secondaryBg : "transparent", opacity: disabled ? 0.55 : 1 }]}>
          <Text numberOfLines={1} style={{ color: tab === value ? colors.primaryText : colors.muted, fontSize: 12, fontWeight: mobile && tab === value ? "600" : "400" }}>{label}</Text>
        </Pressable>)}
      </View>
      {TABS.map(([value, label]) => {
        const active = open && tab === value;
        return <View key={value} accessibilityLabel={`Conteúdo: ${label}`} pointerEvents={active ? "auto" : "none"} accessibilityElementsHidden={!active} importantForAccessibility={active ? "auto" : "no-hide-descendants"} aria-hidden={!active} {...(Platform.OS === "web" ? { inert: !active } : {})} style={[styles.content, { display: tab === value ? "flex" : "none" }]}>
          {contents[value]}
        </View>;
      })}
    </Animated.View> : null}
    <Animated.View testID="court-panel-toggle-frame" style={[styles.toggleFrame, { right: mobile ? (width - gripWidth) / 2 : right, top: mobile ? undefined : Math.min(top + 300 * scale, height / 2 + 56 * scale) - 32 * scale, bottom: mobile ? panelBottom ?? bottom : undefined, width: mobile ? gripWidth : 32, height: mobile ? gripHeight : 64, transform: [mobile ? { translateY: motion.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -(panelHeight - panelHeader)] }) } : { translateX: motion.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -(panelWidth + 8) * scale] }) }, { scale }], transformOrigin: "top right" }]}>
      <Pressable suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel={open ? "Recolher controles" : "Abrir controles"} accessibilityState={{ expanded: open }} hitSlop={compactWeb ? { top: 6, bottom: 6 } : undefined} onPress={onToggle} style={({ hovered, pressed }) => [styles.toggle, mobile ? { borderRadius: radius.full, borderWidth: open ? 0 : 1 } : null, { backgroundColor: hovered || pressed ? colors.secondaryBg : mobile && open ? "transparent" : colors.surface, borderColor: colors.border }]}>
        {mobile ? <View pointerEvents="none" style={[styles.grip, compactWeb ? { width: 28 } : null, { backgroundColor: colors.muted }]} /> : <GoAtletaIcon name={open ? "chevronForward" : "chevronBack"} size={16} color={colors.primaryBg} />}
      </Pressable>
    </Animated.View>
  </>;
}

const styles = StyleSheet.create({
  panel: { position: "absolute", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, zIndex: 28 },
  tabs: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.full, padding: 3, marginBottom: 12, overflow: "hidden" },
  tab: { flex: 1, minWidth: 0, minHeight: 26, paddingHorizontal: 4, borderRadius: radius.full, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  content: { flex: 1, minHeight: 0 },
  toggleFrame: { position: "absolute", zIndex: 29 },
  toggle: { width: "100%", height: "100%", borderRadius: radius.internal, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  grip: { width: 36, height: 4, borderRadius: radius.full },
});
