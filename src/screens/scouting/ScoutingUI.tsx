import { useEffect, useLayoutEffect, useRef, type PropsWithChildren } from "react";
import { Platform, ScrollView, Text, TextInput, View, useWindowDimensions, type TextInputProps } from "react-native";
import { useAppTheme } from "../../ui/app-theme";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { ModalSheet } from "../../ui/ModalSheet";
import { useModalCardStyle } from "../../ui/use-modal-card-style";
import { scoutingActionFundamentals } from "../../core/scouting";

export const skillLabel = (id: string) => scoutingActionFundamentals.find(f => f.id === id)?.label ?? id;
export const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
export const amount = (n: number, singular: string, plural = `${singular}s`) => `${n} ${n === 1 ? singular : plural}`;
export function Copy({ children, muted, title }: PropsWithChildren<{ muted?: boolean; title?: boolean }>) {
  const { colors } = useAppTheme();
  return <Text style={{ color: muted ? colors.muted : colors.text, fontSize: title ? 18 : muted ? 12 : 14, lineHeight: title ? 25 : 21, fontWeight: title ? "700" : "400" }}>{children}</Text>;
}
export function Choice({ label, accessibilityLabel, nativeID, selected, disabled, onPress, compact = false }: { label: string; accessibilityLabel?: string; nativeID?: string; selected?: boolean; disabled?: boolean; onPress: () => void; compact?: boolean }) {
  const { colors } = useAppTheme();
  return <Pressable nativeID={nativeID} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected: !!selected, disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={{ maxWidth: "100%", flexShrink: 1, minHeight: compact ? 38 : 44, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1,
      borderColor: selected ? colors.primaryBg : colors.border, backgroundColor: selected ? colors.secondaryBg : "transparent", opacity: disabled ? .55 : 1, justifyContent: "center" }}>
    <Text style={{ color: colors.text, fontSize: 14, fontWeight: selected ? "700" : "400" }}>{label}</Text>
  </Pressable>;
}
export function Link({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useAppTheme();
  return <Pressable suppressWebHoverFeedback accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ minHeight: 38, justifyContent: "center", opacity: disabled ? .55 : 1 }}>
    <Text style={{ color: colors.muted, fontSize: 12, textDecorationLine: "underline" }}>{label}</Text>
  </Pressable>;
}
export function Input({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useAppTheme();
  return <View style={{ gap: 8, flex: 1 }}><Copy>{label}</Copy><View style={{ minHeight: 50, borderRadius: 12, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg }}>
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor={colors.muted} style={{ borderRadius: 0, minHeight: 48, color: colors.text, fontSize: 14, outlineWidth: 0 } as TextInputProps["style"]} />
  </View></View>;
}
export function ErrorNotice({ text }: { text: string }) {
  const { colors } = useAppTheme();
  return text ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{ color: colors.dangerText, fontSize: 13, lineHeight: 20 }}>{text}</Text> : null;
}
export function ScoutingModal({ title, subtitle, onClose, children, footer, summary }: PropsWithChildren<{ title: string; subtitle?: string; onClose: () => void; footer?: React.ReactNode; summary?: React.ReactNode }>) {
  const { colors } = useAppTheme();
  const { height, width } = useWindowDimensions();
  const card = useModalCardStyle({ maxWidth: 680, padding: 0, gap: 0 });
  const root = useRef<View>(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const node = root.current as unknown as HTMLElement | null;
    if (!node?.querySelectorAll) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(node.querySelectorAll<HTMLElement>('button,[role="button"],[href],input,textarea,select,[tabindex="0"]')).filter(el => el.getAttribute("aria-disabled") !== "true" && !el.hasAttribute("disabled") && el.getClientRects().length > 0);
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const items = focusable(); const first = items[0]; const last = items[items.length - 1];
      if (!items.length) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown, true);
    return () => { document.removeEventListener("keydown", keydown, true); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <ModalSheet visible onClose={onClose} position="center" containerPadding={width < 520 ? 8 : 20}
    cardStyle={[card, { height: Math.min(730, height - 32), maxHeight: "96%", paddingBottom: 0, marginBottom: 0, overflow: "hidden" }]}>
    <View ref={root} role="dialog" aria-modal={true} accessibilityLabel={title} style={{ flex: 1, minHeight: 0 }}>
      <View style={{ flexDirection: "row", gap: 16, padding: 20, alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flex: 1, gap: 3 }}><Copy title>{title}</Copy>{subtitle ? <Copy muted>{subtitle}</Copy> : null}</View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar análise" onPress={onClose} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, justifyContent: "center", alignItems: "center" }}><GoAtletaIcon name="close" size={18} color={colors.text} /></Pressable>
      </View>
      {summary ? <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>{summary}</View> : null}
      <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      {footer ? <View style={{ padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: colors.border }}>{footer}</View> : null}
    </View>
  </ModalSheet>;
}
