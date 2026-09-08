import type { AssistantModelChoice } from "../../../assistant/model-choice";
import { useEffect, useRef, useState } from "react";
import { requestAssistantConversation } from "../../../api/ai";
import { createClientId } from "../../../core/client-id";
import type { TrainingPlan } from "../../../core/models";
import { parseLessonDraft, type LessonDraft } from "../application/lesson-draft";
import { applyLessonDraft } from "../application/apply-lesson-draft";

export type LessonConversationScope = { classId: string; organizationId: string; date: string; sport: string };
export function useLessonConversation(scope: LessonConversationScope, currentPlanId: string | null, onApplied: (plan: TrainingPlan) => void, appSnapshot?: unknown, modelPreference: AssistantModelChoice = "auto") {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [partialReply, setPartialReply] = useState("");
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const alive = useRef(true);
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  const pendingId = useRef("");
  const expectedPlanId = useRef(currentPlanId);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; request.current?.abort(); };
  }, []);

  async function send(action: "discuss" | "draft" | "auto") {
    if (lock.current || (action !== "draft" && !input.trim())) return;
    const content = input.trim() || "Monte a aula com o que conversamos.";
    const next = [...messages, { role: "user" as const, content }];
    lock.current = true;
    setMessages(next);
    setInput(""); setPartialReply("");
    setBusy(true); setError(""); setNotice(""); setDraft(null); setSaved(false);
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 75_000);
    try {
      const raw = await requestAssistantConversation({
        onReply: text => { if (alive.current) setPartialReply(text); },
        modelPreference, messages: next.slice(-16), ...scope, appSnapshot, sessionDate: scope.date, lessonAction: action, signal: controller.signal,
      }) as { reply?: unknown; draftTraining?: unknown; lessonContext?: { version: number; classId: string; organizationId: string; date: string } };
      if (!alive.current) return;
      const context = raw.lessonContext;
      if (context !== undefined && (context?.version !== 1 || context.classId !== scope.classId || context.organizationId !== scope.organizationId || context.date !== scope.date)) {
        throw new Error("Não foi possível confirmar a turma e a data da resposta. Tente novamente.");
      }
      if (typeof raw.reply !== "string" || !raw.reply.trim()) throw new Error("Resposta incompleta. Tente novamente.");
      // Older servers can answer chat, but cannot authorize a dated lesson draft.
      const parsed = context && action !== "discuss" ? parseLessonDraft(raw.draftTraining) : null;
      if (context && action !== "discuss" && raw.draftTraining && !parsed) throw new Error("O rascunho veio incompleto. Peça para montar a aula novamente.");
      if (!context && (raw.draftTraining || action === "draft")) setNotice("Você pode conversar e revisar ideias. Aplicar o plano por aqui depende da atualização do assistente; nada foi salvo.");
      setMessages([...next, { role: "assistant", content: raw.reply }]);
      setDraft(parsed); pendingId.current = `plan_assistant_${createClientId()}`;
      expectedPlanId.current = currentPlanId;
    } catch (e) {
      if (alive.current) {
        // Roll back the pending turn so retry sends it once, preserving any newer draft.
        setMessages(messages);
        setInput(current => current || content);
        setError(e instanceof Error && e.name !== "AbortError" ? e.message : "A resposta demorou. Tente novamente.");
      }
    } finally {
      clearTimeout(timeout); lock.current = false;
      if (alive.current) { setBusy(false); setPartialReply(""); }
    }
  }

  async function apply() {
    if (!draft || lock.current || saved) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const plan = await applyLessonDraft({ ...scope, draft, id: pendingId.current, expectedPlanId: expectedPlanId.current, isCurrent: () => alive.current });
      if (alive.current) { setSaved(true); setDraft(null); onApplied(plan); }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Não foi possível aplicar. Tente novamente.");
    } finally { lock.current = false; if (alive.current) { setBusy(false); setPartialReply(""); } }
  }
  return { restore: (saved: { messages: { role: "user" | "assistant"; content: string }[]; input: string }) => { setMessages(saved.messages); setInput(saved.input); setDraft(null); setSaved(false); setError(""); setNotice(""); }, messages, partialReply, input, setInput, draft, error, notice, busy, saved, send, apply };
}
