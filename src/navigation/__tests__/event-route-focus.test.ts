import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Alert, Platform, TextInput } from "react-native";

import EventDetailsScreen from "../../../app/events/[id]";
import { deleteEvent, getEventById, setEventClasses, updateEvent } from "../../api/events";
import { getClasses } from "../../db/seed";
import { validateTournamentRules } from "../../regulation/tournament-rule-check";
import { requestPendingEditsNavigation } from "../pending-edits-navigation";

let mockFocused = true;
let mockEventId = "event-a";
let mockSession = { user: { id: "user-a" } };
let mockOrganization = { id: "org-a", role_level: 50 };
const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
const mockConfirm = jest.fn();
const mockScopedRoutes = { events: "/coord/events" };
jest.mock("react-native", () => {
  const native = jest.requireActual("react-native");
  const ReactRuntime = jest.requireActual("react");
  return Object.defineProperties({}, {
    ...Object.getOwnPropertyDescriptors(native),
    View: { value: ReactRuntime.forwardRef(function MeasurableView(props: Record<string, unknown>, ref: unknown) {
      return ReactRuntime.createElement("EventView", { ...props, ref }, props.children);
    }) },
  });
});
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useIsFocused: () => mockFocused,
  useLocalSearchParams: () => ({ id: mockEventId }),
}));
jest.mock("../../auth/auth", () => ({ useAuth: () => ({ session: mockSession }) }));
jest.mock("../../providers/organization-context", () => ({
  useOptionalOrganization: () => ({ activeOrganization: mockOrganization, isLoading: false }),
}));
jest.mock("../use-trainer-route-scope", () => ({ useTrainerRouteScope: () => mockScopedRoutes }));
jest.mock("../../api/events", () => ({
  getEventById: jest.fn(), updateEvent: jest.fn(), setEventClasses: jest.fn(), deleteEvent: jest.fn(),
}));
jest.mock("../../db/seed", () => ({ getClasses: jest.fn() }));
jest.mock("../../regulation/tournament-rule-check", () => ({ validateTournamentRules: jest.fn() }));
jest.mock("../../copilot/CopilotProvider", () => ({ useCopilotContext: () => {} }));
jest.mock("../../observability/perf", () => ({
  markRender: () => {}, measureAsync: (_name: string, load: () => Promise<unknown>) => load(),
}));
jest.mock("../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../ui/use-modal-card-style", () => ({ useModalCardStyle: () => ({}) }));
jest.mock("../../ui/confirm-dialog", () => ({ useConfirmDialog: () => ({ confirm: mockConfirm }) }));
jest.mock("../../ui/confirm-undo", () => ({ useConfirmUndo: () => ({ confirm: jest.fn() }) }));
jest.mock("../../components/ui/ScreenLoadingState", () => ({ ScreenLoadingState: () => null }));
// Keep the route mounted while observing visibility at the shared portal boundary.
// Actual portal/focus behavior is covered by the authenticated browser smoke.
jest.mock("../../ui/ModalSheet", () => ({
  ModalSheet: (props: Record<string, unknown>) =>
    jest.requireActual("react").createElement("EventModalSheet", props, props.children),
}));
jest.mock("../../ui/AnchoredDropdown", () => ({
  AnchoredDropdown: (props: Record<string, unknown>) =>
    jest.requireActual("react").createElement("EventDropdown", props, props.visible ? props.children : null),
}));
jest.mock("../../ui/AnchoredDropdownOption", () => ({
  AnchoredDropdownOption: (props: Record<string, unknown>) =>
    jest.requireActual("react").createElement("EventDropdownOption", props, props.children),
}));

const event = {
  id: "event-a", organizationId: "org-a", title: "Evento original", description: "Descrição original",
  eventType: "treino" as const, sport: "geral" as const,
  startsAt: "2026-10-27T09:00:00-03:00", endsAt: "2026-10-27T11:00:00-03:00",
  locationLabel: "Quadra original", classIds: ["class-a"], ruleSetId: null,
  allDay: false, unitId: "unit-a", createdBy: "user-a", createdAt: "", updatedAt: "", hasMyClass: true,
};
const originalPlatform = Object.getOwnPropertyDescriptor(Platform, "OS")!;
let renderer: TestRenderer.ReactTestRenderer | undefined;
const flush = () => act(async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); });
const tree = () => renderer!.root;
const input = (placeholder: string) => tree().findAllByType(TextInput).find(node => node.props.placeholder === placeholder)!;
const modal = () => tree().findByType("EventModalSheet");
const dropdowns = () => tree().findAllByType("EventDropdown");
const button = (label: string) => {
  let node = tree().findAll(candidate => candidate.props.children === label)[0];
  while (node && typeof node.props.onPress !== "function") node = node.parent!;
  if (!node) throw new Error(`Missing event action: ${label}`);
  return node;
};
const noWrites = () => {
  expect(updateEvent).not.toHaveBeenCalled(); expect(setEventClasses).not.toHaveBeenCalled();
  expect(deleteEvent).not.toHaveBeenCalled();
};
const rerender = async () => {
  act(() => renderer!.update(React.createElement(EventDetailsScreen)));
  await flush();
};
const mount = async () => {
  act(() => {
    renderer = TestRenderer.create(React.createElement(EventDetailsScreen), {
      createNodeMock: () => ({ measureInWindow: (callback: (...args: number[]) => void) => callback(20, 30, 240, 50) }),
    });
  });
  await flush();
  expect(input("Título").props.value).toBe(event.title);
};
const edit = (value = "Título editado") => act(() => input("Título").props.onChangeText(value));
const leave = (navigate: () => void) => act(() => requestPendingEditsNavigation(navigate));
const pendingConfirmation = () => {
  let resolve!: (discard: boolean) => void;
  mockConfirm.mockImplementationOnce(() => new Promise<boolean>(release => { resolve = release; }));
  return (discard: boolean) => act(async () => { resolve(discard); await Promise.resolve(); });
};

beforeEach(() => {
  jest.clearAllMocks(); mockFocused = true; mockEventId = "event-a";
  mockSession = { user: { id: "user-a" } }; mockOrganization = { id: "org-a", role_level: 50 };
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  jest.mocked(getEventById).mockResolvedValue(event);
  jest.mocked(getClasses).mockResolvedValue([{ id: "class-a", name: "Turma A", unitId: "unit-a" }] as never);
  mockConfirm.mockResolvedValue(false);
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation(callback => { callback(0); return 0; });
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});
afterEach(() => {
  if (renderer) act(() => renderer!.unmount());
  renderer = undefined; jest.restoreAllMocks();
  Object.defineProperty(Platform, "OS", originalPlatform);
});

test("a retained event hides its modal and each open dropdown on blur, then restores the unsaved draft", async () => {
  await mount(); edit();
  act(() => button("Treino").props.onPress());
  expect(dropdowns()[0].props.visible).toBe(true);
  mockFocused = false; await rerender();
  expect(modal().props.visible).toBe(false);
  expect(dropdowns().every(dropdown => !dropdown.props.visible)).toBe(true);
  const navigate = jest.fn(); leave(navigate);
  expect(navigate).toHaveBeenCalledTimes(1); expect(mockConfirm).not.toHaveBeenCalled();
  mockFocused = true; await rerender();
  expect(modal().props.visible).toBe(true); expect(input("Título").props.value).toBe("Título editado");
  act(() => button("Geral").props.onPress()); expect(dropdowns()[1].props.visible).toBe(true);
  mockFocused = false; await rerender(); expect(dropdowns()[1].props.visible).toBe(false);
  noWrites();
});

test("clean navigation and close use the existing routes without a discard prompt", async () => {
  await mount(); const navigate = jest.fn(); leave(navigate);
  expect(navigate).toHaveBeenCalledTimes(1);
  act(() => modal().props.onClose());
  expect(mockRouter.back).toHaveBeenCalledTimes(1); expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(mockConfirm).not.toHaveBeenCalled(); noWrites();
});

test("cancel keeps all edited fields and blocks both sidebar navigation and explicit close", async () => {
  await mount(); edit(); act(() => input("Local").props.onChangeText("Novo local"));
  const navigate = jest.fn(); leave(navigate); await flush();
  expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
    title: "Sair sem salvar?", confirmLabel: "Descartar", cancelLabel: "Continuar editando",
  }));
  expect(navigate).not.toHaveBeenCalled(); expect(input("Título").props.value).toBe("Título editado");
  act(() => modal().props.onClose()); await flush();
  expect(mockRouter.back).not.toHaveBeenCalled(); expect(input("Local").props.value).toBe("Novo local"); noWrites();
});

test("accepted discard restores the retained form before future visits, without saving or refetching", async () => {
  await mount(); edit(); act(() => input("Local").props.onChangeText("Novo local"));
  act(() => input("Descrição").props.onChangeText("Nova descrição"));
  const reads = jest.mocked(getEventById).mock.calls.length;
  mockConfirm.mockResolvedValueOnce(true); const navigate = jest.fn(); leave(navigate); await flush();
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(input("Título").props.value).toBe(event.title); expect(input("Local").props.value).toBe(event.locationLabel);
  expect(input("Descrição").props.value).toBe(event.description);
  mockFocused = false; await rerender(); mockFocused = true; await rerender();
  expect(input("Título").props.value).toBe(event.title);
  const nextNavigate = jest.fn(); leave(nextNavigate); expect(nextNavigate).toHaveBeenCalledTimes(1);
  expect(mockConfirm).toHaveBeenCalledTimes(1); expect(getEventById).toHaveBeenCalledTimes(reads); noWrites();
});

test("concurrent leave requests share no extra prompt and cannot run the second callback", async () => {
  await mount(); edit(); const resolve = pendingConfirmation();
  const first = jest.fn(); const second = jest.fn(); leave(first); leave(second);
  expect(mockConfirm).toHaveBeenCalledTimes(1); await resolve(true);
  expect(first).toHaveBeenCalledTimes(1); expect(second).not.toHaveBeenCalled(); noWrites();
});

test("a refreshed baseline invalidates pending discard even when the current fields and scope stay equal", async () => {
  await mount(); edit(); const resolve = pendingConfirmation(); const navigate = jest.fn(); leave(navigate);
  const reads = jest.mocked(getEventById).mock.calls.length;
  jest.mocked(getEventById).mockResolvedValueOnce({ ...event, title: "Título editado" });
  // Refresh the same identity: neither the leave scope nor its focus epoch changes.
  mockSession = { user: { id: "user-a" } }; await rerender();
  expect(getEventById).toHaveBeenCalledTimes(reads + 1);
  expect(input("Título").props.value).toBe("Título editado");
  expect(button("Salvar alterações").props.disabled).toBe(true);
  await resolve(true);
  expect(navigate).not.toHaveBeenCalled(); expect(input("Título").props.value).toBe("Título editado");
  expect(mockConfirm).toHaveBeenCalledTimes(1); noWrites();
});

test.each(["blur", "blur-roundtrip", "user", "organization", "event", "permission", "edit", "unmount"])(
  "a pending confirmation cannot resume an obsolete %s context", async change => {
    await mount(); edit(); const resolve = pendingConfirmation(); const navigate = jest.fn(); leave(navigate);
    if (change === "blur" || change === "blur-roundtrip") {
      mockFocused = false; await rerender();
      if (change === "blur-roundtrip") { mockFocused = true; await rerender(); }
    } else if (change === "unmount") {
      act(() => renderer!.unmount()); renderer = undefined;
    } else {
      if (change === "user") mockSession = { user: { id: "user-b" } };
      if (change === "organization") mockOrganization = { id: "org-b", role_level: 50 };
      if (change === "event") mockEventId = "event-b";
      if (change === "permission") mockOrganization = { id: "org-a", role_level: 10 };
      if (change === "edit") edit("Edição mais recente");
      await rerender();
    }
    await resolve(true); expect(navigate).not.toHaveBeenCalled(); noWrites();
    if (change === "edit") expect(input("Título").props.value).toBe("Edição mais recente");
  }
);

test("saving blocks new navigation and explicit close until its own save completes", async () => {
  await mount(); edit();
  jest.mocked(validateTournamentRules).mockImplementationOnce(() => new Promise(() => {}));
  act(() => { void button("Salvar alterações").props.onPress(); }); await flush();
  expect(button("Salvando...").props.disabled).toBe(true);
  const navigate = jest.fn(); leave(navigate); act(() => modal().props.onClose()); await flush();
  expect(navigate).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockConfirm).not.toHaveBeenCalled(); noWrites();
});

test("native close retains its prior behavior and does not register a web navigation guard", async () => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
  await mount(); edit(); const navigate = jest.fn(); leave(navigate);
  expect(navigate).toHaveBeenCalledTimes(1); act(() => modal().props.onClose());
  expect(mockRouter.back).toHaveBeenCalledTimes(1); expect(mockConfirm).not.toHaveBeenCalled(); noWrites();
});
