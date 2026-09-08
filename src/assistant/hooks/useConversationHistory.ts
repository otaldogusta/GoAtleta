import { useCallback, useEffect, useRef, useState } from "react";
import { createClientId } from "../../core/client-id";
import { listConversations, saveConversation, type HistoryMessage, type SavedConversation } from "../conversation-history";

export function useConversationHistory(scope: string, messages: HistoryMessage[], input: string, busy: boolean, initialId?: string) {
  const [id, setId] = useState(() => initialId ?? createClientId());
  const [items, setItems] = useState<SavedConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const writes = useRef(Promise.resolve());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (busy || !messages.length) return;
    const entry = { id, title: messages.find(m => m.role === "user")?.content.slice(0, 80) || "Conversa", updatedAt: new Date().toISOString(), messages, input };
    // Serialize saves so a slower old write cannot replace the newest response.
    writes.current = writes.current.catch(() => undefined).then(() => saveConversation(scope, entry)).then(() => {
      if (alive.current) setError("");
    }).catch(() => { if (alive.current) setError("Não foi possível salvar a conversa neste dispositivo."); });
  }, [scope, id, messages, input, busy]);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await writes.current;
      const saved = await listConversations(scope);
      if (alive.current) setItems(saved);
    } catch { if (alive.current) setError("Não foi possível carregar o histórico."); }
    finally { if (alive.current) setLoading(false); }
  }, [scope]);
  return { id, items, loading, error, refresh, select: (entry: SavedConversation) => setId(entry.id), newConversation: () => setId(createClientId()) };
}
