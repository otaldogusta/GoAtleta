import { AttendanceDestinationDialog } from "../../assistant/components/AttendanceDestinationDialog";
import { AssistantHistory } from "../../assistant/components/AssistantHistory";
import { useConversationHistory } from "../../assistant/hooks/useConversationHistory";
import { useRouter } from "expo-router";
import { useConfirmDialog } from "../../ui/confirm-dialog";
import { hasCoordinationAccess } from "../../screens/coordination/coordination-screen-state";
import { resolveReplyDestination } from "../../assistant/reply-destination";
import { getConversationSuggestions } from "../../assistant/conversation-suggestions";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useAuth } from "../../auth/auth";
import { useOrganization } from "../../providers/organization-context";
import { useAppTheme } from "../../ui/app-theme";
import { spacing } from "../../theme/tokens";
import { AssistantComposer } from "../../assistant/components/AssistantComposer";
import { AssistantConversationScroll } from "../../assistant/components/AssistantConversationScroll";
import { AssistantMessages } from "../../assistant/components/AssistantMessages";
import { AssistantPending } from "../../assistant/components/AssistantPending";
import { AssistantWelcome } from "../../assistant/components/AssistantWelcome";
import { useScreenConversation } from "../../assistant/hooks/useScreenConversation";
import type { AssistantModelChoice } from "../../assistant/model-choice";
import type { OperationalSnapshot } from "../operational-context";

type Props = { snapshot: OperationalSnapshot; modelPreference: AssistantModelChoice; onBusyChange: (busy: boolean) => void; onClose: () => void; historyOpen: boolean; onCloseHistory: () => void };

export function CopilotScreenChat(props: Props) {
  const { session } = useAuth();
  const { activeOrganization, organizations, isLoading } = useOrganization();
  if (!session?.user.id || isLoading || !activeOrganization || activeOrganization.role_level < 10) return null;
  return <ScreenConversation key={JSON.stringify([session.user.id, activeOrganization.id, props.snapshot.screen, props.snapshot.contextTitle])}
    {...props} conversationKey={JSON.stringify([session.user.id, activeOrganization.id, props.snapshot.screen, props.snapshot.contextTitle])} canCoordinate={hasCoordinationAccess(organizations, activeOrganization)} organizationId={activeOrganization.id} />;
}

function ScreenConversation({ organizationId, snapshot, modelPreference, onBusyChange, onClose, conversationKey, canCoordinate, historyOpen, onCloseHistory }: Props & { organizationId: string; conversationKey: string; canCoordinate: boolean }) {
  const router = useRouter();
  const [attendanceText, setAttendanceText] = useState<string | null>(null);
  const { confirm } = useConfirmDialog();
  const allowed = useRef(canCoordinate);
  useEffect(() => { allowed.current = canCoordinate; }, [canCoordinate]);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const composerRef = useRef<TextInput | null>(null);
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const chat = useScreenConversation(organizationId, snapshot, modelPreference, conversationKey);
  const history = useConversationHistory(conversationKey, chat.messages, chat.input, chat.busy, chat.historyId);
  const refreshHistory = history.refresh;
  useEffect(() => { if (historyOpen) void refreshHistory(); }, [historyOpen, refreshHistory]);
  useEffect(() => { onBusyChange(chat.busy); return () => onBusyChange(false); }, [chat.busy, onBusyChange]);
  const destination = (text: string) => chat.busy ? null : resolveReplyDestination(text, snapshot, canCoordinate);
  const navigate = (text: string) => {
    const target = destination(text);
    if (!target) return;
    if (target.section === "attendance") { setAttendanceText(text); return; }
    void confirm({ title: `Ir para ${target.label}?`, message: "Voc\u00ea sair\u00e1 do chat para revisar os registros. Sua conversa ser\u00e1 mantida nesta sess\u00e3o.", confirmLabel: "Abrir", cancelLabel: "Cancelar", onConfirm: () => {
      if (!mounted.current || !allowed.current) return;
      chat.remember(history.id);
      onClose();
      router.push({ pathname: "/coord/management", params: { assistantSection: target.section, assistantVisit: String(Date.now()) } });
    } });
  };

  return <View style={styles.content}>
    {attendanceText !== null ? <AttendanceDestinationDialog key={attendanceText} text={attendanceText} organizationId={organizationId} onClose={() => setAttendanceText(null)} onOpen={item => {
      if (!mounted.current || !allowed.current || item.organizationId !== organizationId) return;
      chat.remember(history.id); setAttendanceText(null); onClose();
      router.push({ pathname: "/class/[id]/attendance", params: { id: item.classId, date: item.targetDate } });
    }} /> : null}
    <AssistantConversationScroll contentContainerStyle={styles.messages}>
      {!chat.messages.length ? <View style={styles.welcome}><AssistantWelcome compact={width < 600} suggestions={getConversationSuggestions(`${snapshot.screen ?? ""} ${snapshot.contextTitle ?? ""}`)} onSuggestion={prompt => { chat.setInput(prompt); composerRef.current?.focus(); }} /></View> : null}
      <AssistantMessages onNavigate={navigate} getDestinationLabel={text => { const target = destination(text); return target ? `Ir para ${target.label}. Pedir\u00e1 confirma\u00e7\u00e3o.` : undefined; }} messages={chat.partialReply ? [...chat.messages, { role: "assistant", content: chat.partialReply }] : chat.messages} />
      {chat.busy && !chat.partialReply ? <AssistantPending label="Preparando resposta" compact /> : null}
      {history.error ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{history.error}</Text> : null}
      {chat.error ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{chat.error}</Text> : null}
    </AssistantConversationScroll>
    <View style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <AssistantComposer voiceScope={{ organizationId }} inputRef={composerRef} value={chat.input} onChangeText={chat.setInput} busy={chat.busy} onSend={() => { void chat.send(); }} />
    </View>
    <AssistantHistory open={Boolean(historyOpen)} {...history} onRetry={() => { void history.refresh(); }} onBack={onCloseHistory}
    onNew={() => { history.newConversation(); chat.restore({ messages: [], input: "" }); onCloseHistory(); }}
    onSelect={entry => { history.select(entry); chat.restore(entry); onCloseHistory(); }} />
  </View>;
}

const styles = StyleSheet.create({
  content: { flex: 1, gap: spacing.md, minWidth: 0 },
  messages: { flexGrow: 1, gap: spacing.md, paddingBottom: spacing.md },
  welcome: { flex: 1, justifyContent: "center", paddingVertical: spacing.lg },
  composer: { borderRadius: 28, borderWidth: 1, padding: 10 },
});
