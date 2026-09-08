import { act, renderHook } from "@testing-library/react-native";
import { useScreenConversation } from "../useScreenConversation";
import { requestAssistantConversation } from "../../../api/ai";
import type { OperationalSnapshot } from "../../../copilot/operational-context";
jest.mock("../../../api/ai", () => ({ requestAssistantConversation: jest.fn() }));
const snapshot = { screen: "coord/classes", contextTitle: "Turmas" } as OperationalSnapshot;
beforeEach(() => jest.clearAllMocks());
test("passes the current organization, screen and selected model without inventing a class", async () => {
  (requestAssistantConversation as jest.Mock).mockResolvedValue({ reply: "Como posso ajudar com as turmas?" });
  const { result } = renderHook(() => useScreenConversation("org-a", snapshot, "auto"));
  act(() => result.current.setInput("Oi"));
  await act(async () => { await result.current.send(); });
  const payload = (requestAssistantConversation as jest.Mock).mock.calls[0][0];
  expect(payload).toMatchObject({ organizationId: "org-a", appSnapshot: snapshot, modelPreference: "auto" });
  expect(payload.classId).toBeUndefined();
  expect(payload.lessonAction).toBeUndefined();
  expect(result.current.messages).toHaveLength(2);
  expect(result.current.input).toBe("");
});
test("failed streams roll back the pending turn and retry it only once", async () => {
  (requestAssistantConversation as jest.Mock).mockImplementationOnce(async ({ onReply }) => {
    onReply("Parcial"); throw new Error("Sem conexão");
  }).mockResolvedValueOnce({ reply: "Completa" });
  const { result } = renderHook(() => useScreenConversation("org-a", snapshot, "auto"));
  act(() => result.current.setInput("Pendências?"));
  await act(async () => { await result.current.send(); });
  expect(result.current.messages).toEqual([]);
  expect(result.current.partialReply).toBe("");
  expect(result.current.input).toBe("Pendências?");
  await act(async () => { await result.current.send(); });
  expect(result.current.messages).toHaveLength(2);
});
test("unmount cancels pending work and duplicate sends do not create extra requests", async () => {
  let finish!: (value: unknown) => void;
  (requestAssistantConversation as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { result, unmount } = renderHook(() => useScreenConversation("org-a", snapshot, "auto"));
  act(() => result.current.setInput("Resumo"));
  let pending!: Promise<void>;
  act(() => { pending = result.current.send(); });
  await act(async () => { await result.current.send(); });
  expect(requestAssistantConversation).toHaveBeenCalledTimes(1);
  const { signal } = (requestAssistantConversation as jest.Mock).mock.calls[0][0];
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => { finish({ reply: "Tardia" }); await pending; });
});

test("explicit navigation preserves conversation and draft within its identity scope", async () => {
 (requestAssistantConversation as jest.Mock).mockResolvedValue({ reply: "Prioridades" });
 const first = renderHook(() => useScreenConversation("org-a", snapshot, "auto", "user-a:org-a:management"));
 act(() => first.result.current.setInput("Resumo"));
 await act(async () => { await first.result.current.send(); });
 act(() => first.result.current.setInput("Próxima pergunta"));
 act(() => first.result.current.remember());
 first.unmount();
 const restored = renderHook(() => useScreenConversation("org-a", snapshot, "auto", "user-a:org-a:management"));
 expect(restored.result.current.messages).toHaveLength(2);
 expect(restored.result.current.input).toBe("Próxima pergunta");
 const other = renderHook(() => useScreenConversation("org-b", snapshot, "auto", "user-b:org-b:management"));
 expect(other.result.current.messages).toEqual([]);
});
