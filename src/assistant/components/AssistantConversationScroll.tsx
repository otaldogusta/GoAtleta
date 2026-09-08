import { useEffect, useRef } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, View, type ScrollViewProps } from "react-native";
import { useAppTheme } from "../../ui/app-theme";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { spacing } from "../../theme/tokens";
import { useConversationScroll } from "../hooks/useConversationScroll";

/** Keep reading position when unpinned; follow new content only at the bottom. */
export function AssistantConversationScroll({ children, contentContainerStyle }: Pick<ScrollViewProps, "children" | "contentContainerStyle">) {
  const { colors } = useAppTheme();
  const { scrollRef, showLatest, scrollToLatest, onScroll, onContentSizeChange, onLayout } = useConversationScroll();
  const reduceMotion = useRef(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) reduceMotion.current = value; }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", value => { reduceMotion.current = value; });
    return () => { alive = false; subscription.remove(); };
  }, []);
  return <View style={styles.container}>
    <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled" scrollEventThrottle={16} onScroll={onScroll}
      onContentSizeChange={onContentSizeChange} onLayout={onLayout}>
      {children}
    </ScrollView>
    {showLatest ? <View pointerEvents="box-none" style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Ir para o fim da conversa"
        onPress={() => scrollToLatest(!reduceMotion.current)}
        style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <GoAtletaIcon name="arrowDown" size={20} color={colors.text} />
      </Pressable>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, minWidth: 0 }, scroll: { flex: 1 },
  overlay: { position: "absolute", bottom: spacing.md, left: 0, right: 0, alignItems: "center" },
  button: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
