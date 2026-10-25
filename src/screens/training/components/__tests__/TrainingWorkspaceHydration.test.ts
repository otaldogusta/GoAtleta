import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Platform } from "react-native";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transformSync } from "@babel/core";
import * as t from "@babel/types";
import type { TrainingPlan } from "../../../../core/models";
import type { TrainingPlanSummary } from "../../../../db/training";

let mockParams: Record<string, string> = {};
let mockUser = "teacher-a";
let mockOrganization = "org-a";
let mockGeneration = 1;
let mockCacheGeneration = 1;
const mockGetSummaries = jest.fn();
const mockGetById = jest.fn();
const mockGetLegacyPlans = jest.fn();
const mockSavePlan = jest.fn();
const mockLoadLocalPlans = jest.fn();
const mockClearDraft = jest.fn(async () => undefined);
const mockFlushDraft = jest.fn(async () => ({ persisted: true }));
const mockQueueDraft = jest.fn();
const mockToast = jest.fn();
const mockConfirm = jest.fn(async () => true);
const mockNoop = () => undefined;

jest.mock("expo-router", () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView", useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../../../../auth/auth", () => ({ useAuth: () => ({ session: { user: { id: mockUser } } }) }));
jest.mock("../../../../auth/session", () => ({
  getSessionIdentity: () => ({ userId: mockUser, generation: mockGeneration }),
  isSessionIdentityCurrent: (identity: { userId: string; generation: number }) => identity.userId === mockUser && identity.generation === mockGeneration,
}));
jest.mock("../../../../providers/organization-context", () => ({ useOptionalOrganization: () => ({ activeOrganization: { id: mockOrganization } }) }));
jest.mock("../../../../db/client", () => ({ getReadCacheGeneration: () => mockCacheGeneration }));
jest.mock("../../../../db/training", () => ({ getTrainingPlanSummaries: (...args: unknown[]) => mockGetSummaries(...args), getTrainingPlanById: (...args: unknown[]) => mockGetById(...args) }));
jest.mock("../../../../db/seed", () => ({
  getClasses: jest.fn(async () => [{ id: "class-a", name: "Turma A", unit: "Unidade", organizationId: "org-a", daysOfWeek: [1] }]),
  getTrainingPlans: (...args: unknown[]) => mockGetLegacyPlans(...args),
  getLatestTrainingPlanByClass: jest.fn(async () => null),
  saveTrainingPlan: (...args: unknown[]) => mockSavePlan(...args), deleteTrainingPlan: jest.fn(), upsertTrainingSession: jest.fn(),
}));
jest.mock("../../../../copilot/CopilotProvider", () => ({ useCopilotContext: () => undefined }));
jest.mock("../../../../navigation/use-trainer-route-scope", () => ({ useTrainerRouteScope: () => ({ home: "/prof/home" }) }));
jest.mock("../../../../hooks/use-effective-profile", () => ({ useEffectiveProfile: () => "professor" }));
jest.mock("../../../../notifications", () => ({ notifyTrainingSaved: jest.fn() }));
jest.mock("../../../../observability/perf", () => ({ markRender: jest.fn(), measure: (_name: string, run: () => unknown) => run(), measureAsync: (_name: string, run: () => unknown) => run() }));
jest.mock("../../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { background: "#fff", text: "#111", card: "#fff", border: "#ddd", muted: "#777" } }) }));
jest.mock("../../../../ui/use-responsive-layout", () => ({ useResponsiveLayout: () => ({ isMobile: false, canPersistExpandedSidebar: true }) }));
jest.mock("../../../../ui/use-collapsible", () => ({ useCollapsibleAnimation: (visible: boolean) => ({ animatedStyle: {}, isVisible: visible }) }));
jest.mock("../../../../ui/use-modal-card-style", () => ({ useModalCardStyle: () => ({}) }));
jest.mock("../../../../ui/use-persisted-state", () => ({ usePersistedState: (_key: string, initial: unknown) => [...jest.requireActual("react").useState(initial), true] }));
jest.mock("../../../../ui/save-toast", () => ({ useSaveToast: () => ({ showSaveToast: mockToast }) }));
jest.mock("../../../../ui/confirm-dialog", () => ({ useConfirmDialog: () => ({ confirm: mockConfirm }) }));
jest.mock("../../../../ui/confirm-undo", () => ({ useConfirmUndo: () => ({ confirm: jest.fn() }) }));
jest.mock("../../../../ui/Pressable", () => ({ Pressable: "Pressable" }));
jest.mock("../../../../ui/icon-registry", () => ({ GoAtletaIcon: "Icon" }));
jest.mock("../../../../ui/ModalSheet", () => ({ ModalSheet: ({ visible, children }: { visible?: boolean; children: unknown }) => visible ? children : null }));
jest.mock("../../../../ui/ConfirmCloseOverlay", () => ({ ConfirmCloseOverlay: () => null }));
jest.mock("../../../../components/ui/ScreenPageHeader", () => ({ ScreenPageHeader: "ScreenHeader" }));
jest.mock("../../../../components/ui/SectionLoadingState", () => ({ SectionLoadingState: "Loading" }));
jest.mock("../PlanningLibraryBridgeSheet", () => ({ PlanningLibraryBridgeSheet: () => null }));
jest.mock("../TrainingPlanningWorkspaceLibrary", () => ({ TrainingPlanningWorkspaceLibrary: "PlanLibrary" }));
jest.mock("../../../classes/components/ClassPlanPreviewModal", () => ({ ClassPlanPreviewModal: (props: object) => jest.requireActual("react").createElement("PlanPreview", props) }));
jest.mock("../TrainingApplyModalContent", () => ({ TrainingApplyModalContent: (props: object) => jest.requireActual("react").createElement("PlanApply", props) }));
jest.mock("../TrainingPlanActionsModalContent", () => ({ TrainingPlanActionsModalContent: () => null }));
jest.mock("../TrainingSessionCreateModalContent", () => ({ TrainingSessionCreateModalContent: () => null }));
jest.mock("../TrainingPlanPdfImportModal", () => ({ TrainingPlanPdfImportModal: () => null }));
jest.mock("../TrainingSpreadsheetImportModal", () => ({ TrainingSpreadsheetImportModal: () => null }));
jest.mock("../../hooks/useTrainingPlanWorkspaceDraft", () => ({ useTrainingPlanWorkspaceDraft: () => ({
  restoredDraft: null, status: "idle", isHydrated: true, queueDraft: mockQueueDraft,
  flushDraft: mockFlushDraft, clearDraft: mockClearDraft, consumeRestoredDraft: mockNoop,
}) }));
jest.mock("../../application/training-plan-workspace-draft", () => ({
  ...jest.requireActual("../../application/training-plan-workspace-draft"),
  loadTrainingPlanWorkspaceLibrary: (...args: unknown[]) => mockLoadLocalPlans(...args),
}));

// Execute the real route and hooks. Adapt only import() transport to Jest's
// require resolver so lazy document boundaries can use their component mocks.
const routePath = resolve(__dirname, "../../../../../app/training/index.tsx");
const routeCode = transformSync(readFileSync(routePath, "utf8"), {
  filename: routePath, configFile: false, babelrc: false,
  presets: [["babel-preset-expo", { enableBabelRuntime: false }]],
  caller: { name: "training-ui-contract", isDev: true, supportsStaticESM: false, supportsReactCompiler: false },
  plugins: [() => ({ visitor: { CallExpression(value: { node: t.CallExpression; replaceWith: (node: t.Expression) => void }) {
    if (value.node.callee.type !== "Import") return;
    value.replaceWith(t.callExpression(t.memberExpression(
      t.callExpression(t.memberExpression(t.identifier("Promise"), t.identifier("resolve")), []),
      t.identifier("then")), [t.arrowFunctionExpression([], t.callExpression(t.identifier("require"), value.node.arguments))]));
  } } })],
})!.code!;
const routeModule = { exports: {} as { default?: () => ReturnType<typeof createElement> } };
new Function("module", "exports", "require", routeCode)(routeModule, routeModule.exports,
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Preserve Jest's mocks for route imports and lazy component boundaries.
  (name: string) => require(name.startsWith(".") ? resolve(routePath, "..", name) : name));
const TrainingList = routeModule.exports.default!;

const summary = (id = "plan-a"): TrainingPlanSummary => ({
  id, classId: "class-a", title: `Plano ${id}`, tags: ["passe"], applyDate: "2026-10-24",
  applyDays: [1], createdAt: "2026-10-01T00:00:00.000Z", version: 2, status: "final",
});
const full = (id = "plan-a"): TrainingPlan => ({
  ...summary(id), warmup: ["Aquecimento completo"], main: ["Conteúdo completo do plano"],
  cooldown: ["Volta à calma"], warmupTime: "10", mainTime: "40", cooldownTime: "10",
  pedagogy: { focus: { skill: "passe" } },
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(finish => { resolve = finish; });
  return { promise, resolve };
};
const settle = async () => { await act(async () => { for (let step = 0; step < 24; step++) await Promise.resolve(); }); };
let renderer: TestRenderer.ReactTestRenderer;
const mount = async () => {
  await act(async () => { renderer = TestRenderer.create(createElement(TrainingList)); });
  await settle();
  return renderer;
};
const library = () => renderer.root.findByType("PlanLibrary" as never);
const previews = () => renderer.root.findAllByType("PlanPreview" as never);
const select = async (id = "plan-a") => {
  act(() => library().props.onSelectPlan(library().props.plans.find((plan: TrainingPlanSummary) => plan.id === id)));
  await settle();
};
const originalPlatform = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {}; mockUser = "teacher-a"; mockOrganization = "org-a"; mockGeneration = 1; mockCacheGeneration = 1;
  mockGetSummaries.mockResolvedValue([summary(), summary("plan-b")]);
  mockGetById.mockImplementation(async id => full(id));
  mockLoadLocalPlans.mockResolvedValue([]);
  mockConfirm.mockResolvedValue(true);
  mockSavePlan.mockResolvedValue(undefined);
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  Object.defineProperty(Platform, "OS", { value: originalPlatform, configurable: true });
});

it("loads only summaries at startup and gives the editor the complete selected body", async () => {
  await mount();
  expect(mockGetSummaries).toHaveBeenCalledWith({ organizationId: "org-a" });
  expect(mockGetLegacyPlans).not.toHaveBeenCalled();
  expect(mockGetById).not.toHaveBeenCalled();
  expect(library().props.plans).toEqual([summary(), summary("plan-b")]);
  expect(previews()).toHaveLength(0);
  await select();
  expect(mockGetById).toHaveBeenCalledWith("plan-a", { organizationId: "org-a" });
  expect(previews()[0].props.plan).toEqual(full());
});

it.each(["viewPlanId", "applyPlanId"])("hydrates the %s deep link before opening its full document", async key => {
  mockParams = { [key]: "plan-a" };
  const pending = deferred<TrainingPlan>();
  mockGetById.mockReturnValueOnce(pending.promise);
  await mount();
  expect(previews()).toHaveLength(0);
  expect(renderer.root.findAllByType("PlanApply" as never)).toHaveLength(0);
  await act(async () => { pending.resolve(full()); });
  await settle();
  if (key === "viewPlanId") expect(previews()[0].props.plan).toEqual(full());
  else {
    act(() => renderer.root.findByType("PlanApply" as never).props.actions.setApplyDate("2026-10-25"));
    await settle();
    await act(async () => { await renderer.root.findByType("PlanApply" as never).props.actions.onApply(); });
    expect(mockSavePlan).toHaveBeenCalledWith(expect.objectContaining({ main: full().main, pedagogy: full().pedagogy }));
  }
});

it("hydrates the plan matching a web class/date route before showing its document", async () => {
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
  mockParams = { targetClassId: "class-a", targetDate: "2026-10-24" };
  await mount();
  expect(mockGetById).toHaveBeenCalledWith("plan-a", { organizationId: "org-a" });
  expect(previews()[0].props.plan).toEqual(full());
});

it("keeps a complete local draft without requesting its body remotely", async () => {
  const draft = { ...full("local-draft"), classId: "" };
  mockLoadLocalPlans.mockResolvedValue([draft]);
  await mount();
  expect(library().props.plans[0]).not.toHaveProperty("main");
  await select(draft.id);
  expect(mockGetById).not.toHaveBeenCalled();
  expect(previews()[0].props.plan).toEqual(draft);
});

it("discards the slower first selection instead of replacing the latest selected plan", async () => {
  const old = deferred<TrainingPlan>();
  mockGetById.mockImplementation(id => id === "plan-a" ? old.promise : Promise.resolve(full(id)));
  await mount();
  await select("plan-a");
  await select("plan-b");
  expect(previews()[0].props.plan.id).toBe("plan-b");
  await act(async () => { old.resolve(full("plan-a")); });
  expect(previews()[0].props.plan.id).toBe("plan-b");
});

it.each(["logout", "workspace", "workspace round trip"])("discards a body after %s changes", async kind => {
  const pending = deferred<TrainingPlan>();
  mockGetById.mockReturnValueOnce(pending.promise);
  await mount(); await select();
  if (kind === "logout") { mockUser = ""; mockGeneration += 1; }
  if (kind === "workspace") { mockOrganization = "org-b"; mockCacheGeneration += 1; }
  if (kind === "workspace round trip") mockCacheGeneration += 2;
  await act(async () => { renderer.update(createElement(TrainingList)); pending.resolve(full()); });
  await settle();
  expect(previews()).toHaveLength(0);
});

it.each([null, new Error("Failed to fetch")])("keeps the edited draft and does not confirm or clear it when hydration fails (%s)", async failure => {
  await mount(); await select();
  act(() => {
    previews()[0].props.onDirtyChange(true);
    previews()[0].props.onDraftChange({ ...full(), main: ["Texto editado ainda não salvo"] });
  });
  mockConfirm.mockClear(); mockClearDraft.mockClear();
  if (failure) mockGetById.mockRejectedValueOnce(failure);
  else mockGetById.mockResolvedValueOnce(null);
  await select("plan-b");
  expect(previews()[0].props.plan.id).toBe("plan-a");
  expect(mockConfirm).not.toHaveBeenCalled();
  expect(mockClearDraft).not.toHaveBeenCalled();
  expect(mockQueueDraft).toHaveBeenCalledWith(expect.objectContaining({ main: ["Texto editado ainda não salvo"] }), expect.any(String));
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: failure ? "error" : "warning" }));
});

it("keeps edits made while a different plan body is loading", async () => {
  await mount(); await select();
  const pending = deferred<TrainingPlan>();
  mockGetById.mockReturnValueOnce(pending.promise);
  await select("plan-b");
  act(() => {
    previews()[0].props.onDirtyChange(true);
    previews()[0].props.onDraftChange({ ...full(), main: ["Edição durante a espera"] });
  });
  await act(async () => { pending.resolve(full("plan-b")); });
  expect(previews()[0].props.plan.id).toBe("plan-a");
  expect(mockConfirm).not.toHaveBeenCalled();
  expect(mockClearDraft).not.toHaveBeenCalled();
});

it("keeps the persisted draft when the user cancels replacement after hydration", async () => {
  await mount(); await select();
  act(() => previews()[0].props.onDirtyChange(true));
  mockConfirm.mockResolvedValueOnce(false);
  await select("plan-b");
  expect(mockGetById).toHaveBeenLastCalledWith("plan-b", { organizationId: "org-a" });
  expect(mockFlushDraft).toHaveBeenCalledTimes(1);
  expect(mockConfirm).toHaveBeenCalledTimes(1);
  expect(mockClearDraft).not.toHaveBeenCalled();
  expect(previews()[0].props.plan.id).toBe("plan-a");
});
