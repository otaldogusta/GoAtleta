import { createElement, Fragment, useState, type ComponentProps, type ReactNode } from "react";
import { View } from "react-native";
import { UnifiedAssistantProvider } from "../../../assistant/UnifiedAssistantProvider";
import { buildOperationalContext } from "../../../copilot/operational-context";
import { act, fireEvent, render, renderHook } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PlanningAssistantButton, PlanningAssistantHost, PlanningAssistantProvider, usePlanningAssistant } from "../PlanningAssistant";
import { requestAssistantConversation } from "../../../api/ai";
import type { ThemeColors } from "../../../ui/app-theme";
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: { user: { id: "provider-coach" } } }) }));
jest.mock("../../../api/ai", () => ({ requestAssistantConversation: jest.fn() }));
jest.mock("../../../assistant/components/AssistantMessages", () => ({ AssistantMessages: () => null }));
jest.mock("../../../assistant/components/AssistantComposer", () => ({ AssistantComposer: () => null }));
jest.mock("../../../assistant/components/AssistantPending", () => ({ AssistantPending: () => null }));
jest.mock("../../../ui/ModalSheet", () => ({ ModalSheet: ({ visible, children }: { visible: boolean; children: ReactNode }) => visible ? children : null }));
jest.mock("../../../ui/Pressable", () => ({ Pressable: jest.requireActual("react-native").Pressable }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock("../../../copilot/components/CopilotFab", () => ({
  CopilotFab: () => jest.requireActual("react").createElement(jest.requireActual("react-native").View, { testID: "planning-floating-launcher" }),
  resolveCopilotFabBottom: () => 16,
}));
beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });
test("one controller preserves text, request and history across editor and lesson contexts", async () => {
  let resolve!: (value: unknown) => void;
  (requestAssistantConversation as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
  const Wrapper = ({ children }: { children: ReactNode }) => {
    const [open,setOpen]=useState(false);
    const snapshot=buildOperationalContext({screen:"periodization",contextTitle:"Planejamento",contextSubtitle:"",signals:[],selectedSignalId:null,regulationUpdates:[],regulationRuleSets:[],history:[]}).snapshot;
    return createElement(UnifiedAssistantProvider,{userId:"provider-coach",organizationId:"provider-org",snapshot,lesson:null,open,toggle:()=>setOpen(value=>!value)},createElement(PlanningAssistantProvider, { organizationId: "provider-org", classId: "provider-class" },children));
  };
  const hook = renderHook(() => usePlanningAssistant()!, { wrapper: Wrapper });
  expect(hook.result.current.open).toBe(false);
  act(() => { hook.result.current.chat.setInput("Como distribuir a carga?"); hook.result.current.toggle(); hook.result.current.setSelection({ month: "2026-09", weekNumber: 39 }); });
  act(() => hook.result.current.setEditor({ step: "Modelo de carga", draft: { intensityMax: 6 } }));
  expect(hook.result.current.chat.input).toBe("Como distribuir a carga?");
  expect(requestAssistantConversation).not.toHaveBeenCalled();
  let pending!: Promise<void>;
  act(() => { pending = hook.result.current.chat.send(); });
  act(() => { hook.result.current.setEditor(null); hook.result.current.setLesson({ draft: { title: "Nova escolha" } }); });
  expect(hook.result.current.surface).toBe("lesson");
  expect(hook.result.current.chat.busy).toBe(true);
  await act(async () => { resolve({ reply: "Orientação sem aplicar", planningContextVersion: 1 }); await pending; });
  expect(hook.result.current.chat.messages.at(-1)?.planningContext).toMatchObject({ surface: "editor", step: "Modelo de carga", draft: { intensityMax: 6 } });
  act(() => hook.result.current.setLesson(null));
  expect(hook.result.current.surface).toBe("workspace");
  expect(hook.result.current.chat.messages.at(-1)?.content).toBe("Orientação sem aplicar");
  expect(requestAssistantConversation).toHaveBeenCalledTimes(1);
});

test.each([true, false])("workspace header opens its existing assistant without a floating duplicate (shared: %s)", (shared) => {
  const colors = { text: "#fff", muted: "#aaa", card: "#123", border: "#456", primaryBg: "#0f8" } as ThemeColors;
  let controller!: NonNullable<ReturnType<typeof usePlanningAssistant>>;
  function Contents({ workspaceReady = true }: { workspaceReady?: boolean }) {
    controller = usePlanningAssistant()!;
    return createElement(Fragment, null,
      createElement(PlanningAssistantButton, { colors }),
      ...(["workspace", "editor", "lesson"] as const).filter(surface => surface !== "workspace" || workspaceReady).map(surface => createElement(PlanningAssistantHost, { key: surface, colors, surface } as ComponentProps<typeof PlanningAssistantHost>, createElement(View))),
    );
  }
  function Wrapper({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const content = createElement(PlanningAssistantProvider, { organizationId: "header-org", classId: `header-class-${shared}` }, children);
    if (!shared) return content;
    const snapshot = buildOperationalContext({ screen: "periodization", contextTitle: "Planejamento", contextSubtitle: "", signals: [], selectedSignalId: null, regulationUpdates: [], regulationRuleSets: [], history: [] }).snapshot;
    return createElement(UnifiedAssistantProvider, { userId: "provider-coach", organizationId: "header-org", snapshot, lesson: null, open, toggle: () => setOpen(value => !value) }, content);
  }
  const screen = render(createElement(Contents, { workspaceReady: false }), { wrapper: Wrapper });
  expect(screen.queryByRole("button", { name: "Abrir Assistente da Periodização" })).toBeNull();
  screen.rerender(createElement(Contents, { workspaceReady: true }));
  expect(screen.queryByTestId("planning-floating-launcher")).toBeNull();
  act(() => controller.chat.setInput("Minha pergunta em andamento"));
  fireEvent.press(screen.getByRole("button", { name: "Abrir Assistente da Periodização" }));
  expect(controller.open).toBe(true);
  expect(screen.getByText("Assistente")).toBeTruthy();
  expect(controller.chat.input).toBe("Minha pergunta em andamento");
  expect(requestAssistantConversation).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "Recolher assistente" }));
  expect(controller.open).toBe(false);
  expect(screen.queryByTestId("planning-floating-launcher")).toBeNull();
  screen.rerender(createElement(Contents, { workspaceReady: false }));
  expect(screen.queryByRole("button", { name: "Abrir Assistente da Periodização" })).toBeNull();
  screen.rerender(createElement(Contents, { workspaceReady: true }));
  expect(screen.getByRole("button", { name: "Abrir Assistente da Periodização" })).toBeTruthy();
  expect(controller.chat.input).toBe("Minha pergunta em andamento");
  act(() => controller.setEditor({ step: "Modelo", draft: {} }));
  expect(screen.queryByRole("button", { name: "Abrir Assistente da Periodização" })).toBeNull();
  expect(screen.getAllByTestId("planning-floating-launcher")).toHaveLength(1);
  act(() => { controller.setEditor(null); controller.setLesson({}); });
  expect(screen.getAllByTestId("planning-floating-launcher")).toHaveLength(1);
  screen.unmount();
});

test("editor header opens the same conversation and leaves the footer free", () => {
  const colors = { text: "#fff", muted: "#aaa", card: "#123", border: "#456", primaryBg: "#0f8" } as ThemeColors;
  let controller!: NonNullable<ReturnType<typeof usePlanningAssistant>>;
  function Contents() {
    controller = usePlanningAssistant()!;
    return createElement(Fragment, null,
      createElement(PlanningAssistantButton, { colors, surface: "editor" }),
      createElement(PlanningAssistantHost, { colors, surface: "editor", launcher: "header" } as ComponentProps<typeof PlanningAssistantHost>, createElement(View)),
    );
  }
  const wrapper = ({ children }: { children: ReactNode }) => createElement(PlanningAssistantProvider, { organizationId: "editor-header-org", classId: "editor-header-class" }, children);
  const screen = render(createElement(Contents), { wrapper });
  act(() => { controller.setEditor({ step: "Nível da turma", draft: { format: "3x3" } }); controller.chat.setInput("Rascunho mantido"); });
  expect(screen.queryByTestId("planning-floating-launcher")).toBeNull();
  const trigger = screen.getByRole("button", { name: "Abrir Assistente da Periodização" });
  expect(trigger.props.nativeID).toBe("planning-assistant-editor-header-org-editor-header-class-editor");
  fireEvent.press(trigger);
  expect(controller.open).toBe(true);
  expect(screen.getByText("Assistente")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Recolher assistente" }));
  expect(controller.open).toBe(false);
  expect(controller.chat.input).toBe("Rascunho mantido");
  expect(screen.queryByTestId("planning-floating-launcher")).toBeNull();
  expect(requestAssistantConversation).not.toHaveBeenCalled();
  screen.unmount();
});
