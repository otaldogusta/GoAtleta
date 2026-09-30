import { act, renderHook } from "@testing-library/react-native";
import { useScreenConversation } from "../useScreenConversation";
import { requestAssistantConversation } from "../../../api/ai";
import type { OperationalSnapshot } from "../../../copilot/operational-context";
jest.mock("../../../api/ai", () => ({ requestAssistantConversation: jest.fn() }));
const snapshot = { screen: "coord/classes", contextTitle: "Turmas" } as OperationalSnapshot;
beforeEach(() => jest.clearAllMocks());

const datedDraft = { title:"Aula",tags:[],warmup:["Mobilidade"],main:["Passe"],cooldown:["Respiração"],warmupTime:"10 min",mainTime:"40 min",cooldownTime:"10 min" };
test("dated drafts require the backend lesson authorization and remain bound to the original plan", async () => {
  let finish!: (value:unknown)=>void;
  (requestAssistantConversation as jest.Mock).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const hook=renderHook(({classId,date})=>useScreenConversation("org-a",snapshot,"auto",undefined,{classId,sessionDate:date,currentPlanId:"original-plan",lessonAction:"auto"}),{initialProps:{classId:"class-a",date:"2026-09-30"}});
  act(()=>hook.result.current.setInput("Monte a aula"));
  let pending!:Promise<void>;
  act(()=>{pending=hook.result.current.send();});
  hook.rerender({classId:"class-b",date:"2026-10-01"});
  await act(async()=>{finish({reply:"Pronto",draftTraining:datedDraft,lessonContext:{version:1,classId:"class-a",organizationId:"org-a",date:"2026-09-30"}});await pending;});
  expect(hook.result.current.draftContext).toMatchObject({classId:"class-a",date:"2026-09-30",expectedPlanId:"original-plan"});
  expect(hook.result.current.draftTraining?.title).toBe("Aula");
});
test("unconfirmed or mismatched dated responses cannot create an applicable draft", async () => {
  (requestAssistantConversation as jest.Mock).mockResolvedValueOnce({reply:"Ideia",draftTraining:datedDraft}).mockResolvedValueOnce({reply:"Outra turma",draftTraining:datedDraft,lessonContext:{version:1,classId:"class-b",organizationId:"org-a",date:"2026-09-30"}});
  const hook=renderHook(()=>useScreenConversation("org-a",snapshot,"auto",undefined,{classId:"class-a",sessionDate:"2026-09-30",lessonAction:"auto"}));
  act(()=>hook.result.current.setInput("Monte"));
  await act(async()=>{await hook.result.current.send();});
  expect(hook.result.current.draftTraining).toBeNull();
  expect(hook.result.current.draftContext).toBeNull();
  act(()=>hook.result.current.setInput("Tente de novo"));
  await act(async()=>{await hook.result.current.send();});
  expect(hook.result.current.error).toContain("turma e a data");
  expect(hook.result.current.input).toBe("Tente de novo");
});
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
test("keeps a generated planning draft for explicit review and apply", async () => {
  const planning = { screen: "planning", contextTitle: "Planejamento" } as OperationalSnapshot;
  (requestAssistantConversation as jest.Mock).mockResolvedValue({
    reply: "Plano pronto",
    draftTraining: {
      title: "Fundamentos de saque",
      tags: ["saque"],
      warmup: ["Mobilidade"],
      main: ["Saque por zonas"],
      cooldown: ["Alongamento"],
      warmupTime: "10 minutos",
      mainTime: "40 minutos",
      cooldownTime: "10 minutos",
    },
  });
  const { result } = renderHook(() => useScreenConversation("org-a", planning, "auto", undefined, {
    classId: "class-a",
    sport: "volleyball",
    lessonAction: "auto",
  }));
  act(() => result.current.setInput("Monte o plano"));
  await act(async () => { await result.current.send(); });
  expect(requestAssistantConversation).toHaveBeenCalledWith(expect.objectContaining({
    classId: "class-a",
    sport: "volleyball",
    lessonAction: "auto",
  }));
  expect(result.current.draftTraining?.title).toBe("Fundamentos de saque");
  expect(result.current.messages.at(-1)?.content).toContain("Revise os blocos");
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
