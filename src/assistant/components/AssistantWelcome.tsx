import { StyleSheet, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { compactUiMetrics, spacing } from "../../theme/tokens";
import type { ConversationSuggestion } from "../conversation-suggestions";
import type { ReactNode } from "react";
export function AssistantWelcome({ heading = "Como posso ajudar?", subtitle, compact = false, suggestions = [], onSuggestion }: {
  heading?: string; subtitle?: ReactNode; compact?: boolean; suggestions?: ConversationSuggestion[]; onSuggestion?: (prompt: string) => void;
}) {
  const { colors } = useAppTheme();
  return <View style={styles.root}>
    <View style={styles.icon}>
      <GoAtletaIcon name="assistant" size={18} color={colors.primaryBg} />
    </View>
    <Text style={[styles.heading, { color: colors.text, fontSize: compact ? 18 : 20, lineHeight: compact ? 24 : 26 }]}>{heading}</Text>
    {subtitle ?? <Text style={[styles.subtitle, { color: colors.muted }]}>Hoje, o que você quer resolver?</Text>}
    {onSuggestion && suggestions.length ? <View style={styles.suggestions}>
      {suggestions.map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label}
        onPress={() => onSuggestion(item.prompt)} style={[styles.suggestion, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.suggestionText, { color: colors.text }]}>{item.label}</Text>
      </Pressable>)}
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  suggestions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md, maxWidth: 580, width: "100%" },
  suggestion: { minHeight: 44, maxWidth: "100%", borderWidth: 1, borderRadius: 22, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: "center" },
  suggestionText: { fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight, textAlign: "center", flexShrink: 1 },
  root: { width: "100%", maxWidth: 720, minWidth: 0, alignItems: "center", gap: 8 },
  icon: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  heading: { maxWidth: "100%", flexShrink: 1, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight, textAlign: "center", maxWidth: 580 },
});
