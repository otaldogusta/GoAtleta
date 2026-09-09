import { createElement, useState } from "react";
import { Platform, Text, View } from "react-native";
import { useAppTheme } from "../../ui/app-theme";

export function CourtTimelineScrubber({ progress, durationMs, onSeek }: {
  progress: number; durationMs: number; onSeek: (progress: number) => void;
}) {
  const { colors } = useAppTheme();
  const [width, setWidth] = useState(1);
  const value = Math.max(0, Math.min(1, progress));
  const seconds = (fraction: number) => `${(durationMs * fraction / 1000).toFixed(1).replace(".", ",")} s`;
  return <View style={{ paddingHorizontal: 8, gap: 2 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: colors.muted, fontSize: 11 }}>Tempo da etapa</Text>
      <Text style={{ color: colors.text, fontSize: 11, fontVariant: ["tabular-nums"] }}>{seconds(value)} / {seconds(1)}</Text>
    </View>
    {Platform.OS === "web" ? createElement("input", {
      type: "range", min: 0, max: 1000, step: 1, value: Math.round(value * 1000),
      "aria-label": "Posição da animação", "aria-valuetext": seconds(value),
      onChange: (event: { currentTarget: HTMLInputElement }) => onSeek(Number(event.currentTarget.value) / 1000),
      style: { width: "100%", height: 28, margin: 0, cursor: "ew-resize", accentColor: colors.primaryBg },
    }) : <View accessibilityRole="adjustable" accessibilityLabel="Posição da animação"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100), text: seconds(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={event => onSeek(Math.max(0, Math.min(1, value + (event.nativeEvent.actionName === "increment" ? 0.05 : -0.05))))}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onResponderGrant={event => onSeek(Math.max(0, Math.min(1, event.nativeEvent.locationX / width)))}
      onResponderMove={event => onSeek(Math.max(0, Math.min(1, event.nativeEvent.locationX / width)))}
      style={{ height: 32, justifyContent: "center" }}>
      <View pointerEvents="none" style={{ height: 4, borderRadius: 2, backgroundColor: colors.border }}>
        <View style={{ width: `${value * 100}%`, height: 4, backgroundColor: colors.primaryBg }} />
        <View style={{ position: "absolute", left: `${value * 100}%`, marginLeft: -6, top: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primaryBg }} />
      </View>
    </View>}
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      {[0, 0.25, 0.5, 0.75, 1].map(fraction => <Text key={fraction} style={{ color: colors.muted, fontSize: 10 }}>{seconds(fraction)}</Text>)}
    </View>
  </View>;
}
