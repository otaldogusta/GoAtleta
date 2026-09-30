import { AssistantHistory } from "../../assistant/components/AssistantHistory";
import { getConversationSuggestions } from "../../assistant/conversation-suggestions";
import { AssistantConversationScroll } from "../../assistant/components/AssistantConversationScroll";
import { useEffect, useRef, useState } from "react";
import type { AssistantModelChoice } from "../../assistant/model-choice";
import { AssistantPending } from "../../assistant/components/AssistantPending";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../../ui/Button";
import { useAppTheme } from "../../ui/app-theme";
import { useAuth } from "../../auth/auth";
import { useOrganization } from "../../providers/organization-context";
import { spacing } from "../../theme/tokens";
import { useUnifiedAssistant } from "../../assistant/UnifiedAssistantProvider";
import { applyLessonDraft } from "../../screens/session/application/apply-lesson-draft";
import { parseLessonDraft } from "../../screens/session/application/lesson-draft";
import { createClientId } from "../../core/client-id";
import { AssistantComposer } from "../../assistant/components/AssistantComposer";
import { AssistantMessages } from "../../assistant/components/AssistantMessages";
import { AssistantWelcome } from "../../assistant/components/AssistantWelcome";
import type { CopilotLessonScope } from "../lesson-context";
type Props = CopilotLessonScope & { appSnapshot?: unknown; modelPreference?: AssistantModelChoice; onBusyChange?: (busy: boolean) => void; historyOpen?: boolean; onCloseHistory?: () => void; historyScope?: string };
const draftIds = new WeakMap<object, string>();

export function CopilotLessonChat(props: Props) {
  const { session } = useAuth();
  const { activeOrganization, isLoading } = useOrganization();
  if (!session?.user.id || isLoading || activeOrganization?.id !== props.organizationId || (activeOrganization?.role_level ?? 0) < 10) return null;
  const scopeKey = JSON.stringify([session.user.id, props.organizationId, props.classId, props.date]);
  return <ConversationContent key={scopeKey} {...props} historyScope={scopeKey} />;
}

function ConversationContent(props: Props) {
  const composerRef = useRef<TextInput | null>(null);
  const { colors } = useAppTheme();
  const unified = useUnifiedAssistant()!;
  const conversation = unified.chat;
  const history = unified.history;
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [saved, setSaved] = useState(false);
  const alive = useRef(true);
  const applyLock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const context = conversation.draftContext;
  const draft = context?.classId === props.classId && context.organizationId === props.organizationId && context.date === props.date ? parseLessonDraft(conversation.draftTraining) : null;
  const chat = { ...conversation, draft, saved, notice: "", error: applyError || conversation.error, busy: applying || conversation.busy };
  const apply = async () => {
    if (!draft || !context || !conversation.draftTraining || applyLock.current || conversation.busy || props.disabled) return;
    applyLock.current = true; setApplying(true); setApplyError("");
    const source = conversation.draftTraining;
    if (!draftIds.has(source)) draftIds.set(source, `plan_assistant_${createClientId()}`);
    try {
      const plan = await applyLessonDraft({ ...props, draft, id: draftIds.get(source)!, expectedPlanId: context.expectedPlanId, isCurrent: () => alive.current });
      if (alive.current) { conversation.clearDraftTraining(); setSaved(true); props.onApplied(plan); }
    } catch (error) { if (alive.current) setApplyError(error instanceof Error ? error.message : "Não foi possível aplicar. Tente novamente."); }
    finally { applyLock.current = false; if (alive.current) setApplying(false); }
  };
  const refreshHistory = history.refresh;
  useEffect(() => { if (props.historyOpen) void refreshHistory(); }, [props.historyOpen, refreshHistory]);
  const onBusyChange = props.onBusyChange;
  useEffect(() => { onBusyChange?.(chat.busy); return () => onBusyChange?.(false); }, [chat.busy, onBusyChange]);
  const locked = chat.busy || Boolean(props.disabled);

  return <View style={styles.content}>
    <AssistantConversationScroll persistent contentContainerStyle={styles.messages}>
    {!chat.messages.length ? <View style={styles.welcome}><AssistantWelcome compact suggestions={getConversationSuggestions("", true)} onSuggestion={prompt => { chat.setInput(prompt); composerRef.current?.focus(); }} /></View> : null}
    <AssistantMessages messages={chat.partialReply ? [...chat.messages, { role: "assistant", content: chat.partialReply }] : chat.messages} />
    {chat.busy && !chat.partialReply ? <AssistantPending label="Preparando resposta" compact /> : null}
    {history.error ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{history.error}</Text> : null}
    {chat.error ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{chat.error}</Text> : null}
    {chat.notice ? <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>{chat.notice}</Text> : null}
    {chat.draft ? <View style={[styles.preview, { borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>{chat.draft.title}</Text>
      {(["warmup", "main", "cooldown"] as const).map((key, index) => <View key={key} style={styles.message}>
        <Text style={[styles.label, { color: colors.text }]}>{["Aquecimento", "Parte principal", "Volta à calma"][index]} · {chat.draft![`${key}Time`]}</Text>
        {chat.draft![key].map((item, i) => <Text key={i} style={{ color: colors.text }}>{i + 1}. {item}</Text>)}
      </View>)}
      <Text style={{ color: colors.muted }}>{props.currentPlanId ? "Será criada uma nova versão para este dia. A versão anterior será preservada." : "Este plano será aplicado apenas à data acima."} Para ajustar, continue a conversa antes de aplicar.</Text>
      <Button label="Aplicar à aula do dia" onPress={() => { void apply(); }} disabled={locked} />
    </View> : null}
    {chat.saved ? <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>Plano aplicado.</Text> : null}
    </AssistantConversationScroll>
    <View style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <AssistantComposer compact inputRef={composerRef} value={chat.input} onChangeText={chat.setInput} busy={locked}
        onSend={() => { setSaved(false); void chat.send(); }} voiceScope={{ organizationId: props.organizationId, classId: props.classId }} />
    </View>
    <AssistantHistory open={Boolean(props.historyOpen)} {...history} onRetry={() => { void history.refresh(); }} onBack={() => props.onCloseHistory?.()}
    onNew={() => { history.newConversation(); chat.restore({ messages: [], input: "" }); props.onCloseHistory?.(); }}
    onSelect={entry => { history.select(entry); chat.restore(entry); props.onCloseHistory?.(); }} />
  </View>;
}
const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  content: { flex: 1, gap: spacing.md, minWidth: 0 },
  messages: { flexGrow: 1, gap: 12, paddingBottom: 12 },
  welcome: { flex: 1, justifyContent: "center", paddingVertical: 24 },
  composer: { borderRadius: 28, borderWidth: 1, padding: 10 },
  message: { gap: spacing.sm }, label: { fontWeight: "600" },
  preview: { borderTopWidth: 1, padding: spacing.md, gap: spacing.md },
});
