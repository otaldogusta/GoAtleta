import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { View, useWindowDimensions } from "react-native";
import { useScreenConversation } from "./hooks/useScreenConversation";
import { useConversationHistory } from "./hooks/useConversationHistory";
import { listConversations } from "./conversation-history";
import type { AssistantModelChoice } from "./model-choice";
import type { OperationalSnapshot } from "../copilot/operational-context";
import type { CopilotLessonScope } from "../copilot/lesson-context";
import type { PlanningAssistantContext } from "../screens/periodization/application/planning-assistant-context";

type Value = {
  chat: ReturnType<typeof useScreenConversation>;
  history: ReturnType<typeof useConversationHistory>;
  planning: PlanningAssistantContext | null;
  setPlanning: (context: PlanningAssistantContext | null) => void;
  open: boolean; toggle: () => void;
  model: AssistantModelChoice; setModel: (model: AssistantModelChoice) => void;
  setScreenClass: (value: { classId: string; sport: string } | null) => void;
  getScrollOffset: () => number | null; saveScrollOffset: (offset: number | null) => void;
};
const Context = createContext<Value | null>(null);
export const useUnifiedAssistant = () => useContext(Context);

/** Mounted once per authenticated user and organization, above navigation. */
export function UnifiedAssistantProvider({ userId, organizationId, snapshot, lesson, open, toggle, children }: {
  userId: string; organizationId: string; snapshot: OperationalSnapshot;
  lesson: CopilotLessonScope | null; open: boolean; toggle: () => void; children?: ReactNode;
}) {
  const scope = JSON.stringify(["assistant", userId, organizationId]);
  const [initialOpening] = useState(() => { try { return typeof sessionStorage !== "undefined" && sessionStorage.getItem(`go:assistant-panel:${scope}`) === "open"; } catch { return false; } });
  const openingRestored = useRef(false);
  useEffect(() => {
    if (!openingRestored.current) { openingRestored.current = true; if (initialOpening && !open) { toggle(); return; } }
    try { if (typeof sessionStorage !== "undefined") sessionStorage.setItem(`go:assistant-panel:${scope}`, open ? "open" : "closed"); } catch { /* In-memory session still persists across navigation. */ }
  }, [initialOpening, open, scope, toggle]);
  const [planning, setPlanning] = useState<PlanningAssistantContext | null>(null);
  const [model, setModel] = useState<AssistantModelChoice>("auto");
  const screenKey = `${snapshot.screen}:${snapshot.contextTitle}`;
  const [classChoice, setClassChoice] = useState<{ classId: string; sport: string; screen: string } | null>(null);
  const screenClass = classChoice?.screen === screenKey ? classChoice : null;
  const setScreenClass = useCallback((value: { classId: string; sport: string } | null) => { setClassChoice(value ? { ...value, screen: screenKey } : null); }, [screenKey]);
  const scrollOffset = useRef<number | null>(null);
  const options = useMemo(() => planning ? { classId: planning.classId, lessonAction: "discuss" as const, planningContext: planning } : lesson ? {
    classId: lesson.classId, sport: lesson.sport, sessionDate: lesson.date, currentPlanId: lesson.currentPlanId, lessonAction: "auto" as const,
  } : {
    classId: screenClass?.classId || String(snapshot.operationalFacts.find(fact => fact.key === "planning_class_id")?.value ?? "") || undefined,
    sport: screenClass?.sport,
    lessonAction: snapshot.screen === "planning" ? "auto" as const : undefined,
  }, [planning, lesson, snapshot, screenClass]);
  const chat = useScreenConversation(organizationId, snapshot, model, scope, options);
  const history = useConversationHistory(scope, chat.messages, chat.input, chat.busy, chat.historyId);
  const latest = useRef({ chat, history });
  useEffect(() => { latest.current = { chat, history }; chat.remember(history.id); }, [chat, history]);
  useEffect(() => {
    let alive = true;
    void listConversations(scope).then(entries => {
      const current = latest.current;
      if (!alive || !entries.length || current.chat.messages.length || current.chat.input || current.chat.busy) return;
      current.history.select(entries[0]); current.chat.restore(entries[0]);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [scope]);
  return <Context.Provider value={{ chat, history, planning, setPlanning, open, toggle, model, setModel, setScreenClass,
    getScrollOffset: () => scrollOffset.current, saveScrollOffset: offset => { scrollOffset.current = offset; } }}>{children}</Context.Provider>;
}

/** Planning hosts its own modal surface; every other route uses this same chat. */
export function UnifiedAssistantLayout({ children, panel, launcher, open }: { children: ReactNode; panel: ReactNode; launcher: ReactNode; open: boolean }) {
  const assistant = useUnifiedAssistant();
  const { width } = useWindowDimensions();
  const owned = Boolean(assistant?.planning);
  return <View style={{ flex: 1, minHeight: 0, minWidth: 0, flexDirection: "row" }}>
    <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>{children}</View>
    {!owned && open && width >= 1200 ? <View style={{ width: 320, minHeight: 0 }}>{panel}</View> : null}
    {!owned && open && width < 1200 ? panel : null}
    {!owned ? launcher : null}
  </View>;
}
