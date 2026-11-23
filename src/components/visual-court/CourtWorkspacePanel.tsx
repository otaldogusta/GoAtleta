import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { Animated, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { compactUiMetrics, radius, shadow, spacing } from "../../theme/tokens";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useDisclosureMotion } from "../../ui/useDisclosureMotion";
import { mobileCourtChrome } from "./court-overlay-layout";

export type CourtWorkspaceTab = "adjustments" | "steps" | "library" | "tools";

type Props = {
  open: boolean;
  onToggle: () => void;
  onRequestClose: () => void;
  tab: CourtWorkspaceTab;
  onTabChange: (tab: CourtWorkspaceTab) => void;
  adjustments: ReactNode;
  steps: ReactNode;
  library: ReactNode;
  tools?: ReactNode;
  triggerRef?: RefObject<View | null>;
  dialogId?: string;
  disabled?: boolean;
  readOnly?: boolean;
  hideLibrary?: boolean;
  uiScale?: number;
  top?: number;
  bottom?: number;
};

const TABS = [
  ["adjustments", "Ajustes"],
  ["steps", "Etapas"],
  ["library", "Biblioteca"],
] as const;
const TABS_WITH_TOOLS = [...TABS, ["tools", "Ferramentas"]] as const;
const TABBABLE = 'button, [href], input, select, textarea, [tabindex], [contenteditable="true"]';

function canTabTo(element: HTMLElement) {
  return element.tabIndex >= 0 && !element.matches(':disabled, [aria-disabled="true"]') &&
    !element.closest('[inert], [aria-hidden="true"]') && element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility === "visible";
}

function useCourtSheetFocus(open: boolean, dialogId: string, onRequestClose: () => void, triggerRef?: RefObject<View | null>) {
  const close = useRef(onRequestClose);
  useLayoutEffect(() => { close.current = onRequestClose; }, [onRequestClose]);
  useLayoutEffect(() => {
    if (!open || typeof document === "undefined") return;
    const dialog = document.getElementById(dialogId);
    const workspace = dialog?.parentElement;
    if (!dialog || !workspace) return;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const trigger = triggerRef?.current as unknown as HTMLElement | null | undefined;
    const disabledSiblings = new Set<HTMLElement>();
    const blockBackground = () => {
      for (const sibling of Array.from(workspace.children)) {
        if (!(sibling instanceof HTMLElement) || sibling === dialog || sibling.hasAttribute("data-court-sheet-backdrop") || sibling.inert) continue;
        sibling.inert = true;
        disabledSiblings.add(sibling);
      }
    };
    const selected = dialog.querySelector<HTMLElement>('[data-court-sheet-tab][aria-selected="true"]:not([aria-disabled="true"])');
    (selected ?? dialog.querySelector<HTMLElement>("[data-court-sheet-close]") ?? dialog).focus({ preventScroll: true });
    blockBackground();
    const observer = new MutationObserver(blockBackground);
    observer.observe(workspace, { childList: true });

    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close.current();
        return;
      }
      const activeElement = document.activeElement;
      if (activeElement?.matches("[data-court-sheet-tab]") && dialog.contains(activeElement) &&
          ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        const tabs = Array.from(dialog.querySelectorAll<HTMLElement>("[data-court-sheet-tab]")).filter(tab => !tab.matches('[aria-disabled="true"], :disabled'));
        const index = tabs.findIndex(tab => tab === activeElement);
        const offset = event.key === "ArrowLeft" ? -1 : 1;
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + tabs.length + offset) % tabs.length;
        const nextTab = tabs[next];
        if (nextTab) {
          event.preventDefault();
          nextTab.click();
          nextTab.focus({ preventScroll: true });
        }
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(TABBABLE)).filter(canTabTo);
      const index = items.findIndex(item => item === activeElement);
      if (index !== -1 && (event.shiftKey ? index > 0 : index < items.length - 1)) return;
      event.preventDefault();
      (items[event.shiftKey ? items.length - 1 : 0] ?? dialog).focus({ preventScroll: true });
    };
    document.addEventListener("keydown", keydown);

    return () => {
      document.removeEventListener("keydown", keydown);
      observer.disconnect();
      for (const sibling of disabledSiblings) sibling.inert = false;
      let returnTo = previous && canTabTo(previous) ? previous : null;
      if (!returnTo && trigger?.isConnected) {
        returnTo = canTabTo(trigger) ? trigger : Array.from(trigger.querySelectorAll<HTMLElement>(TABBABLE)).find(candidate => candidate.getAttribute("aria-controls") === dialogId && canTabTo(candidate)) ?? null;
      }
      returnTo?.focus({ preventScroll: true });
    };
  }, [open, dialogId, triggerRef]);
}

/** Shares one disclosure surface while retaining each tab's local view state. */
export function CourtWorkspacePanel({ open, onToggle, onRequestClose, tab, onTabChange, adjustments, steps, library, tools, triggerRef, dialogId = "court-workspace-sheet", disabled = false, readOnly = false, hideLibrary = false, uiScale = 1, top = 144, bottom = 88 }: Props) {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const mobile = width <= 700;
  const compactWeb = mobile && Platform.OS === "web";
  const scale = mobile ? 1 : uiScale;
  const motion = useDisclosureMotion(open, { axis: mobile ? "y" : "x", distance: 24, duration: 200 });
  const centered = tab === "library";
  const panelWidth = centered ? Math.min(560, width - 24) : mobile ? Math.min(440, width - 24) : 360;
  const panelBottom = mobile ? compactWeb ? bottom : Math.max(bottom, width < 460 ? 120 : bottom) : undefined;
  const panelHeight = Math.max(160, Math.min(compactWeb ? Math.min(380, height * .62) : 600, mobile ? height - top - (panelBottom ?? bottom) : (height - top - bottom) / scale));
  const libraryHeight = Math.min(540, height * .82);
  const gripWidth = compactWeb ? mobileCourtChrome.gripWidth : 80;
  const gripHeight = compactWeb ? mobileCourtChrome.gripHeight : 40;
  const panelHeader = compactWeb ? 32 : 44;
  const right = mobile ? (width - panelWidth) / 2 : 20 * scale;
  const hasTools = tools != null && !readOnly;
  const modal = hasTools || centered;
  const webDialog = modal && Platform.OS === "web";
  const stackSheetHeader = hasTools && width < 380;
  const tabs = (hasTools ? TABS_WITH_TOOLS : TABS).filter(([value]) => !hideLibrary || value !== "library");
  const contents = { adjustments, steps, library, tools };
  useCourtSheetFocus(webDialog && open, dialogId, onRequestClose, triggerRef);
  const tabList = (
    <View accessibilityRole="tablist" accessibilityLabel="Áreas da jogada" style={[styles.tabs, modal && (stackSheetHeader ? styles.stackedSheetTabs : styles.sheetTabs), { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
      {tabs.map(([value, label]) => {
        const unavailable = disabled || (readOnly && value === "library");
        return <Pressable suppressWebHoverFeedback disableWebPressScale key={value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: tab === value, disabled: unavailable }} aria-selected={tab === value} {...(webDialog ? { nativeID: `${dialogId}-tab-${value}`, "aria-controls": `${dialogId}-${value}`, tabIndex: !unavailable && tab === value ? 0 : -1, dataSet: { courtSheetTab: value } } : {})} disabled={unavailable} onPress={() => { if (!unavailable) onTabChange(value); }} style={({ hovered, pressed }) => [styles.tab, hasTools ? styles.sheetTab : mobile ? { minHeight: compactWeb ? 28 : 36 } : null, { backgroundColor: tab === value ? colors.primaryBg : hovered || pressed ? colors.secondaryBg : "transparent", opacity: disabled ? 0.55 : 1 }]}>
          <Text numberOfLines={1} style={{ color: tab === value ? colors.primaryText : colors.muted, fontSize: compactWeb ? 11 : 12, fontWeight: mobile && tab === value ? "600" : "400" }}>{label}</Text>
        </Pressable>;
      })}
    </View>
  );

  return <>
    {open ? <Pressable accessibilityRole={modal ? undefined : "button"} accessibilityLabel={modal ? undefined : "Fechar controles da jogada"} aria-hidden={modal || undefined} focusable={modal ? false : undefined} {...(webDialog ? { tabIndex: -1, dataSet: { courtSheetBackdrop: "true" } } : {})} suppressWebHoverFeedback disableWebPressScale onPress={onRequestClose} style={[styles.backdrop, centered && { backgroundColor: "rgba(0,0,0,0.5)", zIndex: 59 }]} /> : null}
    {motion.mounted ? <Animated.View accessibilityLabel={centered ? "Biblioteca da quadra" : "Painel da jogada"} accessibilityViewIsModal={centered && open} {...(modal ? { nativeID: dialogId, role: "dialog", "aria-modal": open, tabIndex: -1 } : {})} pointerEvents={open ? "auto" : "none"} accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"} aria-hidden={!open} {...(Platform.OS === "web" ? { inert: !open } : {})} style={[styles.panel, { width: panelWidth, height: panelHeight, right, top: mobile ? undefined : top, bottom: panelBottom, paddingTop: hasTools ? spacing.xs : mobile ? panelHeader : 14, paddingHorizontal: compactWeb ? 12 : 16, opacity: motion.style.opacity, transform: [...motion.style.transform, { scale }], transformOrigin: "top right", borderColor: colors.border, backgroundColor: colors.surface }, centered && { zIndex: 60, height: libraryHeight, right: (width - panelWidth) / 2, top: (height - libraryHeight) / 2, bottom: undefined, transform: motion.style.transform }, shadow.elevated]}>
      {modal ? <View style={[styles.sheetHeader, stackSheetHeader && styles.stackedSheetHeader]}>
        {centered ? <Text accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: "600" }}>Biblioteca</Text> : tabList}
        <Pressable accessibilityRole="button" accessibilityLabel={centered ? "Fechar Biblioteca" : "Fechar controles da jogada"} {...(webDialog ? { dataSet: { courtSheetClose: "true" } } : {})} suppressWebHoverFeedback disableWebPressScale onPress={onRequestClose} style={({ hovered, pressed }) => [styles.close, { backgroundColor: hovered || pressed ? colors.secondaryBg : "transparent" }]}>
          <GoAtletaIcon name="close" size={compactUiMetrics.iconSize} color={colors.text} />
        </Pressable>
      </View> : tabList}
      {tabs.map(([value, label]) => {
        const active = open && tab === value;
        return <View key={value} accessibilityLabel={`Conteúdo: ${label}`} {...(webDialog && !centered ? { nativeID: `${dialogId}-${value}`, role: "tabpanel", "aria-labelledby": `${dialogId}-tab-${value}` } : {})} pointerEvents={active ? "auto" : "none"} accessibilityElementsHidden={!active} importantForAccessibility={active ? "auto" : "no-hide-descendants"} aria-hidden={!active} {...(Platform.OS === "web" ? { inert: !active } : {})} style={[styles.content, { display: tab === value ? "flex" : "none" }]}>
          {contents[value]}
        </View>;
      })}
    </Animated.View> : null}
    {!modal && (!readOnly || open) ? <Animated.View testID="court-panel-toggle-frame" style={[styles.toggleFrame, { right: mobile ? (width - gripWidth) / 2 : right, top: mobile ? undefined : Math.min(top + 300 * scale, height / 2 + 56 * scale) - 32 * scale, bottom: mobile ? panelBottom ?? bottom : undefined, width: mobile ? gripWidth : 32, height: mobile ? gripHeight : 64, transform: [mobile ? { translateY: motion.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -(panelHeight - panelHeader)] }) } : { translateX: motion.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -(panelWidth + 8) * scale] }) }, { scale }], transformOrigin: "top right" }]}>
      <Pressable suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel={open ? "Recolher controles" : "Abrir controles"} accessibilityState={{ expanded: open }} hitSlop={compactWeb ? { top: 6, bottom: 6 } : undefined} onPress={onToggle} style={({ hovered, pressed }) => [styles.toggle, mobile ? { borderRadius: radius.full, borderWidth: open ? 0 : 1 } : null, { backgroundColor: hovered || pressed ? colors.secondaryBg : mobile && open ? "transparent" : colors.surface, borderColor: colors.border }]}>
        {mobile ? <View pointerEvents="none" style={[styles.grip, compactWeb ? { width: 28 } : null, { backgroundColor: colors.muted }]} /> : <GoAtletaIcon name={open ? "chevronForward" : "chevronBack"} size={16} color={colors.primaryBg} />}
      </Pressable>
    </Animated.View> : null}
  </>;
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 27, backgroundColor: "transparent" },
  panel: { position: "absolute", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, zIndex: 28 },
  tabs: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.full, padding: 3, marginBottom: 12, overflow: "hidden" },
  tab: { flex: 1, minWidth: 0, minHeight: 26, paddingHorizontal: 4, borderRadius: radius.full, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.xs },
  stackedSheetHeader: { flexDirection: "column-reverse", alignItems: "flex-end", gap: 0 },
  sheetTabs: { flex: 1, marginBottom: 0 },
  stackedSheetTabs: { alignSelf: "stretch", marginBottom: 0 },
  sheetTab: { minHeight: compactUiMetrics.touchTarget, paddingHorizontal: 2 },
  close: { width: compactUiMetrics.touchTarget, height: compactUiMetrics.touchTarget, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: radius.full },
  content: { flex: 1, minHeight: 0 },
  toggleFrame: { position: "absolute", zIndex: 29 },
  toggle: { width: "100%", height: "100%", borderRadius: radius.internal, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  grip: { width: 36, height: 4, borderRadius: radius.full },
});
