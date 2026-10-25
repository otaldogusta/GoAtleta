import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { readSharedVideo, SharedVideoError, type SharedVideo } from "../../../api/scouting-video-sharing";
import { newVideoDocument } from "../../../core/scouting-video";
import { videoStudioPermissions } from "../../../core/scouting-video-sharing";
import { loadLazySource } from "../../../ui/__tests__/lazy-source-fixture";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockModuleLoaded = jest.fn();
const mockStudioRendered = jest.fn();
let mockStudioReady = true;
let mockStudioGate: Promise<void>;
let mockChunkFailures = 0;
let mockIdentityCurrent = true;
const mockSessionListeners = new Set<() => void>();
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("react-dom", () => ({ createPortal: (children: React.ReactNode) => children }));
jest.mock("../../../auth/session", () => ({
  getSessionIdentity: () => ({ userId: "viewer", generation: 1 }),
  isSessionIdentityCurrent: () => mockIdentityCurrent,
  subscribeSession: (listener: () => void) => { mockSessionListeners.add(listener); return () => mockSessionListeners.delete(listener); },
}));
jest.mock("../../../api/scouting-video-sharing", () => ({ readSharedVideo: jest.fn(), SharedVideoError: class extends Error {
  code: string; constructor(value: string) { super(value); this.code = value; }
} }));
jest.mock("../../../observability/perf", () => ({ markRender: () => {}, measureAsync: (_name: string, load: () => Promise<unknown>) => load() }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { background: "#111", text: "#eee" } }) }));
jest.mock("../video/StudioUI.web", () => ({ StudioAction: (props: object) => jest.requireActual("react").createElement("button", props) }));

const id = "20000000-0000-0000-0000-000000000001", code = "a".repeat(64);
const record: SharedVideo = {
  document: newVideoDocument({ fingerprint: "shared", name: "Vídeo da análise", duration: 20, width: 1280, height: 720 }, "rally-1"),
  teamName: "Turma fixture", title: "Revisão compartilhada", opponent: "Outra equipe", updatedAt: "2026-10-24", expiresAt: null,
  permission: "viewer", mediaUrl: "https://fixture.invalid/storage/v1/object/sign/scouting-videos/fixture", mediaExpiresAt: Date.now() + 120000,
};
const descriptors = Object.fromEntries(["window", "document", "sessionStorage"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let view: ReactTestRenderer | undefined;
let SharedVideoScreen: React.ComponentType;
let windowListeners: Map<string, () => void>;
const flush = () => act(async () => { for (let count = 0; count < 12; count++) await Promise.resolve(); });
const mount = async () => { act(() => { view = create(React.createElement(SharedVideoScreen)); }); await flush(); };
const studio = () => view!.root.findAllByType("shared-studio" as never);
const action = (label: string) => view!.root.findAllByType("button").find(node => node.props.label === label)!;

beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers(); mockStudioReady = true; mockChunkFailures = 0; mockIdentityCurrent = true; mockSessionListeners.clear(); windowListeners = new Map();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { hash: `#id=${id}&code=${code}` }, history: { replaceState: jest.fn() },
    addEventListener: (name: string, callback: () => void) => windowListeners.set(name, callback),
    removeEventListener: (name: string) => windowListeners.delete(name),
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    body: {}, visibilityState: "visible", addEventListener: jest.fn(), removeEventListener: jest.fn(),
  } });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() } });
  jest.mocked(readSharedVideo).mockResolvedValue(record);
  SharedVideoScreen = loadLazySource<{ default: React.ComponentType }>("src/screens/scouting/video/SharedVideoScreen.web.tsx", async name => {
    expect(name).toBe("./ScoutingVideoStudio.web"); mockModuleLoaded();
    if (mockChunkFailures) { mockChunkFailures--; throw new Error("Studio chunk unavailable"); }
    if (!mockStudioReady) await mockStudioGate;
    return { Studio: (props: object) => {
      mockStudioRendered(props);
      return React.createElement("shared-studio", props);
    } };
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Resolve the real source's dependencies through this test's registered Jest boundaries.
  }, name => require(name.startsWith("./") ? `../video/${name.slice(2)}` : name)).default;
});
afterEach(() => {
  act(() => { view?.unmount(); view = undefined; }); jest.useRealTimers();
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

test("authorization precedes the Studio import and its pending chunk reuses the existing reader status", async () => {
  let releaseRead!: (value: SharedVideo) => void, releaseStudio!: () => void;
  mockStudioReady = false; mockStudioGate = new Promise(resolve => { releaseStudio = resolve; });
  jest.mocked(readSharedVideo).mockImplementationOnce(() => new Promise(resolve => { releaseRead = resolve; }));
  await mount(); expect(readSharedVideo).toHaveBeenCalledWith(id, code, expect.any(AbortSignal));
  expect(mockModuleLoaded).not.toHaveBeenCalled(); expect(studio()).toHaveLength(0);
  const previousStatus = view!.root.findByProps({ className: "sv sv-shared-status" });
  const style = previousStatus.props.style;
  expect(view!.root.findByProps({ role: "status" }).props.children).toBe("Abrindo análise…");
  await act(async () => releaseRead(record));
  expect(mockModuleLoaded).toHaveBeenCalledTimes(1); expect(studio()).toHaveLength(0);
  expect(view!.root.findByProps({ className: "sv sv-shared-status" }).props.style).toEqual(style);
  expect(view!.root.findByProps({ role: "status" }).props.children).toBe("Abrindo análise…");
  mockStudioReady = true; await act(async () => releaseStudio());
  expect(studio()).toHaveLength(1);
  expect(studio()[0].props).toMatchObject({ org: "", userId: "", classId: "", sessionId: "", students: [],
    session: { title: record.title, opponent: record.opponent, status: "concluido" },
    shared: { document: record.document, source: record.mediaUrl }, teamName: record.teamName });
  expect(Object.values(videoStudioPermissions(true, false, false))).toEqual([false, false, false, false, false]);
  act(() => studio()[0].props.onClose()); expect(mockRouter.replace).toHaveBeenCalledWith("/");
});

test("a rejected Studio chunk uses the existing reader error and retry recovers without a root crash", async () => {
  mockChunkFailures = 1; await mount();
  expect(studio()).toHaveLength(0); expect(mockStudioRendered).not.toHaveBeenCalled();
  expect(view!.root.findByProps({ role: "alert" }).props.children).toBe("Não foi possível abrir a análise. Tente novamente.");
  expect(mockModuleLoaded).toHaveBeenCalledTimes(1);
  act(() => action("Tentar novamente").props.onPress()); await flush();
  expect(mockModuleLoaded).toHaveBeenCalledTimes(2); expect(readSharedVideo).toHaveBeenCalledTimes(2);
  expect(studio()).toHaveLength(1); expect(studio()[0].props.shared.document).toBe(record.document);
});

test("login-required and denied readers never render a Studio or expose an editable preview", async () => {
  jest.mocked(readSharedVideo).mockRejectedValueOnce(new SharedVideoError("LOGIN_REQUIRED"));
  await mount(); expect(studio()).toHaveLength(0); expect(mockStudioRendered).not.toHaveBeenCalled();
  act(() => action("Entrar para assistir").props.onPress());
  expect(sessionStorage.setItem).toHaveBeenCalledWith("goatleta:shared-video-login", new URLSearchParams({ id, code }).toString());
  expect(mockRouter.push.mock.calls[0][0]).toContain("/login");
  act(() => { view!.unmount(); view = undefined; });
  jest.mocked(readSharedVideo).mockRejectedValueOnce(new SharedVideoError("ACCESS_DENIED"));
  await mount(); expect(studio()).toHaveLength(0); expect(mockStudioRendered).not.toHaveBeenCalled();
  expect(view!.root.findByProps({ role: "alert" }).props.children).toBe("Sua conta não tem acesso a esta análise.");
});

test("identity replacement aborts the old read and its late document cannot enter the lazy reader", async () => {
  let releaseOld!: (value: SharedVideo) => void, releaseNew!: (value: SharedVideo) => void;
  jest.mocked(readSharedVideo).mockImplementationOnce(() => new Promise(resolve => { releaseOld = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { releaseNew = resolve; }));
  await mount(); const signal = jest.mocked(readSharedVideo).mock.calls[0][2];
  mockIdentityCurrent = false; act(() => { for (const listener of mockSessionListeners) listener(); }); await flush();
  expect(signal.aborted).toBe(true); expect(studio()).toHaveLength(0);
  await act(async () => releaseOld({ ...record, title: "Documento obsoleto" })); expect(studio()).toHaveLength(0);
  await act(async () => releaseNew(record)); expect(studio()[0].props.session.title).toBe(record.title);
});

test("shared YouTube source and viewer document reach the same Studio without local authoring identifiers", async () => {
  const youtube = { ...record, mediaUrl: "youtube:M7lc1UVf-VE", document: { ...record.document,
    media: { ...record.document.media, youtubeId: "M7lc1UVf-VE" } } };
  jest.mocked(readSharedVideo).mockResolvedValueOnce(youtube); await mount();
  expect(studio()[0].props.shared.document).toBe(youtube.document); expect(studio()[0].props.shared.source).toBe(youtube.mediaUrl);
  expect(studio()[0].props.session.status).toBe("concluido"); expect(studio()[0].props.userId).toBe("");
  expect(studio()[0].props.org).toBe(""); expect(studio()[0].props.students).toEqual([]);
});

test.each(["identity", "access"])("an old chunk completion cannot display the previous viewer document after %s changes", async change => {
  let releaseStudio!: () => void, releaseNew!: (value: SharedVideo) => void;
  mockStudioReady = false; mockStudioGate = new Promise(resolve => { releaseStudio = resolve; });
  jest.mocked(readSharedVideo).mockResolvedValueOnce(record)
    .mockImplementationOnce(() => new Promise(resolve => { releaseNew = resolve; }));
  await mount(); expect(mockModuleLoaded).toHaveBeenCalledTimes(1); expect(studio()).toHaveLength(0);
  act(() => {
    if (change === "identity") { mockIdentityCurrent = false; for (const listener of mockSessionListeners) listener(); }
    else { window.location.hash = `#id=20000000-0000-0000-0000-000000000002&code=${"b".repeat(64)}`; windowListeners.get("hashchange")!(); }
  }); await flush();
  mockStudioReady = true; await act(async () => releaseStudio());
  expect(studio()).toHaveLength(0); expect(mockStudioRendered).not.toHaveBeenCalled();
  await act(async () => releaseNew({ ...record, title: "Novo acesso autorizado" }));
  expect(studio()[0].props.session.title).toBe("Novo acesso autorizado");
});

test("a chunk completing after leaving the reader never mounts the old Studio", async () => {
  let releaseStudio!: () => void; mockStudioReady = false; mockStudioGate = new Promise(resolve => { releaseStudio = resolve; });
  await mount(); expect(mockModuleLoaded).toHaveBeenCalledTimes(1);
  act(() => { view!.unmount(); view = undefined; });
  mockStudioReady = true; await act(async () => releaseStudio());
  expect(mockStudioRendered).not.toHaveBeenCalled(); expect(mockSessionListeners.size).toBe(0);
});
