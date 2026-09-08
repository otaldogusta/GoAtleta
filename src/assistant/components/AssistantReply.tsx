import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../ui/app-theme";
import { spacing } from "../../theme/tokens";
import { parseReplyBlocks, parseReplyEmphasis } from "../reply-format";

export function AssistantReply({ content, onNavigate, getDestinationLabel }: { content: string; onNavigate?: (text: string) => void; getDestinationLabel?: (text: string) => string | undefined }) {
  const { colors } = useAppTheme();
  return <View style={styles.content}>
    {parseReplyBlocks(content).map((block, index) => <View key={index} style={styles.row}>
      {block.marker ? <Text selectable style={[styles.marker, { color: colors.muted }]}>{block.marker}</Text> : null}
      <Text selectable accessibilityRole={block.marker && getDestinationLabel?.(block.text) ? "link" : block.kind === "heading" ? "header" : undefined}
        accessibilityHint={block.marker ? getDestinationLabel?.(block.text) : undefined}
        onPress={block.marker && getDestinationLabel?.(block.text) ? () => onNavigate?.(block.text) : undefined}
        style={[styles.text, block.kind === "heading" && styles.heading, { color: colors.text }, block.marker && getDestinationLabel?.(block.text) ? styles.link : undefined]}>
        {parseReplyEmphasis(block.text).map((part, partIndex) => <Text key={partIndex} style={part.bold ? styles.bold : undefined}>{part.text}</Text>)}
      </Text>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  link: { textDecorationLine: "underline" },
  content: { gap: spacing.sm, minWidth: 0 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, minWidth: 0 },
  text: { fontSize: 14, lineHeight: 22, flexShrink: 1, minWidth: 0 },
  marker: { fontSize: 14, lineHeight: 22, minWidth: 14 },
  heading: { fontSize: 15, fontWeight: "700", marginTop: 4 },
  bold: { fontWeight: "700" },
});
