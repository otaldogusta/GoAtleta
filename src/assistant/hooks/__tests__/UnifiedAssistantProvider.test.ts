import { createElement, useState, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UnifiedAssistantProvider, useUnifiedAssistant } from "../../UnifiedAssistantProvider";
import { requestAssistantConversation } from "../../../api/ai";
import { buildOperationalContext } from "../../../copilot/operational-context";
jest.mock("../../../api/ai", () => ({ requestAssistantConversation: jest.fn() }));
const snapshot = (screen: string) => buildOperationalContext({ screen, contextTitle: screen, contextSubtitle: "", signals: [], selectedSignalId: null, regulationUpdates: [], regulationRuleSets: [], history: [] }).snapshot;
beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });
test("one conversation survives closing, navigation and a pending contextual reply", async () => {
  let changeScreen!: (value: string) => void;
  let resolve!: (value: unknown) => void;
  (requestAssistantConversation as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
  const Wrapper = ({ children }: { children: ReactNode }) => {
    const [screen, setScreen] = useState("classes"); changeScreen = setScreen;
    const [open, setOpen] = useState(false);
    return createElement(UnifiedAssistantProvider, { userId:"unified-coach", organizationId:"unified-org", snapshot:snapshot(screen), lesson:null, open, toggle:()=>setOpen(value=>!value) }, children);
  };
  const hook = renderHook(()=>useUnifiedAssistant()!, { wrapper: Wrapper });
  act(()=>{ hook.result.current.toggle(); hook.result.current.chat.setInput("Como distribuir a carga?"); hook.result.current.setPlanning({version:1,classId:"raposas",surface:"editor",selection:{month:"2026-09",weekNumber:39},draft:{intensityMax:6}}); });
  let pending!: Promise<void>;
  act(()=>{pending=hook.result.current.chat.send();});
  act(()=>{ hook.result.current.toggle(); hook.result.current.setPlanning(null); changeScreen("students"); });
  expect(hook.result.current.chat.busy).toBe(true);
  await act(async()=>{ resolve({reply:"Orientação",planningContextVersion:1}); await pending; });
  expect(hook.result.current.chat.messages.at(-1)?.planningContext?.selection.weekNumber).toBe(39);
  act(()=>{hook.result.current.chat.setInput("Texto preservado"); hook.result.current.toggle(); changeScreen("classes");});
  expect(hook.result.current.chat.input).toBe("Texto preservado");
  expect(hook.result.current.chat.messages).toHaveLength(2);
  expect(requestAssistantConversation).toHaveBeenCalledTimes(1);
  await act(async()=>{hook.unmount();});
});
test("switching authenticated scope aborts the old request and isolates the conversation", async () => {
  let changeScope!: (value:string)=>void;
  (requestAssistantConversation as jest.Mock).mockImplementation(({signal})=>new Promise((_,reject)=>signal.addEventListener("abort",()=>reject(new Error("aborted")))));
  const Wrapper = ({children}:{children:ReactNode}) => {
    const [scope,setScope]=useState("original"); changeScope=setScope;
    return createElement(UnifiedAssistantProvider,{key:scope,userId:scope,organizationId:scope,snapshot:snapshot("classes"),lesson:null,open:false,toggle:()=>undefined},children);
  };
  const hook=renderHook(()=>useUnifiedAssistant()!,{wrapper:Wrapper});
  act(()=>hook.result.current.chat.setInput("Mensagem privada"));
  act(()=>{void hook.result.current.chat.send();});
  const signal=(requestAssistantConversation as jest.Mock).mock.calls[0][0].signal;
  await act(async()=>changeScope("other"));
  expect(signal.aborted).toBe(true);
  expect(hook.result.current.chat.messages).toEqual([]);
  expect(hook.result.current.chat.input).toBe("");
  await act(async()=>{hook.unmount();});
});
