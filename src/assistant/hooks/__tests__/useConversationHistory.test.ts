import { act, renderHook } from "@testing-library/react-native";
import { useConversationHistory } from "../useConversationHistory";
import { saveConversation, listConversations, type HistoryMessage } from "../../conversation-history";
jest.mock("../../conversation-history", () => ({ saveConversation: jest.fn(), listConversations: jest.fn() }));
const messages: HistoryMessage[] = [{ role: "user", content: "Resumo" }, { role: "assistant", content: "Completo" }];
beforeEach(() => {
  jest.clearAllMocks();
  (saveConversation as jest.Mock).mockResolvedValue(undefined);
  (listConversations as jest.Mock).mockResolvedValue([]);
});

test("only saves completed turns and preserves the navigation conversation identity", async () => {
  const { result, rerender } = renderHook(({ busy }) => useConversationHistory("scope", messages, "", busy, "existing"), { initialProps: { busy: true } });
  expect(saveConversation).not.toHaveBeenCalled();
  await act(async () => { rerender({ busy: false }); });
  expect(saveConversation).toHaveBeenCalledWith("scope", expect.objectContaining({ id: "existing", messages }));
  await act(async () => { await result.current.refresh(); });
  expect(listConversations).toHaveBeenCalledWith("scope");
});

test("reports storage errors without losing the current messages", async () => {
  (saveConversation as jest.Mock).mockRejectedValue(new Error("Quota exceeded"));
  const { result } = renderHook(() => useConversationHistory("scope", messages, "draft", false));
  await act(async () => { await result.current.refresh(); });
  expect(result.current.error).toContain("salvar");
  expect(messages).toHaveLength(2);
});
