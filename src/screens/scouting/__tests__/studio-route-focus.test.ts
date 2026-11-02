import { createElement } from "react";
import { createPortal } from "react-dom";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { newVideoDocument, videoTime, type VideoDocument } from "../../../core/scouting-video";
import ScoutingVideoStudio, { Studio } from "../video/ScoutingVideoStudio.web";
import { useVideoDraft } from "../video/use-video-draft";
import { inspectVideo } from "../video/video-media.web";
import { mountYouTube } from "../video/youtube-player.web";
import { loadScoutingDetail } from "../../../db/scouting-collection";
import { requestPendingEditsNavigation } from "../../../navigation/pending-edits-navigation";

jest.mock("react-dom", () => ({ createPortal: jest.fn((children: unknown) => children) }));
jest.mock("../video/use-video-draft", () => ({ useVideoDraft: jest.fn() }));
jest.mock("../video/video-media.web", () => ({ inspectVideo: jest.fn() }));
jest.mock("../video/youtube-player.web", () => ({ mountYouTube: jest.fn() }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../observability/perf", () => ({
  markRender: () => {}, measureAsync: (_name: string, load: () => Promise<unknown>) => load(),
}));
jest.mock("../../../db/scouting-collection", () => ({ loadScoutingDetail: jest.fn() }));
jest.mock("../../../api/scouting-video-drive", () => ({ driveTrackingAvailable: () => false }));
jest.mock("../../../api/scouting-video-ai", () => ({ localVideoAiAvailable: () => false }));
jest.mock("../video/video-processing.web", () => ({ processScoutingVideo: jest.fn() }));
jest.mock("../video/studio-styles", () => ({ studioStyles: "" }));
jest.mock("../video/StudioUI.web", () => ({
  StudioAction: (props: object) => jest.requireActual("react").createElement("button", props),
  StudioDialog: (props: Record<string, unknown>) => jest.requireActual("react").createElement("studio-dialog", props, props.children),
}));
jest.mock("../video/StudioPanel.web", () => ({ StudioPanel: ({ children }: { children: unknown }) => children }));
jest.mock("../video/StudioSelect.web", () => ({
  StudioSelect: (props: object) => jest.requireActual("react").createElement("studio-select", props),
}));
jest.mock("../video/VideoGallery.web", () => ({ VideoGallery: () => null }));
jest.mock("../video/VideoTimeline.web", () => ({ VideoTimeline: (props:object) => jest.requireActual('react').createElement('video-timeline',props) }));
jest.mock("../video/VideoBufferStatus.web", () => ({ VideoBufferStatus: () => null }));
jest.mock("../video/VideoTrackingOverlay.web", () => ({ VideoTrackingOverlay: () => null }));
jest.mock("../video/VideoCorrectionLens.web", () => ({ VideoCorrectionLens: () => null }));
jest.mock("../video/VideoLinkField.web", () => ({ VideoLinkField: () => null }));
jest.mock("../video/VideoScoutingReview.web", () => ({ VideoScoutingReview: (props:object) => jest.requireActual('react').createElement('review-scouting',props) }));
jest.mock("../video/VideoRallyRange.web", () => ({ VideoRallyRange: () => null }));
let mockAnalysisMounts = 0, mockAnalysisDisposals = 0;
jest.mock("../video/YouTubeAnalysis.web", () => ({ YouTubeAnalysis: () => { jest.requireActual('react').useEffect(() => { mockAnalysisMounts++; return () => { mockAnalysisDisposals++; }; }, []); return null; } }));
jest.mock("../video/YouTubeTrackingSetup.web", () => ({ YouTubeTrackingSetup: () => null }));
jest.mock("../video/DriveTrackingSetup.web", () => ({ DriveTrackingSetup: () => null }));
jest.mock("../video/YouTubeTrackingPanel.web", () => ({ YouTubeTrackingPanel: () => null }));
jest.mock("../video/VideoShareDialog.web", () => ({ VideoShareDialog: () => null }));
jest.mock("../video/VideoContactEditor.web", () => ({
  VideoContactEditor: (props: object) => jest.requireActual("react").createElement("contact-editor", props),
}));

const media = { fingerprint: "fixture-video", name: "fixture.mp4", duration: 60, width: 1280, height: 720 };
const base = newVideoDocument(media, "rally-a");
const documentFixture: VideoDocument = { ...base, contacts: [{
  id: "contact-a", time: 2, skill: "Ataque" as const, team: "us" as const,
  athlete: "", studentId: null, outcome: "Em jogo",
}] };
const studioProps = {
  org: "org-a", userId: "user-a", classId: "class-a", sessionId: "session-a", teamName: "Turma A", students: [],
  onClose: jest.fn(), session: { title: "Análise", opponent: "Outra equipe", status: "em_andamento" as const },
};
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalResize = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
const savedAdd = window.addEventListener, savedRemove = window.removeEventListener;
const originalCreateUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
let view: ReactTestRenderer | undefined;
let rootElement: { inert: boolean };
let body: { style: { overflow: string } };
let previousFocus: { focus: jest.Mock };
let handlers: Map<string, Set<unknown>>;
let observers: { disconnect: jest.Mock }[];
const add = (name: string, callback: unknown) => {
  const listeners = handlers.get(name) ?? new Set(); listeners.add(callback); handlers.set(name, listeners);
};
const remove = (name: string, callback: unknown) => handlers.get(name)?.delete(callback);
const handlerCount = () => [...handlers.values()].reduce((sum, listeners) => sum + listeners.size, 0);
const makePlayback = () => {
  const value = { currentTime: 0, paused: true, playbackRate: 1,
    play: jest.fn(async () => { value.paused = false; }), pause: jest.fn(() => { value.paused = true; }) };
  return value;
};
type LocalVideo = ReturnType<typeof makePlayback> & {
  cancelVideoFrameCallback: jest.Mock; addEventListener: jest.Mock; removeEventListener: jest.Mock;
};
let videos: LocalVideo[];
const nodeMock = ({ type }: { type: unknown }) => {
  if (type === "video") {
    const video = { ...makePlayback(), duration: 60, readyState: 2, videoWidth: 1280, videoHeight: 720,
      ownerDocument: globalThis.document, requestVideoFrameCallback: jest.fn(() => 1), cancelVideoFrameCallback: jest.fn(),
      addEventListener: jest.fn(), removeEventListener: jest.fn(), removeAttribute: jest.fn(), load: jest.fn() };
    // Keep playback methods bound to the same observable native node.
    video.play = jest.fn(async () => { video.paused = false; }); video.pause = jest.fn(() => { video.paused = true; });
    videos.push(video); return video;
  }
  if (type === "canvas") return { getContext: () => ({ clearRect: jest.fn(), drawImage: jest.fn() }), width: 0, height: 0 };
  return { getBoundingClientRect: () => ({ width: 1280, height: 720 }), scrollIntoView: jest.fn(), focus: jest.fn() };
};
const draftFixture = () => ({
  doc: documentFixture, history: { present: documentFixture, past: [], future: [] }, dirty: false, saving: false,
  loading: false, syncStatus: "synced", conflict: null, error: "", open: jest.fn(async () => {}),
  save: jest.fn(async () => true), change: jest.fn(), undo: jest.fn(), setError: jest.fn(),
  retrySync: jest.fn(async () => true), resolveConflict: jest.fn(async () => true),
});
let draft: ReturnType<typeof draftFixture>;
const action = (label: string) => view!.root.findAllByType("button").find(node => node.props.label === label)!;
const setRate = () => act(() => view!.root.findAllByType("studio-select" as never)
  .find(node => node.props.label === "Velocidade de reprodução")!.props.onChange(".5"));
const focus = (active: boolean) => act(() => view!.update(createElement(Studio, { ...studioProps, active })));
const mount = (active = true) => act(() => {
  view = create(createElement(Studio, { ...studioProps, active }), { createNodeMock: nodeMock });
});
const attach = async () => {
  await act(async () => {
    const input = view!.root.findAllByType("input").filter(node => node.props.type === "file" && node.props.accept.startsWith("video/"))[1];
    input.props.onChange({ target: { files: [{ name: "fixture.mp4" }], value: "selected" } });
  });
  const dialog = view!.root.findAllByType("studio-dialog" as never).find(node => node.props.title === "Adicionar vídeo");
  if (dialog) act(() => dialog.props.onClose());
};

beforeEach(() => {
  jest.clearAllMocks(); handlers = new Map(); observers = []; videos = []; mockAnalysisMounts=0; mockAnalysisDisposals=0;
  rootElement = { inert: false }; body = { style: { overflow: "scroll" } }; previousFocus = { focus: jest.fn() };
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    getElementById: () => rootElement, activeElement: previousFocus, body, hidden: false,
    addEventListener: add, removeEventListener: remove,
  } });
  window.addEventListener = jest.fn(add); window.removeEventListener = jest.fn(remove);
  Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: class {
    disconnect = jest.fn(); observe = jest.fn(); constructor() { observers.push(this); }
  } });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:fixture") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
  jest.mocked(inspectVideo).mockResolvedValue(media);
  draft = draftFixture(); jest.mocked(useVideoDraft).mockReturnValue(draft as never);
});
afterEach(() => {
  act(() => { view?.unmount(); view = undefined; });
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else Reflect.deleteProperty(globalThis, "document");
  if (originalResize) Object.defineProperty(globalThis, "ResizeObserver", originalResize); else Reflect.deleteProperty(globalThis, "ResizeObserver");
  window.addEventListener = savedAdd; window.removeEventListener = savedRemove;
  if (originalCreateUrl) Object.defineProperty(URL, "createObjectURL", originalCreateUrl); else Reflect.deleteProperty(URL, "createObjectURL");
  if (originalRevokeUrl) Object.defineProperty(URL, "revokeObjectURL", originalRevokeUrl); else Reflect.deleteProperty(URL, "revokeObjectURL");
});

test("route blur pauses native playback and removes media, frames, listeners and page locks without saving", async () => {
  mount(); await attach(); expect(view!.root.findAllByType("video")).toHaveLength(1);
  expect(useVideoDraft).toHaveBeenLastCalledWith('org-a', 'user-a', 'session-a', undefined, true, true);
  const native = videos.at(-1)!; native.currentTime = 12.25; setRate();
  act(() => view!.root.findByType("video").props.onTimeUpdate());
  await act(async () => { action("Reproduzir vídeo").props.onPress(); }); expect(native.paused).toBe(false);
  act(() => view!.root.findByType("video").props.onPlay());
  draft.save.mockClear(); draft.open.mockClear();
  expect(rootElement.inert).toBe(true); expect(body.style.overflow).toBe("hidden"); expect(handlerCount()).toBeGreaterThan(0);
  focus(false);
  expect(useVideoDraft).toHaveBeenLastCalledWith('org-a', 'user-a', 'session-a', undefined, true, false);
  expect(native.pause).toHaveBeenCalled(); expect(native.paused).toBe(true);
  expect(view!.root.findAllByType("video")).toHaveLength(0); expect(view!.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
  expect(native.cancelVideoFrameCallback).toHaveBeenCalledWith(1);
  expect(observers.every(observer => observer.disconnect.mock.calls.length > 0)).toBe(true);
  expect(handlerCount()).toBe(0); expect(rootElement.inert).toBe(false); expect(body.style.overflow).toBe("scroll");
  expect(draft.save).not.toHaveBeenCalled(); expect(draft.change).not.toHaveBeenCalled();
  focus(true); await act(async () => { await Promise.resolve(); }); const restored = videos.at(-1)!;
  act(() => view!.root.findByType("video").props.onLoadedMetadata());
  expect(restored.paused).toBe(true); expect(restored.play).not.toHaveBeenCalled();
  expect(restored.currentTime).toBe(12.25); expect(restored.playbackRate).toBe(.5);
  expect(view!.root.findByType("video").props.src).toMatch(/^blob:/);
  expect(draft.open).not.toHaveBeenCalled(); expect(draft.save).not.toHaveBeenCalled();
});

test("an uncommitted contact edit and dirty document survive blur/refocus without being saved or discarded", () => {
  draft.dirty = true; mount();
  act(() => action("Scouting").props.onPress());
  act(() => action("Ver contatos anotados no vídeo").props.onPress());
  act(() => action(`Ataque ${videoTime(2, true)}`).props.onPress());
  const before = view!.root.findByType("contact-editor" as never).props.contact;
  act(() => view!.root.findByType("contact-editor" as never).props.onChange({ ...before, athlete: "Edição local" }));
  focus(false); expect(view!.toJSON()).toBeNull(); focus(true);
  expect(view!.root.findByType("contact-editor" as never).props.contact).toMatchObject({ id: "contact-a", athlete: "Edição local" });
  expect(draft.doc).toBe(documentFixture); expect(draft.dirty).toBe(true);
  expect(draft.save).not.toHaveBeenCalled(); expect(draft.change).not.toHaveBeenCalled();
});

test("route blur destroys the iframe player and refocus creates a paused player at the prior position", async () => {
  const youtubeDoc = newVideoDocument({ ...media, youtubeId: "M7lc1UVf-VE", fingerprint: "youtube:M7lc1UVf-VE" }, "youtube-rally");
  draft.doc = youtubeDoc; draft.history.present = youtubeDoc;
  const players: ReturnType<typeof makePlayback>[] = []; const disposals: jest.Mock[] = [];
  jest.mocked(mountYouTube).mockImplementation((_node, _id, callbacks) => {
    const player = makePlayback(), dispose = jest.fn(); players.push(player); disposals.push(dispose);
    callbacks.ready(player); return dispose;
  });
  mount(); const player = players[0]; player.currentTime = 17; setRate();
  await act(async () => action("Reproduzir vídeo").props.onPress()); expect(player.paused).toBe(false);
  focus(false); expect(player.paused).toBe(true); expect(disposals[0]).toHaveBeenCalledTimes(1);
  expect(handlerCount()).toBe(0); focus(true);
  expect(players).toHaveLength(2); expect(players[1].currentTime).toBe(17); expect(players[1].playbackRate).toBe(.5);
  expect(players[1].play).not.toHaveBeenCalled(); expect(draft.save).not.toHaveBeenCalled();
});

test("an asynchronously authorized retained studio does not create a portal or page lock while unfocused", async () => {
  let resolve!: (value: unknown) => void;
  jest.mocked(loadScoutingDetail).mockImplementationOnce(() => new Promise(release => { resolve = release; }) as never);
  act(() => { view = create(createElement(ScoutingVideoStudio, { ...studioProps, active: false }), { createNodeMock: nodeMock }); });
  expect(view!.toJSON()).toBeNull();
  await act(async () => resolve({ session: { ...studioProps.session, id: studioProps.sessionId, classId: studioProps.classId, organizationId: studioProps.org } }));
  expect(view!.toJSON()).toBeNull(); expect(rootElement.inert).toBe(false); expect(handlerCount()).toBe(0);
  act(() => view!.update(createElement(ScoutingVideoStudio, { ...studioProps, active: true })));
  expect(view!.root.findAllByProps({ "aria-label": "Estúdio de scouting" })).toHaveLength(1);
  expect(rootElement.inert).toBe(true); expect(loadScoutingDetail).toHaveBeenCalledTimes(1);
});

test("cancelled navigation keeps the draft and cannot be reused by a later explicit close", () => {
  draft.dirty = true; mount(); const navigate = jest.fn();
  act(() => requestPendingEditsNavigation(navigate)); expect(navigate).not.toHaveBeenCalled();
  expect(view!.root.findAllByProps({ title: "Salvar antes de sair?" }).length).toBeGreaterThan(0);
  act(() => action("Continuar editando").props.onPress());
  expect(navigate).not.toHaveBeenCalled(); expect(draft.save).not.toHaveBeenCalled();
  act(() => action("Voltar ao scouting").props.onPress());
  act(() => action("Sair sem salvar").props.onPress());
  expect(studioProps.onClose).toHaveBeenCalledTimes(1); expect(navigate).not.toHaveBeenCalled();
  expect(draft.save).not.toHaveBeenCalled(); expect(draft.change).not.toHaveBeenCalled();
});

test("a save-and-leave completion cannot navigate after the retained route loses and regains focus", async () => {
  draft.dirty = true; mount(); const navigate = jest.fn(); let resolve!: (saved: boolean) => void;
  draft.save.mockImplementationOnce(() => new Promise(release => { resolve = release; }));
  act(() => requestPendingEditsNavigation(navigate));
  act(() => action("Salvar e sair").props.onPress());
  focus(false); focus(true);
  await act(async () => resolve(true));
  expect(draft.save).toHaveBeenCalledTimes(1); expect(navigate).not.toHaveBeenCalled();
  expect(studioProps.onClose).not.toHaveBeenCalled(); expect(draft.change).not.toHaveBeenCalled();
});

test("embedded authorization renders inline without a portal, page lock or duplicate title", async () => {
  jest.mocked(loadScoutingDetail).mockResolvedValueOnce({session:{...studioProps.session,id:studioProps.sessionId,classId:studioProps.classId,organizationId:studioProps.org}} as never);
  await act(async()=>{view=create(createElement(ScoutingVideoStudio,{...studioProps,embedded:true}),{createNodeMock:nodeMock});});
  expect(createPortal).not.toHaveBeenCalled();expect(rootElement.inert).toBe(false);expect(body.style.overflow).toBe('scroll');
  expect(action('Voltar ao scouting')).toBeUndefined();expect(view!.root.findAllByType('h1')).toHaveLength(0);
  expect(action('Salvar rascunho')).toBeDefined();expect(action('Adicionar vídeo')).toBeDefined();
  expect(view!.root.findByProps({'aria-label':'Estúdio de scouting'}).props.role).toBe('region');
  expect(action('Scouting').props.active).toBe(true);expect(action('Rallies').props.active).toBe(false);
  expect(action('Rallies').children.join('')).toContain('Recortes');
  expect(action('Ver scouting registrado no jogo').children.join('')).toBe('Pontos do jogo');
  expect(action('Ver contatos anotados no vídeo').children.join('')).toBe('Contatos do vídeo');
});

test('standalone and shared players retain the cuts tab as their initial pane',()=>{
  mount();expect(action('Rallies').props.active).toBe(true);expect(action('Scouting').props.active).toBe(false);
  act(()=>view!.unmount());
  act(()=>{view=create(createElement(Studio,{...studioProps,embedded:true,shared:{document:documentFixture,source:'',onMediaError:jest.fn()}}),{createNodeMock:nodeMock});});
  expect(action('Rallies').props.active).toBe(true);expect(action('Scouting').props.active).toBe(false);
  expect(action('Ver scouting registrado no jogo')).toBeUndefined();
});

test('embedded actions use the host toolbar target without relocating the editor or reopening its draft',()=>{
  const target={} as HTMLElement,props={...studioProps,embedded:true,visible:true,toolbarTarget:target};
  act(()=>{view=create(createElement(Studio,props),{createNodeMock:nodeMock});});
  expect(createPortal).toHaveBeenCalled();expect(jest.mocked(createPortal).mock.calls.every(call=>call[1]===target)).toBe(true);
  const [toolbar,owner]=jest.mocked(createPortal).mock.calls[0];expect(owner).toBe(target);
  expect((toolbar as any).type).toBe('header');expect((toolbar as any).props.className).toContain('sv-embedded-toolbar');
  expect(action('Salvar rascunho')).toBeDefined();expect(action('Compartilhar análise')).toBeDefined();expect(action('Adicionar vídeo')).toBeDefined();
  expect(view!.root.findByProps({'aria-label':'Estúdio de scouting'}).props.role).toBe('region');
  act(()=>view!.update(createElement(Studio,{...props,visible:false})));
  expect(jest.mocked(createPortal).mock.calls.at(-1)![1]).toBe(target);
  expect(draft.open).not.toHaveBeenCalled();expect(draft.save).not.toHaveBeenCalled();
  expect(useVideoDraft).toHaveBeenLastCalledWith('org-a','user-a','session-a',undefined,true,true);
});

test('watching a reviewed point clears an earlier clip and starts at the absolute linked timestamp',async()=>{
  const youtubeDoc=newVideoDocument({...media,duration:180,youtubeId:'M7lc1UVf-VE',fingerprint:'youtube:M7lc1UVf-VE'},'clip-1');
  youtubeDoc.rallies=[{...youtubeDoc.rallies[0],id:'clip-1',start:0},{...youtubeDoc.rallies[0],id:'clip-2',start:30},{...youtubeDoc.rallies[0],id:'clip-3',start:60}];
  draft.doc=youtubeDoc;draft.history.present=youtubeDoc;const before=JSON.stringify(youtubeDoc),player=makePlayback();
  jest.mocked(mountYouTube).mockImplementation((_node,_id,callbacks)=>{callbacks.ready(player);return jest.fn();});
  act(()=>{view=create(createElement(Studio,{...studioProps,embedded:true}),{createNodeMock:nodeMock});});
  act(()=>view!.root.findByType('video-timeline' as never).props.onFocus('clip-1'));
  expect(view!.root.findByType('review-scouting' as never).props.focus).toBe('clip-1');
  await act(async()=>{view!.root.findByType('review-scouting' as never).props.onPlay(62.64);await Promise.resolve();});
  expect(player.currentTime).toBe(62.64);expect(player.play).toHaveBeenCalledTimes(1);expect(player.paused).toBe(false);
  expect(view!.root.findByType('review-scouting' as never).props.focus).toBeNull();
  expect(draft.change).not.toHaveBeenCalled();expect(draft.save).not.toHaveBeenCalled();expect(JSON.stringify(youtubeDoc)).toBe(before);
});

test('plain review navigation seeks absolutely without autoplay and queues a watch requested before player readiness',async()=>{
  const youtubeDoc=newVideoDocument({...media,duration:180,youtubeId:'M7lc1UVf-VE',fingerprint:'youtube:M7lc1UVf-VE'},'clip-1');
  draft.doc=youtubeDoc;draft.history.present=youtubeDoc;
  let ready!:(player:ReturnType<typeof makePlayback>)=>void;
  jest.mocked(mountYouTube).mockImplementation((_node,_id,callbacks)=>{ready=callbacks.ready;return jest.fn();});
  act(()=>{view=create(createElement(Studio,{...studioProps,embedded:true}),{createNodeMock:nodeMock});});
  act(()=>view!.root.findByType('review-scouting' as never).props.onPlay(62.64));
  const player=makePlayback();await act(async()=>{ready(player);await Promise.resolve();});
  expect(player.currentTime).toBe(62.64);expect(player.play).toHaveBeenCalledTimes(1);
  act(()=>view!.root.findByType('review-scouting' as never).props.onSeek(75.5));
  expect(player.currentTime).toBe(75.5);expect(player.paused).toBe(true);expect(player.play).toHaveBeenCalledTimes(1);
  expect(draft.open).not.toHaveBeenCalled();expect(draft.change).not.toHaveBeenCalled();
});

test('a reviewed point outside the attached original switches to YouTube without losing its requested timestamp',async()=>{
  const youtubeDoc=newVideoDocument({...media,duration:180,youtubeId:'M7lc1UVf-VE',fingerprint:'youtube:M7lc1UVf-VE'},'clip-1');
  youtubeDoc.analysis={model:'vballnet-v2b-browser-1',sampledFps:30,positions:[],cuts:[],source:{...media,offsetSeconds:10}};
  draft.doc=youtubeDoc;draft.history.present=youtubeDoc;const before=JSON.stringify(youtubeDoc),players:ReturnType<typeof makePlayback>[]=[];
  jest.mocked(mountYouTube).mockImplementation((_node,_id,callbacks)=>{const player=makePlayback();players.push(player);callbacks.ready(player);return jest.fn();});
  act(()=>{view=create(createElement(Studio,{...studioProps,embedded:true}),{createNodeMock:nodeMock});});
  await attach();act(()=>view!.root.findByType('video').props.onLoadedMetadata());
  videos.at(-1)!.currentTime=15.5;
  await act(async()=>{view!.root.findByType('review-scouting' as never).props.onPlay(5.3);await Promise.resolve();});
  expect(view!.root.findAllByType('video')).toHaveLength(0);expect(players).toHaveLength(2);
  expect(players.at(-1)!.currentTime).toBe(5.3);expect(players.at(-1)!.play).toHaveBeenCalledTimes(1);
  expect(draft.open).not.toHaveBeenCalled();expect(draft.change).not.toHaveBeenCalled();expect(draft.save).not.toHaveBeenCalled();
  expect(JSON.stringify(youtubeDoc)).toBe(before);
});

test("hiding an embedded pane pauses playback without dropping the source or unsaved contact", async () => {
  const props={...studioProps,embedded:true,visible:true};draft.dirty=true;
  act(()=>{view=create(createElement(Studio,props),{createNodeMock:nodeMock});});await attach();
  const native=videos.at(-1)!;
  act(()=>action('Scouting').props.onPress());act(()=>action('Ver contatos anotados no vídeo').props.onPress());
  act(()=>action(`Ataque ${videoTime(2,true)}`).props.onPress());
  const before=view!.root.findByType('contact-editor' as never).props.contact;
  act(()=>view!.root.findByType('contact-editor' as never).props.onChange({...before,athlete:'Edição retida'}));
  draft.save.mockClear();draft.change.mockClear();
  native.paused=false;native.currentTime=12.25;
  act(()=>view!.update(createElement(Studio,{...props,visible:false})));
  expect(native.pause).toHaveBeenCalled();expect(view!.root.findAllByType('video')).toHaveLength(1);
  expect(videos).toHaveLength(1);expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  expect(handlers.get('keydown')?.size??0).toBe(0);
  expect(useVideoDraft).toHaveBeenLastCalledWith('org-a','user-a','session-a',undefined,true,true);
  act(()=>view!.update(createElement(Studio,props)));
  expect(view!.root.findByType('contact-editor' as never).props.contact.athlete).toBe('Edição retida');
  expect(draft.save).not.toHaveBeenCalled();expect(draft.change).not.toHaveBeenCalled();
});

test("an embedded analysis job remains mounted across pane visibility changes",()=>{
  const youtubeDoc=newVideoDocument({...media,youtubeId:'M7lc1UVf-VE',fingerprint:'youtube:M7lc1UVf-VE'},'youtube-rally');
  draft.doc=youtubeDoc;draft.history.present=youtubeDoc;
  jest.mocked(mountYouTube).mockImplementation((_node,_id,callbacks)=>{callbacks.ready(makePlayback());return jest.fn();});
  const props={...studioProps,embedded:true,visible:true};
  act(()=>{view=create(createElement(Studio,props),{createNodeMock:nodeMock});});
  act(()=>action('Informações').props.onPress());expect(mockAnalysisMounts).toBe(1);
  act(()=>view!.update(createElement(Studio,{...props,visible:false})));
  act(()=>view!.update(createElement(Studio,props)));
  expect(mockAnalysisMounts).toBe(1);expect(mockAnalysisDisposals).toBe(0);
});

test("embedded leave uses a stable registered guard and advances only its approved continuation",()=>{
  draft.dirty=true;let guard:((next:()=>void)=>void)|null=null;
  const setter=jest.fn((value:typeof guard)=>{guard=value;});
  const props={...studioProps,embedded:true,visible:true,onLeaveGuard:setter};
  act(()=>{view=create(createElement(Studio,props),{createNodeMock:nodeMock});});
  const registered=guard,unrelated=jest.fn();act(()=>requestPendingEditsNavigation(unrelated));expect(unrelated).toHaveBeenCalledTimes(1);
  act(()=>view!.update(createElement(Studio,{...props,visible:false})));expect(guard).toBe(registered);expect(setter).toHaveBeenCalledTimes(1);
  act(()=>view!.update(createElement(Studio,props)));
  const cancelled=jest.fn();act(()=>guard!(cancelled));act(()=>action('Continuar editando').props.onPress());expect(cancelled).not.toHaveBeenCalled();
  const proceed=jest.fn();act(()=>guard!(proceed));expect(proceed).not.toHaveBeenCalled();
  act(()=>action('Sair sem salvar').props.onPress());expect(proceed).toHaveBeenCalledTimes(1);expect(studioProps.onClose).not.toHaveBeenCalled();
  act(()=>view!.unmount());view=undefined;expect(setter).toHaveBeenLastCalledWith(null);
});
