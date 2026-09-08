import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../ui/app-theme";
import { AssistantReply } from "./AssistantReply";
export function AssistantMessages({ messages, onNavigate, getDestinationLabel }: { onNavigate?: (text: string) => void; getDestinationLabel?: (text: string) => string | undefined; messages: { role: "user" | "assistant"; content: string }[] }) {
  const { colors } = useAppTheme();
  return <>{messages.map((message, index) => <View key={index}
    style={[styles.bubble, { alignSelf: message.role === "user" ? "flex-end" : "flex-start", backgroundColor: message.role === "user" ? colors.primaryBg : colors.background, borderColor: colors.border }]}>
    {message.role === "assistant" ? <AssistantReply content={message.content} onNavigate={onNavigate} getDestinationLabel={getDestinationLabel} /> :
      <Text selectable style={{ color: colors.primaryText }}>{message.content}</Text>}
  </View>)}</>;
}
const styles = StyleSheet.create({ bubble: { maxWidth: "85%", padding: 12, borderRadius: 16, borderWidth: 1 } });
