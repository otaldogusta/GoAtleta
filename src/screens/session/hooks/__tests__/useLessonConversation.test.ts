import { act, renderHook } from "@testing-library/react-native";
import { useLessonConversation } from "../useLessonConversation";
import { requestAssistantConversation } from "../../../../api/ai";
import { applyLessonDraft } from "../../application/apply-lesson-draft";
jest.mock("../../../../api/ai", () => ({ requestAssistantConversation: jest.fn() }));
jest.mock("../../application/apply-lesson-draft", () => ({ applyLessonDraft: jest.fn() }));
jest.mock("../../../../core/client-id", () => ({ createClientId: () => "stable" }));
const scope = { classId: "a", organizationId: "o", date: "2026-09-06", sport: "volleyball" };
const lessonContext = { version: 1, classId: scope.classId, organizationId: scope.organizationId, date: scope.date };
const draft = { title: "Consolidar", tags: [], warmup: ["Duplas"], main: ["Manchetão"], cooldown: ["Respirar"], warmupTime: "10 min", mainTime: "35 min", cooldownTime: "5 min" };
beforeEach(() => jest.clearAllMocks());

test("sending immediately clears the composer and displays one pending user turn", async () => {
  let resolve!: (value: unknown) => void;
  (requestAssistantConversation as jest.Mock).mockImplementation(() => new Promise(done => { resolve = done; }));
  const { result } = renderHook(() => useLessonConversation(scope, null, jest.fn()));
  act(() => result.current.setInput("Minha pergunta"));
  let pending!: Promise<void>;
  act(() => { pending = result.current.send("auto"); });
  expect(result.current.input).toBe("");
  expect(result.current.messages).toEqual([{ role: "user", content: "Minha pergunta" }]);
  expect(result.current.busy).toBe(true);
  await act(async () => { await result.current.send("auto"); });
  expect(requestAssistantConversation).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ reply: "Resposta", lessonContext }); await pending; });
  expect(result.current.messages).toHaveLength(2);
  expect(result.current.busy).toBe(false);
});

test("retry after failure does not duplicate the user turn", async () => {
  (requestAssistantConversation as jest.Mock).mockRejectedValueOnce(new Error("Sem conexão")).mockResolvedValueOnce({ reply: "Resposta", lessonContext });
  const { result } = renderHook(() => useLessonConversation(scope, null, jest.fn()));
  act(() => result.current.setInput("Minha pergunta"));
  await act(async () => { await result.current.send("auto"); });
  expect(result.current.input).toBe("Minha pergunta");
  expect(result.current.messages).toEqual([]);
  await act(async () => { await result.current.send("auto"); });
  expect(result.current.messages.filter(message => message.role === "user")).toHaveLength(1);
  expect((requestAssistantConversation as jest.Mock).mock.calls[1][0].messages).toHaveLength(1);
});
test("normal chat can return a reviewed lesson draft without automatically applying it", async () => {
  (requestAssistantConversation as jest.Mock).mockResolvedValue({ reply: "Revise a aula", draftTraining: draft, lessonContext });
  const { result } = renderHook(() => useLessonConversation(scope, null, jest.fn()));
  act(() => result.current.setInput("Monte uma aula de 50 minutos"));
  await act(async () => { await result.current.send("auto"); });
  expect(requestAssistantConversation).toHaveBeenCalledWith(expect.objectContaining({ lessonAction: "auto" }));
  expect(result.current.draft).toEqual(draft);
  expect(applyLessonDraft).not.toHaveBeenCalled();
});
test("discussion never reveals a draft even if the provider sends one", async () => {
  (requestAssistantConversation as jest.Mock).mockResolvedValue({ reply: "Quer consolidar?", draftTraining: draft, lessonContext });
  const { result } = renderHook(() => useLessonConversation(scope, null, jest.fn()));
  act(() => result.current.setInput("Manchetão hoje"));
  await act(async () => { await result.current.send("discuss"); });
  expect(result.current.draft).toBeNull();
  expect(requestAssistantConversation).toHaveBeenCalledWith(expect.objectContaining({ lessonAction: "discuss", organizationId: "o", sessionDate: scope.date }));
  expect(applyLessonDraft).not.toHaveBeenCalled();
});
test("draft is previewed and applying is explicit and locked against double clicks", async () => {
  (requestAssistantConversation as jest.Mock).mockResolvedValue({ reply: "Revise", draftTraining: draft, lessonContext });
  (applyLessonDraft as jest.Mock).mockResolvedValue({ id: "saved" });
  const applied = jest.fn();
  const { result } = renderHook(() => useLessonConversation(scope, "old", applied));
  act(() => result.current.setInput("18 pessoas e 50 minutos"));
  await act(async () => { await result.current.send("draft"); });
  expect(result.current.draft).toEqual(draft);
  expect(applyLessonDraft).not.toHaveBeenCalled();
  await act(async () => { await Promise.all([result.current.apply(), result.current.apply()]); });
  expect(applyLessonDraft).toHaveBeenCalledTimes(1);
  expect(applied).toHaveBeenCalledTimes(1);
});
test("unmount cancels pending request and never applies its result", async () => {
  let resolve!: (value: unknown) => void;
  (requestAssistantConversation as jest.Mock).mockImplementation(() => new Promise(done => { resolve = done; }));
  const { result, unmount } = renderHook(() => useLessonConversation(scope, null, jest.fn()));
  act(() => result.current.setInput("Montar aula"));
  let pending!: Promise<void>;
  act(() => { pending = result.current.send("draft"); });
  const signal = (requestAssistantConversation as jest.Mock).mock.calls[0][0].signal;
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => { resolve({ reply: "Pronto", draftTraining: draft, lessonContext }); await pending; });
  expect(applyLessonDraft).not.toHaveBeenCalled();
});
test("failed generation preserves teacher text for retry", async () => {
  (requestAssistantConversation as jest.Mock).mockRejectedValue(new Error("Indisponível"));
  const { result } = renderHook(() => useLessonConversation(scope, null, jest.fn()));
  act(() => result.current.setInput("Quero consolidar"));
  await act(async () => { await result.current.send("draft"); });
  expect(result.current.input).toBe("Quero consolidar");
  expect(result.current.busy).toBe(false);
});
test.each([null, { ...lessonContext, version: 2 }, { ...lessonContext, organizationId: "other" }, { ...lessonContext, classId: "other" }, { ...lessonContext, date: "2026-09-07" }])("rejects mismatched backend context %j", async context => {
  (requestAssistantConversation as jest.Mock).mockResolvedValue({ reply: "Revise", draftTraining: draft, lessonContext: context });
  const { result } = renderHook(() => useLessonConversation(scope, null, jest.fn()));
  act(() => result.current.setInput("Montar aula"));
  await act(async () => { await result.current.send("draft"); });
  expect(result.current.draft).toBeNull();
  expect(result.current.error).toContain("confirmar a turma");
  expect(result.current.messages).toEqual([]);
});

test("legacy server can answer a greeting with automatic operational context", async () => {
  (requestAssistantConversation as jest.Mock).mockResolvedValue({ reply: "Olá!" });
  const snapshot = { screen: "class_detail", title: "Turma" };
  const { result } = renderHook(() => useLessonConversation(scope, null, jest.fn(), snapshot));
  act(() => result.current.setInput("oi"));
  await act(async () => { await result.current.send("auto"); });
  expect(result.current.error).toBe("");
  expect(result.current.notice).toBe("");
  expect(result.current.messages).toEqual([{ role: "user", content: "oi" }, { role: "assistant", content: "Olá!" }]);
  expect(requestAssistantConversation).toHaveBeenCalledWith(expect.objectContaining({ appSnapshot: snapshot }));
});

test("legacy draft remains conversational and cannot be applied", async () => {
  (requestAssistantConversation as jest.Mock).mockResolvedValue({ reply: "Sugestão de aula", draftTraining: draft });
  const { result } = renderHook(() => useLessonConversation(scope, null, jest.fn()));
  act(() => result.current.setInput("Monte uma aula"));
  await act(async () => { await result.current.send("auto"); await result.current.apply(); });
  expect(result.current.error).toBe("");
  expect(result.current.draft).toBeNull();
  expect(result.current.notice).toContain("nada foi salvo");
  expect(applyLessonDraft).not.toHaveBeenCalled();
});

test("partial text does not authorize a draft and is cleared if the stream fails", async () => {
  let reject!: (error: Error) => void;
  (requestAssistantConversation as jest.Mock).mockImplementation(({ onReply }) => {
    onReply("Resposta parcial");
    return new Promise((_resolve, fail) => { reject = fail; });
  });
  const { result } = renderHook(() => useLessonConversation(scope, null, jest.fn()));
  act(() => result.current.setInput("Monte uma aula"));
  let task!: Promise<void>;
  act(() => { task = result.current.send("auto"); });
  expect(result.current.partialReply).toBe("Resposta parcial");
  expect(result.current.draft).toBeNull();
  await act(async () => { reject(new Error("interrompida")); await task; });
  expect(result.current.partialReply).toBe("");
  expect(result.current.messages).toEqual([]);
  expect(result.current.input).toBe("Monte uma aula");
});
