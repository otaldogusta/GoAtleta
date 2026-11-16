import { useEffect, useRef } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { compactUiMetrics } from "../theme/tokens";
import { OperationalText as Text } from "./OperationalText";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";

export type UnderlineTabItem = { value: string; label: string; id?: string; panelId?: string };

/** The text-and-underline navigation established in the Scouting workspace. */
export function UnderlineTabs({ value, onChange, items, accessibilityLabel, stretch = false, style }: {
  value: string;
  onChange: (value: string) => void;
  items: readonly UnderlineTabItem[];
  accessibilityLabel?: string;
  stretch?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const list = useRef<View>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const node = list.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const tabs = [...node.querySelectorAll<HTMLElement>('[role="tab"]')];
      const index = tabs.indexOf((event.target as HTMLElement).closest<HTMLElement>('[role="tab"]')!);
      if (index < 0 || !tabs.length) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      onChange(items[next].value);
      tabs[next]?.focus();
    };
    node.addEventListener("keydown", handleKey);
    return () => node.removeEventListener("keydown", handleKey);
  }, [items, onChange]);

  return (
    <View ref={list} role="tablist" accessibilityLabel={accessibilityLabel} style={[
      { flexDirection: "row", minWidth: 0, gap: stretch ? 0 : 20, borderBottomWidth: 1, borderBottomColor: colors.border }, style,
    ]}>
      {items.map((item) => (
        <Pressable key={item.value} nativeID={item.id} accessibilityRole="tab" accessibilityLabel={item.label}
          aria-selected={value === item.value} aria-controls={item.panelId}
          accessibilityState={{ selected: value === item.value }} tabIndex={value === item.value ? 0 : -1}
          onPress={() => onChange(item.value)} suppressWebHoverFeedback disableWebPressScale
          style={{ flex: stretch ? 1 : undefined, minWidth: compactUiMetrics.touchTarget, minHeight: compactUiMetrics.touchTarget,
            justifyContent: "center", alignItems: stretch ? "center" : "flex-start", borderRadius: 0,
            borderBottomWidth: 2, marginBottom: -1, borderBottomColor: value === item.value ? colors.primaryBg : "transparent" }}>
          <Text style={{ fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight,
            fontWeight: value === item.value ? "600" : "400", color: value === item.value ? colors.text : colors.muted }}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
