import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { resolveStudentDirectoryStatus } from "../application/student-list-status";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { overlayLayers } from "../../../ui/overlay-layers";
import { radius, spacing } from "../../../theme/tokens";

type Status = ReturnType<typeof resolveStudentDirectoryStatus>;
type Anchor = { x: number; y: number; width: number; height: number };

export function StudentDirectoryStatusBadge({ status }: { status: Status }) {
  const { colors } = useAppTheme();
  const trigger = useRef<View | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const open = () => trigger.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
  const close = () => setAnchor(null);
  const textColor = status.tone === "success" ? colors.successText
    : status.tone === "warning" ? colors.warningText : colors.textMuted ?? colors.muted;
  const borderColor = status.tone === "success" ? colors.successBg
    : status.tone === "warning" ? colors.warningBg : colors.border;
  return (
    <>
      <View ref={trigger} collapsable={false} style={styles.anchor}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Cadastro: ${status.label}`}
        accessibilityHint={status.reason}
        onHoverIn={open}
        onHoverOut={close}
        onFocus={open}
        onBlur={close}
        onPress={(event) => { event.stopPropagation(); open(); }}
        style={styles.trigger}
      >
        <View style={[styles.badge, { borderColor }]}>
          <View style={[styles.dot, { backgroundColor: textColor }]} />
          <Text style={[styles.label, { color: textColor }]}>{status.label}</Text>
        </View>
      </Pressable>
      </View>
      {anchor ? (
        <AnchoredDropdown visible layout={anchor} container={null} animationStyle={undefined}
          zIndex={overlayLayers.floatingList} maxHeight={160} nestedScrollEnabled={false}
          portalToBodyOnWeb interactiveRefs={[trigger]} onRequestClose={close}
          density="popover" fitContent preferredWidth={260} showVerticalScrollIndicator={false}>
          <Text style={[styles.reason, { color: colors.text }]}>{status.reason}</Text>
        </AnchoredDropdown>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  anchor: { alignSelf: "flex-start", maxWidth: "100%" },
  trigger: { alignSelf: "flex-start", minHeight: 40, justifyContent: "center", maxWidth: "100%" },
  badge: { borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "100%" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 10, fontWeight: "800", flexShrink: 1 },
  reason: { fontSize: 12, lineHeight: 18, padding: spacing.sm },
});
