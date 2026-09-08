import AsyncStorage from "@react-native-async-storage/async-storage";
import { listConversations, saveConversation, type SavedConversation } from "../conversation-history";

jest.mock("@react-native-async-storage/async-storage", () => jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"));
beforeEach(async () => { await AsyncStorage.clear(); });
const entry: SavedConversation = { id: "one", title: "Resumo", updatedAt: "2026-09-07T12:00:00Z", messages: [{ role: "assistant", content: "Texto completo ".repeat(200) }], input: "Rascunho" };

test("preserves complete messages and draft across reads, isolated by account, organization and context", async () => {
  await saveConversation("user-a/org-a/management", entry);
  expect(await listConversations("user-a/org-a/management")).toEqual([entry]);
  for (const scope of ["user-b/org-a/management", "user-a/org-b/management", "user-a/org-a/classes"]) {
    expect(await listConversations(scope)).toEqual([]);
  }
});

test("updates the same conversation without duplicates and orders recent conversations first", async () => {
  await saveConversation("scope", entry);
  await saveConversation("scope", { ...entry, id: "two" });
  const updated = { ...entry, updatedAt: "2026-09-08T12:00:00Z", input: "Atualizado" };
  await saveConversation("scope", updated);
  const saved = await listConversations("scope");
  expect(saved).toHaveLength(2);
  expect(saved[0]).toEqual(updated);
});

test("ignores damaged records without hiding valid conversations", async () => {
  await saveConversation("scope", entry);
  await AsyncStorage.setItem("go:conversations:v1:scope:broken", "{broken");
  expect(await listConversations("scope")).toEqual([entry]);
});
