import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CopilotFab, resolveCopilotFabBottom } from "../../copilot/components/CopilotFab";
import { useAuth } from "../../auth/auth";
import { useUnifiedAssistant } from "../../assistant/UnifiedAssistantProvider";
import { useScreenConversation } from "../../assistant/hooks/useScreenConversation";
import { useConversationHistory } from "../../assistant/hooks/useConversationHistory";
import { listConversations } from "../../assistant/conversation-history";
import { AssistantMessages } from "../../assistant/components/AssistantMessages";
import { AssistantComposer } from "../../assistant/components/AssistantComposer";
import { AssistantPending } from "../../assistant/components/AssistantPending";
import { buildOperationalContext } from "../../copilot/operational-context";
import type { ThemeColors } from "../../ui/app-theme";
import { Pressable } from "../../ui/Pressable";
import { ModalSheet } from "../../ui/ModalSheet";
import { createWebPortal } from "../../ui/web-portal";
import { buildPlanningAssistantContext, planningConversationKey, planningResponseDetailsText, type PlanningAssistantContext, type PlanningResponseDetails, type PlanningSelection } from "./application/planning-assistant-context";
import { compactUiMetrics } from "../../theme/tokens";
import { GoAtletaIcon } from "../../ui/icon-registry";

const openings = new Map<string, boolean>();
function rememberedOpening(scope: string) {
  try { if (typeof sessionStorage !== "undefined") return sessionStorage.getItem(`go:planning-panel:${scope}`) === "open"; } catch { /* Memory fallback for restricted storage. */ }
  return openings.get(scope) ?? false;
}
function rememberOpening(scope: string, open: boolean) {
  openings.set(scope, open);
  try { if (typeof sessionStorage !== "undefined") sessionStorage.setItem(`go:planning-panel:${scope}`, open ? "open" : "closed"); } catch { /* Session still works in memory. */ }
}
type Controller = {
  chat: ReturnType<typeof useScreenConversation>;
  open: boolean; toggle: () => void;
  workspaceHostAvailable: boolean;
  setWorkspaceHostAvailable: (available: boolean) => void;
  selection: PlanningSelection;
  setSelection: (value: PlanningSelection) => void;
  setEditor: (value: { step: string; draft: unknown } | null) => void;
  setLesson: (value: { draft?: unknown } | null) => void;
  surface: PlanningAssistantContext["surface"];
  organizationId: string; classId: string;
  getScrollOffset: () => number | null;
  saveScrollOffset: (offset: number | null) => void;
};
const Context = createContext<Controller | null>(null);
export const usePlanningAssistant = () => useContext(Context);

export function PlanningAssistantButton({ colors, surface = "workspace" }: { colors: ThemeColors; surface?: PlanningAssistantContext["surface"] }) {
  const controller = usePlanningAssistant();
  if (!controller || controller.surface !== surface || (surface === "workspace" && !controller.workspaceHostAvailable)) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={controller.open ? "Recolher Assistente da Periodização" : "Abrir Assistente da Periodização"}
      nativeID={`planning-assistant-${controller.organizationId}-${controller.classId}${surface === "workspace" ? "" : `-${surface}`}`}
      {...(Platform.OS === "web" ? { "aria-expanded": controller.open } : {})}
      accessibilityState={{ expanded: controller.open }} onPress={controller.toggle}
      style={{ minWidth: compactUiMetrics.touchTarget, minHeight: compactUiMetrics.touchTarget, alignItems: "center", justifyContent: "center" }}>
      <GoAtletaIcon name="chat" size={compactUiMetrics.iconSize} color={colors.text} />
    </Pressable>
  );
}

export function PlanningAssistantProvider({ classId, organizationId, children }: { classId: string; organizationId: string; children?: ReactNode }) {
  const { session } = useAuth();
  const unified = useUnifiedAssistant();
  const key = planningConversationKey(session?.user.id ?? "", organizationId, classId);
  if (unified) return <SharedPlanningProvider key={key} scope={key} classId={classId} organizationId={organizationId}>{children}</SharedPlanningProvider>;
  return <ScopedProvider key={key} scope={key} classId={classId} organizationId={organizationId}>{children}</ScopedProvider>;
}
function SharedPlanningProvider({ scope, classId, organizationId, children }: { scope: string; classId: string; organizationId: string; children: ReactNode }) {
  const unified = useUnifiedAssistant()!;
  const [workspaceHostAvailable, setWorkspaceHostAvailable] = useState(false);
  const [selection, setSelection] = useState<PlanningSelection>({ month: new Date().toISOString().slice(0,7) });
  const [editor, setEditor] = useState<{ step: string; draft: unknown } | null>(null);
  const [lesson, setLesson] = useState<{ draft?: unknown } | null>(null);
  const surface = editor ? "editor" : lesson ? "lesson" : "workspace";
  const context = useMemo(() => buildPlanningAssistantContext({ classId, selection, surface, step: editor?.step, draft: editor?.draft ?? lesson?.draft }), [classId, selection, surface, editor, lesson]);
  const register = unified.setPlanning;
  useEffect(() => { register(context); }, [register, context]);
  useEffect(() => () => register(null), [register]);
  useEffect(() => { rememberOpening(scope, unified.open); }, [scope, unified.open]);
  return <Context.Provider value={{ chat: unified.chat, open: unified.open, toggle: unified.toggle, workspaceHostAvailable, setWorkspaceHostAvailable, selection, setSelection, setEditor, setLesson, surface, organizationId, classId, getScrollOffset: unified.getScrollOffset, saveScrollOffset: unified.saveScrollOffset }}>{children}</Context.Provider>;
}
function ScopedProvider({ scope, classId, organizationId, children }: { scope: string; classId: string; organizationId: string; children: ReactNode }) {
  const [open, setOpen] = useState(rememberedOpening(scope));
  const [workspaceHostAvailable, setWorkspaceHostAvailable] = useState(false);
  const [selection, setSelection] = useState<PlanningSelection>({ month: new Date().toISOString().slice(0, 7) });
  const [editor, setEditor] = useState<{ step: string; draft: unknown } | null>(null);
  const [lesson, setLesson] = useState<{ draft?: unknown } | null>(null);
  const scrollOffset = useRef<number | null>(null);
  const surface = editor ? "editor" : lesson ? "lesson" : "workspace";
  const context = useMemo(() => buildPlanningAssistantContext({ classId, selection, surface, step: editor?.step, draft: editor?.draft ?? lesson?.draft }), [classId, selection, surface, editor, lesson]);
  const snapshot = useMemo(() => buildOperationalContext({ screen: "periodization", contextTitle: "Planejamento", contextSubtitle: "", signals: [], selectedSignalId: null, regulationUpdates: [], regulationRuleSets: [], history: [] }).snapshot, []);
  const chat = useScreenConversation(organizationId, snapshot, "auto", scope, { classId, lessonAction: "discuss", planningContext: context });
  const history = useConversationHistory(scope, chat.messages, chat.input, chat.busy, chat.historyId);
  const currentConversation = useRef({ chat, history });
  useEffect(() => { currentConversation.current = { chat, history }; }, [chat, history]);
  useEffect(() => {
    let alive = true;
    void listConversations(scope).then(items => {
      const current = currentConversation.current;
      if (!alive || !items.length || current.chat.messages.length || current.chat.input || current.chat.busy) return;
      current.history.select(items[0]);
      current.chat.restore(items[0]);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [scope]);
  useEffect(() => { chat.remember(history.id); }, [chat, history.id]);
  return <Context.Provider value={{ chat, open, toggle: () => setOpen(value => { if (!value) scrollOffset.current = null; rememberOpening(scope, !value); return !value; }), workspaceHostAvailable, setWorkspaceHostAvailable, selection, setSelection, setEditor, setLesson, surface, organizationId, classId, getScrollOffset: () => scrollOffset.current, saveScrollOffset: offset => { scrollOffset.current = offset; } }}>{children}</Context.Provider>;
}

export function PlanningAssistantPanel({ colors, contentPadding = 12 }: { colors: ThemeColors; contentPadding?: number }) {
  const controller = usePlanningAssistant();
  const scroll = useRef<ScrollView>(null);
  const [details, setDetails] = useState<number | null>(null);
  const previousLength = useRef(controller?.chat.messages.length ?? 0);
  if (!controller) return null;
  const { chat } = controller;
  const restoreScroll = () => {
    const offset = controller.getScrollOffset();
    if (offset === null) scroll.current?.scrollToEnd({ animated: false });
    else scroll.current?.scrollTo({ y: offset, animated: false });
  };
  return <View style={{ flex: 1, minHeight: controller.surface === "workspace" ? 0 : 260, minWidth: 0, padding: contentPadding, gap: 8, backgroundColor: colors.card }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "800" }}>Assistente</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Recolher assistente" onPress={controller.toggle} style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: 8 }}><Text style={{ color: colors.muted }}>Fechar</Text></Pressable>
    </View>
    <Pressable accessibilityRole="button" disabled={chat.busy} onPress={() => void chat.send("Analise o contexto selecionado e oriente minhas próximas escolhas, distinguindo fatos confirmados, rascunho e recomendações.")} style={{ minHeight: 40, justifyContent: "center", opacity: chat.busy ? 0.55 : 1 }}><Text style={{ color: colors.text, fontWeight: "700" }}>Analisar</Text></Pressable>
    <ScrollView ref={scroll} onLayout={restoreScroll} scrollEventThrottle={100} onScroll={event => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      controller.saveScrollOffset(contentOffset.y + layoutMeasurement.height >= contentSize.height - 16 ? null : contentOffset.y);
    }} onContentSizeChange={() => {
      if (previousLength.current !== chat.messages.length || chat.busy) { scroll.current?.scrollToEnd({ animated: false }); controller.saveScrollOffset(null); previousLength.current = chat.messages.length; }
      else restoreScroll();
    }} contentContainerStyle={{ gap: 10 }} style={{ flex: 1, minHeight: 0 }}>
      {!chat.messages.length ? <Text style={{ color: colors.muted, fontSize: compactUiMetrics.bodyFontSize }}>Pergunte sobre o planejamento da turma.</Text> : null}
      {chat.messages.map((message, index) => <View key={index} style={{ gap: 5 }}>
        <AssistantMessages messages={[message]} />
        {message.role === "assistant" && message.planningContext ? <><Pressable accessibilityRole="button" onPress={() => setDetails(details === index ? null : index)} style={{ minHeight: 40, justifyContent: "center" }}><Text style={{ color: colors.muted, fontSize: 12 }}>Contexto e fontes {details === index ? "−" : "+"}</Text></Pressable>
          {details === index ? <Text selectable style={{ color: colors.muted, fontSize: 12 }}>{planningResponseDetailsText(message.planningContext, message.contextDetails as PlanningResponseDetails | undefined)}</Text> : null}</> : null}
      </View>)}
      {chat.busy ? <AssistantPending label="Analisando planejamento" compact /> : null}
    </ScrollView>
    {chat.error ? <Text accessibilityLiveRegion="polite" style={{ color: colors.warningText, fontSize: 12 }}>{chat.error}</Text> : null}
    <AssistantComposer compact value={chat.input} onChangeText={chat.setInput} busy={chat.busy} onSend={() => void chat.send()} voiceScope={{ organizationId: controller.organizationId, classId: controller.classId }} />
  </View>;
}

/** One visible host; the controller lives above the screen and its modals. */
export function PlanningAssistantHost({ colors, surface, children, launcher = "floating" }: { colors: ThemeColors; surface: PlanningAssistantContext["surface"]; children: ReactNode; launcher?: "floating" | "header" }) {
  const controller = usePlanningAssistant();
  const setWorkspaceHostAvailable = controller?.setWorkspaceHostAvailable;
  useEffect(() => {
    if (surface !== "workspace" || !setWorkspaceHostAvailable) return;
    setWorkspaceHostAvailable(true);
    return () => setWorkspaceHostAvailable(false);
  }, [surface, setWorkspaceHostAvailable]);
  const insets = useSafeAreaInsets();
  const [pulse] = useState(() => new Animated.Value(0));
  const { width, height } = useWindowDimensions();
  const active = controller?.surface === surface;
  const inline = width >= 1200;
  const mobileWorkspace = surface === "workspace" && width < 600;
  const panelHeight = mobileWorkspace
    ? Math.max(0, Math.min(620, height * 0.82, height - insets.top - insets.bottom - 32))
    : width < 600 ? Math.min(620, height * 0.82) : Math.max(0, height - insets.top - insets.bottom - 34);
  const panel = <PlanningAssistantPanel colors={colors} contentPadding={surface === "workspace" ? width < 600 ? 16 : 20 : 12} />;
  const headerLauncher = surface === "workspace" || launcher === "header";
  const floatingLauncher = active && !headerLauncher && !controller.open ? <CopilotFab showPulse={false} pulseAnim={pulse} primaryBgColor={colors.primaryBg} fabBottomOffset={resolveCopilotFabBottom(insets.bottom)} hintMessage={null} onPress={controller.toggle} /> : null;
  return <View style={{ flex: 1, minWidth: 0, minHeight: 0, flexDirection: "row" }}>
    <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>{children}</View>
    {active ? <>
      {Platform.OS === "web" && typeof document !== "undefined" ? createWebPortal(floatingLauncher, document.body) : floatingLauncher}
      {controller.open && inline ? <View style={{ width: 320, minHeight: 0, maxHeight: Math.max(320, height - 180), borderLeftWidth: 1, borderColor: colors.border }}>{panel}</View> : null}
      {!inline ? (
        <ModalSheet visible={controller.open} onClose={controller.toggle}
          onExited={headerLauncher ? () => {
            if (Platform.OS !== "web" || typeof document === "undefined") return;
            requestAnimationFrame(() => {
              const trigger = document.getElementById(`planning-assistant-${controller.organizationId}-${controller.classId}${surface === "workspace" ? "" : `-${surface}`}`);
              if (document.activeElement === document.body && trigger?.isConnected && !trigger.closest('[inert], [aria-hidden="true"]') && trigger.getClientRects().length) {
                trigger.focus({ preventScroll: true });
              }
            });
          } : undefined}
          dialogLabel={headerLauncher ? "Assistente da Periodização" : undefined}
          position={width < 600 ? "bottom" : "right"} overlayZIndex={9500}
          bottomOffset={mobileWorkspace ? insets.bottom + 16 : undefined}
          cardStyle={{
            backgroundColor: colors.card,
            width: mobileWorkspace ? Math.max(0, width - insets.left - insets.right - 32) : width < 600 ? "100%" : 360,
            alignSelf: mobileWorkspace ? "center" : width < 600 ? "stretch" : "flex-end",
            padding: 0, paddingBottom: 0, marginBottom: 0,
            maxHeight: mobileWorkspace ? panelHeight : width < 600 ? "90%" : "100%",
            borderRadius: 14, overflow: "hidden",
          }}>
          <View style={{ height: panelHeight, width: "100%", minHeight: 0 }}>{panel}</View>
        </ModalSheet>
      ) : null}
    </> : null}
  </View>;
}
