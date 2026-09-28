import { usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";

import { useAuth } from "../../auth/auth";
import { AttendanceDestinationDialog } from "../../assistant/components/AttendanceDestinationDialog";
import { AssistantClassSelector } from "../../assistant/components/AssistantClassSelector";
import { AssistantComposer } from "../../assistant/components/AssistantComposer";
import { AssistantConversationScroll } from "../../assistant/components/AssistantConversationScroll";
import { AssistantHistory } from "../../assistant/components/AssistantHistory";
import { AssistantMessages } from "../../assistant/components/AssistantMessages";
import { AssistantModelSelector } from "../../assistant/components/AssistantModelSelector";
import { AssistantPending } from "../../assistant/components/AssistantPending";
import { AssistantTrainingDraftCard } from "../../assistant/components/AssistantTrainingDraftCard";
import { AssistantWelcome } from "../../assistant/components/AssistantWelcome";
import { getConversationSuggestions } from "../../assistant/conversation-suggestions";
import { useConversationHistory } from "../../assistant/hooks/useConversationHistory";
import { useScreenConversation } from "../../assistant/hooks/useScreenConversation";
import type { AssistantModelChoice } from "../../assistant/model-choice";
import { resolveReplyDestination } from "../../assistant/reply-destination";
import type { ClassGroup } from "../../core/models";
import { getClasses } from "../../db/seed";
import { useOrganization } from "../../providers/organization-context";
import { hasCoordinationAccess } from "../../screens/coordination/coordination-screen-state";
import { spacing } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";
import { useConfirmDialog } from "../../ui/confirm-dialog";
import type { OperationalSnapshot } from "../operational-context";

type Props = {
  snapshot: OperationalSnapshot;
  modelPreference: AssistantModelChoice;
  onModelPreferenceChange: (value: AssistantModelChoice) => void;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
  historyOpen: boolean;
  onCloseHistory: () => void;
};

export function CopilotScreenChat(props: Props) {
  const { session } = useAuth();
  const { activeOrganization, organizations, isLoading } = useOrganization();
  if (!session?.user.id || isLoading || !activeOrganization || activeOrganization.role_level < 10) return null;
  const contextualClassId = String(
    props.snapshot.operationalFacts.find(fact => fact.key === "planning_class_id")?.value ?? "",
  ).trim();
  const conversationKey = JSON.stringify([
    session.user.id,
    activeOrganization.id,
    props.snapshot.screen,
    props.snapshot.contextTitle,
    contextualClassId,
  ]);
  return <ScreenConversation key={conversationKey} {...props} conversationKey={conversationKey}
    canCoordinate={hasCoordinationAccess(organizations, activeOrganization)} organizationId={activeOrganization.id} />;
}

function ScreenConversation({ organizationId, snapshot, modelPreference, onModelPreferenceChange, onBusyChange, onClose, conversationKey, canCoordinate, historyOpen, onCloseHistory }: Props & { organizationId: string; conversationKey: string; canCoordinate: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [attendanceText, setAttendanceText] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [classId, setClassId] = useState("");
  const { confirm } = useConfirmDialog();
  const allowed = useRef(canCoordinate);
  useEffect(() => { allowed.current = canCoordinate; }, [canCoordinate]);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const composerRef = useRef<TextInput | null>(null);
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isPlanning = snapshot.screen === "planning";
  const isPeriodization = snapshot.screen === "periodization" || snapshot.screen === "periodization_index";
  const hasClassContext = isPlanning || isPeriodization;

  useEffect(() => {
    if (!hasClassContext) return;
    let active = true;
    void getClasses().then(items => {
      if (!active) return;
      const contextClassId = String(snapshot.operationalFacts.find(fact => fact.key === "planning_class_id")?.value ?? "").trim();
      const contextClassName = String(snapshot.operationalFacts.find(fact => fact.key === "planning_class")?.value ?? "").trim();
      const contextualClass =
        items.find(item => item.id === contextClassId) ??
        items.find(item => item.name.trim().toLocaleLowerCase("pt-BR") === contextClassName.toLocaleLowerCase("pt-BR"));
      setClasses(items);
      setClassId(current => current || contextualClass?.id || items[0]?.id || "");
    }).catch(() => { if (active) setClasses([]); });
    return () => { active = false; };
  }, [hasClassContext, snapshot.operationalFacts]);

  const selectedClass = classes.find(item => item.id === classId) ?? classes[0];
  const chat = useScreenConversation(organizationId, snapshot, modelPreference, conversationKey, hasClassContext ? {
    classId: selectedClass?.id,
    sport: selectedClass?.modality || "volleyball",
    lessonAction: isPlanning ? "auto" : undefined,
  } : undefined);
  const history = useConversationHistory(conversationKey, chat.messages, chat.input, chat.busy, chat.historyId);
  const refreshHistory = history.refresh;
  useEffect(() => { if (historyOpen) void refreshHistory(); }, [historyOpen, refreshHistory]);
  useEffect(() => { onBusyChange(chat.busy); return () => onBusyChange(false); }, [chat.busy, onBusyChange]);

  const destination = (text: string) => chat.busy ? null : resolveReplyDestination(text, snapshot, canCoordinate);
  const navigate = (text: string) => {
    const target = destination(text);
    if (!target) return;
    if (target.section === "attendance") { setAttendanceText(text); return; }
    void confirm({ title: `Ir para ${target.label}?`, message: "Você sairá do chat para revisar os registros. Sua conversa será mantida nesta sessão.", confirmLabel: "Abrir", cancelLabel: "Cancelar", onConfirm: () => {
      if (!mounted.current || !allowed.current) return;
      chat.remember(history.id);
      onClose();
      router.push({ pathname: "/coord/management", params: { assistantSection: target.section, assistantVisit: String(Date.now()) } });
    } });
  };
  const planningSuggestions = useMemo(() => [
    { label: "Montar plano de 60 min", prompt: `Monte um plano de aula completo de 60 minutos para ${selectedClass?.name || "a turma selecionada"}, com aquecimento, parte principal e volta à calma.` },
    { label: "Transformar minha ideia em plano", prompt: "Quero descrever uma ideia de aula. Faça as perguntas necessárias e transforme minha ideia em um plano completo." },
    { label: "Adaptar o plano atual", prompt: "Analise o plano aberto e proponha uma versão adaptada para a turma, mantendo o objetivo principal." },
  ], [selectedClass?.name]);
  const applyDraft = () => {
    if (!chat.draftTraining || !selectedClass?.id) return;
    chat.remember(history.id);
    onClose();
    router.replace({ pathname: pathname as never, params: {
      openForm: "1",
      targetClassId: selectedClass.id,
      aiDraft: encodeURIComponent(JSON.stringify(chat.draftTraining)),
    } });
  };

  return <View style={styles.content}>
    {attendanceText !== null ? <AttendanceDestinationDialog key={attendanceText} text={attendanceText} organizationId={organizationId} onClose={() => setAttendanceText(null)} onOpen={item => {
      if (!mounted.current || !allowed.current || item.organizationId !== organizationId) return;
      chat.remember(history.id); setAttendanceText(null); onClose();
      router.push({ pathname: "/class/[id]/attendance", params: { id: item.classId, date: item.targetDate } });
    }} /> : null}
    <AssistantConversationScroll contentContainerStyle={styles.messages}>
      {!chat.messages.length ? <View style={styles.welcome}><AssistantWelcome
        heading={isPlanning ? "Vamos montar seu plano?" : undefined}
        compact={width < 600}
        subtitle={isPlanning && classes.length ? <AssistantClassSelector classes={classes} value={classId} onChange={setClassId} normalizeLabel={name => name.replace(/^turma\s+/i, "").trim()} inlinePrompt /> : undefined}
        suggestions={isPlanning ? planningSuggestions : getConversationSuggestions(`${snapshot.screen ?? ""} ${snapshot.contextTitle ?? ""}`)}
        onSuggestion={prompt => { chat.setInput(prompt); composerRef.current?.focus(); }}
      /></View> : null}
      <AssistantMessages onNavigate={navigate} getDestinationLabel={text => { const target = destination(text); return target ? `Ir para ${target.label}. Pedirá confirmação.` : undefined; }} messages={chat.partialReply ? [...chat.messages, { role: "assistant", content: chat.partialReply }] : chat.messages} />
      {isPlanning && chat.draftTraining ? <AssistantTrainingDraftCard draft={chat.draftTraining} className={selectedClass?.name} onApply={applyDraft} /> : null}
      {chat.busy && !chat.partialReply ? <AssistantPending label="Preparando resposta" compact /> : null}
      {history.error ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{history.error}</Text> : null}
      {chat.error ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{chat.error}</Text> : null}
    </AssistantConversationScroll>
    <View style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <AssistantComposer voiceScope={{ organizationId, classId: selectedClass?.id }} inputRef={composerRef} value={chat.input} onChangeText={chat.setInput} busy={chat.busy} onSend={() => { void chat.send(); }}
        trailingControl={<AssistantModelSelector value={modelPreference} onChange={onModelPreferenceChange} disabled={chat.busy} compact />} />
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
