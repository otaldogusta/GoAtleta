import { useEffect, useRef, useState } from "react";
import { requestAssistantConversation } from "../../api/ai";
import type { AssistantModelChoice } from "../model-choice";
import type { OperationalSnapshot } from "../../copilot/operational-context";
import type { PlanningAssistantContext } from "../../screens/periodization/application/planning-assistant-context";
import { parseAssistantTrainingDraft, parseAssistantTrainingDraftReply, type AssistantTrainingDraft } from "../training-draft";
import { parseLessonDraft } from "../../screens/session/application/lesson-draft";

const conversations = new Map<string, { messages: Message[]; input: string; savedAt: number; historyId?: string }>();

type Message = { role: "user" | "assistant"; content: string; planningContext?: PlanningAssistantContext; contextDetails?: unknown };

type ConversationOptions = {
  classId?: string;
  sport?: string;
  lessonAction?: "discuss" | "draft" | "auto";
  planningContext?: PlanningAssistantContext;
  sessionDate?: string;
  currentPlanId?: string | null;
};

/** Mount under a user/organization/screen key so pending replies cannot cross scopes. */
export function useScreenConversation(organizationId: string, snapshot: OperationalSnapshot, modelPreference: AssistantModelChoice, conversationKey?: string, options: ConversationOptions = {}) {
  const [restored] = useState(() => {
    const cached = conversationKey ? conversations.get(conversationKey) : undefined;
    return cached && Date.now() - cached.savedAt < 30 * 60_000 ? cached : undefined;
  });
  const [messages, setMessages] = useState<Message[]>(restored?.messages ?? []);
  const [input, setInput] = useState(restored?.input ?? "");
  const [partialReply, setPartialReply] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftTraining, setDraftTraining] = useState<AssistantTrainingDraft | null>(null);
  const [draftContext, setDraftContext] = useState<{ classId: string; organizationId: string; date: string; expectedPlanId: string | null } | null>(null);
  const alive = useRef(true);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; request.current?.abort(); };
  }, []);

  async function send(explicitContent?: string) {
    const content = (typeof explicitContent === "string" ? explicitContent : input).trim();
    if (request.current || !content) return;
    const planningContext = options.planningContext ? JSON.parse(JSON.stringify(options.planningContext)) as PlanningAssistantContext : undefined;
    const captured = { ...options };
    const next: Message[] = [...messages, { role: "user", content, ...(planningContext ? { planningContext } : {}) }];
    const controller = new AbortController();
    request.current = controller;
    setMessages(next); setInput(""); setError(""); setPartialReply(""); setBusy(true);
    const timeout = setTimeout(() => controller.abort(), 75_000);
    try {
      const result = await requestAssistantConversation({
        organizationId, messages: next.slice(-16), modelPreference,
        classId: options.classId || undefined,
        sport: options.sport || undefined,
        lessonAction: options.lessonAction,
        planningContext,
        sessionDate: captured.sessionDate,
        appSnapshot: snapshot, signal: controller.signal,
        onReply: text => { if (alive.current) setPartialReply(text); },
      });
      if (!alive.current) return;
      if (!result || typeof result !== "object" || !("reply" in result) || typeof result.reply !== "string" || !result.reply.trim()) throw new Error("Resposta incompleta. Tente novamente.");
      const response = result as { reply: string; draftTraining?: unknown; planningContextVersion?: number; contextDetails?: unknown; lessonContext?: { version: number; classId: string; organizationId: string; date: string } };
      if (planningContext && response.planningContextVersion !== 1) throw new Error("O contexto de planejamento ainda não está disponível neste backend. Seu texto foi preservado.");
      const lessonContext = response.lessonContext;
      if (captured.sessionDate && lessonContext && (lessonContext.version !== 1 || lessonContext.classId !== captured.classId || lessonContext.organizationId !== organizationId || lessonContext.date !== captured.sessionDate)) throw new Error("Não foi possível confirmar a turma e a data da resposta. Tente novamente.");
      const nextDraft = captured.lessonAction === "discuss" || (captured.sessionDate && !lessonContext) ? null : captured.sessionDate ? parseLessonDraft(response.draftTraining) : parseAssistantTrainingDraft(response.draftTraining) ?? parseAssistantTrainingDraftReply(response.reply);
      if (captured.sessionDate && lessonContext && response.draftTraining && captured.lessonAction !== "discuss" && !nextDraft) throw new Error("O rascunho veio incompleto. Peça para montar a aula novamente.");
      setDraftTraining(nextDraft);
      setDraftContext(nextDraft && lessonContext ? { ...lessonContext, expectedPlanId: captured.currentPlanId ?? null } : null);
      setMessages([...next, { role: "assistant", content: nextDraft ? "Montei um planejamento para você. Revise os blocos abaixo e ajuste se necessário." : response.reply, planningContext, contextDetails: response.contextDetails }]);
    } catch (cause) {
      if (!alive.current) return;
      setMessages(messages);
      setInput(current => current || content);
      setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "A resposta demorou. Tente novamente.");
    } finally {
      clearTimeout(timeout);
      request.current = null;
      if (alive.current) { setBusy(false); setPartialReply(""); }
    }
  }
  function remember(historyId?: string) {
    if (!conversationKey || busy) return;
    conversations.delete(conversationKey);
    conversations.set(conversationKey, { messages, input, savedAt: Date.now(), historyId });
    if (conversations.size > 10) conversations.delete(conversations.keys().next().value!);
  }
  return { historyId: restored?.historyId, restore: (saved: { messages: Message[]; input: string }) => { setMessages(saved.messages); setInput(saved.input); setDraftTraining(null); setDraftContext(null); setError(""); setPartialReply(""); }, remember, messages, input, setInput, partialReply, error, busy, draftTraining, draftContext, clearDraftTraining: () => { setDraftTraining(null); setDraftContext(null); }, send };
}
