import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../ui/app-theme";
import { AssistantReply } from "./AssistantReply";

export type AssistantMessageReportLink = {
  classId: string;
  className: string;
  sessionDate: string;
  leadingText?: string;
  trailingText?: string;
};

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
  reportLink?: AssistantMessageReportLink;
};

export function AssistantMessages({ messages, onNavigate, getDestinationLabel, onOpenReport, resolveReportLink }: {
  onNavigate?: (text: string) => void;
  getDestinationLabel?: (text: string) => string | undefined;
  onOpenReport?: (report: AssistantMessageReportLink) => void;
  resolveReportLink?: (content: string) => AssistantMessageReportLink | undefined;
  messages: AssistantMessage[];
}) {
  const { colors } = useAppTheme();
  return <>{messages.map((message, index) => {
    const reportLink = message.reportLink ?? resolveReportLink?.(message.content);
    return <View key={index}
      style={[styles.bubble, { alignSelf: message.role === "user" ? "flex-end" : "flex-start", backgroundColor: message.role === "user" ? colors.primaryBg : colors.background, borderColor: colors.border }]}>
    {message.role === "assistant" && reportLink && onOpenReport ? (
      <Text selectable style={[styles.savedReportText, { color: colors.text }]}>
        {reportLink.leadingText ?? "Relatório da "}
        <Text
          accessibilityRole="link"
          accessibilityLabel={`Abrir relatório da turma ${reportLink.className}`}
          accessibilityHint="Abre o relatório desta aula"
          onPress={() => onOpenReport(reportLink)}
          style={[styles.reportLink, { color: colors.text }]}
        >
          {reportLink.className}
        </Text>
        {reportLink.trailingText ?? ` salvo em ${message.content.split(" salvo em ")[1] ?? reportLink.sessionDate}`}
      </Text>
    ) : message.role === "assistant" ? <AssistantReply content={message.content} onNavigate={onNavigate} getDestinationLabel={getDestinationLabel} /> :
      <Text selectable style={{ color: colors.primaryText }}>{message.content}</Text>}
    </View>;
  })}</>;
}
const styles = StyleSheet.create({
  bubble: { maxWidth: "85%", padding: 12, borderRadius: 16, borderWidth: 1 },
  savedReportText: { fontSize: 14, lineHeight: 22 },
  reportLink: { fontWeight: "700", textDecorationLine: "underline" },
});
