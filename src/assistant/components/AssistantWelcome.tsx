import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { spacing } from "../../theme/tokens";
import type { ConversationSuggestion } from "../conversation-suggestions";
import type { ReactNode } from "react";
export function AssistantWelcome({ heading = "Como posso ajudar?", subtitle, compact = false, suggestions = [], onSuggestion }: {
  heading?: string; subtitle?: ReactNode; compact?: boolean; suggestions?: ConversationSuggestion[]; onSuggestion?: (prompt: string) => void;
}) {
  const { colors } = useAppTheme();
  return <View style={styles.root}>
    <View style={styles.icon}>
      <GoAtletaIcon name="assistant" size={26} color={colors.primaryBg} />
    </View>
    <Text style={[styles.heading, { color: colors.text, fontSize: compact ? 28 : 42 }]}>{heading}</Text>
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
  suggestionText: { fontSize: 13, textAlign: "center", flexShrink: 1 },
  root: { alignItems: "center", gap: 10 },
  icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  heading: { fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 16, textAlign: "center", maxWidth: 580 },
});
