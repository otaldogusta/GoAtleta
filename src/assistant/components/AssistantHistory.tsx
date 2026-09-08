import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../ui/app-theme";
import { Button } from "../../ui/Button";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import type { SavedConversation } from "../conversation-history";
import { radius, shadow, spacing } from "../../theme/tokens";

export function AssistantHistory({ open, items, loading, error, onSelect, onNew, onBack, onRetry }: {
  open: boolean; items: SavedConversation[]; loading: boolean; error: string; onSelect: (entry: SavedConversation) => void; onNew: () => void; onBack: () => void; onRetry: () => void;
}) {
  const { colors } = useAppTheme();
  const [progress] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(open);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {

    const animation = Animated.timing(progress, { toValue: open ? 1 : 0, duration: reduceMotion ? 0 : open ? 240 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" });
    animation.start(({ finished }) => { if (finished && !open) setMounted(false); });
    return () => animation.stop();
  }, [open, progress, reduceMotion]);
  if (open && !mounted) setMounted(true);
  if (!mounted && !open) return null;
  return <View style={styles.overlay} pointerEvents={open ? "auto" : "none"}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]} />
    <Pressable accessibilityRole="button" accessibilityLabel={"Fechar hist\u00f3rico"} onPress={onBack} suppressWebHoverFeedback disableWebPressScale style={StyleSheet.absoluteFill} />
    <Animated.View accessibilityViewIsModal style={[styles.root, { backgroundColor: colors.card, borderColor: colors.border, opacity: progress, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [350, 0] }) }] }]}>
    <View style={styles.toolbar}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{"Hist\u00f3rico"}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Nova conversa" onPress={onNew} style={styles.newConversation}>
        <GoAtletaIcon name="edit" size={22} color={colors.text} />
      </Pressable>
    </View>
    <Text style={{ color: colors.muted }}>Conversas neste dispositivo</Text>
    {error ? <><Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{error}</Text><Button label="Tentar novamente" onPress={onRetry} /></> : null}
    <ScrollView contentContainerStyle={styles.list}>
      {!items.length ? <Text style={{ color: colors.muted }}>{loading ? "Carregando conversas..." : "Nenhuma conversa salva ainda."}</Text> : null}
      {items.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Retomar: ${item.title}`} onPress={() => onSelect(item)} style={[styles.item, { borderColor: colors.border }]}>
        <Text numberOfLines={2} style={{ color: colors.text, fontWeight: "600" }}>{item.title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{new Date(item.updatedAt).toLocaleString("pt-BR")}</Text>
      </Pressable>)}
    </ScrollView>
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({ overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, overflow: "hidden" }, root: { position: "absolute", right: 0, top: 0, bottom: 0, width: "92%", maxWidth: 340, borderWidth: 1, borderRadius: radius.container, padding: spacing.md, gap: spacing.md, ...shadow.elevated }, title: { fontSize: 18, fontWeight: "700" }, backdrop: { backgroundColor: "rgba(0, 0, 0, 0.22)" }, toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }, newConversation: { width: 38, height: 38, borderRadius: radius.full, alignItems: "center", justifyContent: "center" }, list: { gap: spacing.sm }, item: { borderBottomWidth: 1, paddingVertical: spacing.md, gap: spacing.xs } });
