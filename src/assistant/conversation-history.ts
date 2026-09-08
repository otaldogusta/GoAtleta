import AsyncStorage from "@react-native-async-storage/async-storage";

export type HistoryMessage = { role: "user" | "assistant"; content: string };
export type SavedConversation = { id: string; title: string; updatedAt: string; messages: HistoryMessage[]; input: string };
const prefix = (scope: string) => `go:conversations:v1:${encodeURIComponent(scope)}:`;

export async function saveConversation(scope: string, conversation: SavedConversation) {
  await AsyncStorage.setItem(`${prefix(scope)}${conversation.id}`, JSON.stringify(conversation));
}
export async function listConversations(scope: string): Promise<SavedConversation[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(prefix(scope)));
  const rows = await AsyncStorage.multiGet(keys);
  return rows.flatMap(([, raw]) => {
    try {
      const value = JSON.parse(raw ?? "null");
      if (!value || typeof value.id !== "string" || typeof value.title !== "string" || typeof value.updatedAt !== "string" || !Array.isArray(value.messages)) return [];
      if (!value.messages.every((m: HistoryMessage) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")) return [];
      return [{ ...value, input: typeof value.input === "string" ? value.input : "" } as SavedConversation];
    } catch { return []; }
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
