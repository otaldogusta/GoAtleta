import { useEffect, useRef, useState } from "react";
import { requestAssistantConversation } from "../../api/ai";
import type { AssistantModelChoice } from "../model-choice";
import type { OperationalSnapshot } from "../../copilot/operational-context";

const conversations = new Map<string, { messages: Message[]; input: string; savedAt: number; historyId?: string }>();

type Message = { role: "user" | "assistant"; content: string };

/** Mount under a user/organization/screen key so pending replies cannot cross scopes. */
export function useScreenConversation(organizationId: string, snapshot: OperationalSnapshot, modelPreference: AssistantModelChoice, conversationKey?: string) {
  const [restored] = useState(() => {
    const cached = conversationKey ? conversations.get(conversationKey) : undefined;
    return cached && Date.now() - cached.savedAt < 30 * 60_000 ? cached : undefined;
  });
  const [messages, setMessages] = useState<Message[]>(restored?.messages ?? []);
  const [input, setInput] = useState(restored?.input ?? "");
  const [partialReply, setPartialReply] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; request.current?.abort(); };
  }, []);

  async function send() {
    if (request.current || !input.trim()) return;
    const content = input.trim();
    const next: Message[] = [...messages, { role: "user", content }];
    const controller = new AbortController();
    request.current = controller;
    setMessages(next); setInput(""); setError(""); setPartialReply(""); setBusy(true);
    const timeout = setTimeout(() => controller.abort(), 75_000);
    try {
      const result = await requestAssistantConversation({
        organizationId, messages: next.slice(-16), modelPreference,
        appSnapshot: snapshot, signal: controller.signal,
        onReply: text => { if (alive.current) setPartialReply(text); },
      });
      if (!alive.current) return;
      if (!result || typeof result !== "object" || !("reply" in result) || typeof result.reply !== "string" || !result.reply.trim()) throw new Error("Resposta incompleta. Tente novamente.");
      setMessages([...next, { role: "assistant", content: result.reply }]);
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
  return { historyId: restored?.historyId, restore: (saved: { messages: Message[]; input: string }) => { setMessages(saved.messages); setInput(saved.input); setError(""); setPartialReply(""); }, remember, messages, input, setInput, partialReply, error, busy, send };
}
