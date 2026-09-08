import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../ui/app-theme";

/** Shared waiting feedback: opacity only, without moving the layout or simulating progress. */
export function AssistantPending({ label, compact = false }: { label: string; compact?: boolean }) {
  const { colors } = useAppTheme();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let alive = true;
    let animation: Animated.CompositeAnimation | undefined;
    const update = (reduce: boolean) => {
      if (!alive) return;
      animation?.stop();
      progress.setValue(0);
      if (reduce) return;
      animation = Animated.loop(Animated.timing(progress, {
        toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: Platform.OS !== "web", isInteraction: false,
      }));
      animation.start();
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => update(true));
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", update);
    return () => { alive = false; animation?.stop(); subscription.remove(); };
  }, [progress]);
  return <View accessible accessibilityLabel={label} accessibilityLiveRegion="polite" accessibilityState={{ busy: true }} style={styles.row}>
    <View style={styles.dots}>
      {[0, 1, 2].map(index => <Animated.View key={index} style={[styles.dot, { backgroundColor: colors.muted,
        opacity: progress.interpolate({ inputRange: [0, 0.15 + index * 0.18, 0.4 + index * 0.18, 1], outputRange: [0.4, 1, 0.4, 0.4] }),
      }]} />)}
    </View>
    {!compact ? <Text style={[styles.label, { color: colors.muted }]}>{label}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  row: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 10 },
  dots: { width: 28, height: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dot: { width: 5, height: 5, borderRadius: 3 },
  label: { fontSize: 13, flexShrink: 1 },
});
