import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useScoutingCollection } from "../use-scouting-collection";
import type { ScoutingDetail } from "../../../db/scouting-collection";
import type { ScoutingRallyOutcome } from '../../../core/models';
import type { LiveCaptureStamp } from '../../../core/scouting-live';
import type { CaptureTimingDraft, ScoutingCaptureBridge } from '../live/live-scouting-contract';

const mockStored = new Map<string, string>();
const mockGet = jest.fn(async (key: string) => mockStored.get(key) ?? null);
const mockSet = jest.fn(async (key: string, value: string) => { mockStored.set(key, value); });
const mockLoad = jest.fn();
const mockApply = jest.fn();
const mockIdentity = jest.fn();
jest.mock("../../../auth/session", () => ({ getSessionIdentity: () => ({ userId: "user", generation: 1 }), assertSessionIdentity: () => mockIdentity() }));
jest.mock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: {
  getItem: (...args: [string]) => mockGet(...args), setItem: (...args: [string, string]) => mockSet(...args),
} }));
jest.mock("../../../db/scouting-collection", () => ({ loadScoutingDetail: (...args: unknown[]) => mockLoad(...args), applyScoutingCommand: (...args: unknown[]) => mockApply(...args) }));
const contact = { fundamental: "recepcao" as const, resultKey: "b_medio", phase: "side_out" as const };
const base: ScoutingDetail = { captureReady: true, actions: [], rallies: [], session: {
  id: "game", organizationId: "org", classId: "class", type: "jogo", status: "em_andamento", date: "2026-10-06", title: "Jogo", createdAt: "", updatedAt: "", revision: 1,
  matchState: { setNumber: 1, scoreUs: 12, scoreThem: 10, serve: "them", rotation: 1, recoveredDraft: [] },
} };
const saved: ScoutingDetail = { ...base, session: { ...base.session, revision: 2, matchState: { ...base.session.matchState!, scoreUs: 13 } } };
beforeEach(() => { jest.clearAllMocks(); mockStored.clear(); mockSet.mockImplementation(async (key, value) => { mockStored.set(key, value); }); mockLoad.mockResolvedValue(base); mockApply.mockResolvedValue(saved); });

test("failed send retains contacts and retries the exact same persisted request", async () => {
  mockApply.mockRejectedValueOnce(new Error("timeout"));
  const { result } = renderHook(() => useScoutingCollection("org", "game", "user", jest.fn()));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.changeContacts([contact]));
  await act(async () => { await result.current.execute({ name: "point", payload: { winner: "us", contacts: [contact] } }); });
  expect(result.current.contacts).toEqual([contact]);
  expect(result.current.pending).not.toBeNull();
  const pending = mockApply.mock.calls[0][2];
  expect(JSON.parse(mockStored.get("goatleta:scouting-draft:v1:user:org:game")!).pending).toEqual(pending);
  await act(async () => { await result.current.execute(); });
  expect(mockApply.mock.calls[1][2]).toEqual(pending);
  expect(result.current.contacts).toEqual([]);
  expect(result.current.detail?.session.matchState?.scoreUs).toBe(13);
});

test("refuses double taps while a request is in flight", async () => {
  let resolve!: (detail: ScoutingDetail) => void;
  mockApply.mockImplementation(() => new Promise<ScoutingDetail>(r => { resolve = r; }));
  const { result } = renderHook(() => useScoutingCollection("org", "game", "user", jest.fn()));
  await waitFor(() => expect(result.current.loading).toBe(false));
  let request!: Promise<boolean>;
  act(() => { request = result.current.execute({ name: "point", payload: { winner: "us", contacts: [] } }); });
  await waitFor(() => expect(mockApply).toHaveBeenCalledTimes(1));
  await act(async () => { expect(await result.current.execute({ name: "point", payload: { winner: "us", contacts: [] } })).toBe(false); resolve(saved); await request; });
  expect(mockApply).toHaveBeenCalledTimes(1);
});

test("reopened contacts survive mounting on another device", async () => {
  mockLoad.mockResolvedValue({ ...base, session: { ...base.session, matchState: { ...base.session.matchState, recoveredDraft: [contact] } } });
  const { result } = renderHook(() => useScoutingCollection("org", "game", "another-user", jest.fn()));
  await waitFor(() => expect(result.current.contacts).toEqual([contact]));
  expect(mockGet).toHaveBeenCalledWith("goatleta:scouting-draft:v1:another-user:org:game");
});

test("revision conflict preserves the draft and requires explicit reconciliation", async () => {
  mockApply.mockRejectedValueOnce(new Error("Supabase 40001"));
  const { result } = renderHook(() => useScoutingCollection("org", "game", "user", jest.fn()));
  await waitFor(() => expect(result.current.loading).toBe(false));
  mockLoad.mockResolvedValue(saved);
  act(() => result.current.changeContacts([contact]));
  await act(async () => { await result.current.execute({ name: "point", payload: { winner: "us", contacts: [contact] } }); });
  expect(result.current.conflict).toBe(true);
  expect(result.current.contacts).toEqual([contact]);
  await act(async () => { await result.current.execute({ name: "point", payload: { winner: "us", contacts: [contact] } }); });
  expect(mockApply).toHaveBeenCalledTimes(1);
  await act(async () => { await result.current.reconcile(true); });
  expect(result.current.conflict).toBe(false);
  expect(result.current.contacts).toEqual([contact]);
});

test("does not send when it cannot persist the retry receipt", async () => {
  const { result } = renderHook(() => useScoutingCollection("org", "game", "user", jest.fn()));
  await waitFor(() => expect(result.current.loading).toBe(false));
  mockSet.mockRejectedValueOnce(new Error("storage full"));
  await act(async () => { await result.current.execute({ name: "point", payload: { winner: "us", contacts: [] } }); });
  expect(mockApply).not.toHaveBeenCalled();
  expect(result.current.pending).not.toBeNull();
});

test("keeps the pending receipt if storage fails after server success", async () => {
  const { result } = renderHook(() => useScoutingCollection("org", "game", "user", jest.fn()));
  await waitFor(() => expect(result.current.loading).toBe(false));
  mockSet.mockImplementationOnce(async (key, value) => { mockStored.set(key, value); }).mockRejectedValueOnce(new Error("storage full"));
  await act(async () => { await result.current.execute({ name: "point", payload: { winner: "us", contacts: [] } }); });
  const request = result.current.pending;
  expect(request).not.toBeNull();
  await act(async () => { await result.current.execute(); });
  expect(mockApply.mock.calls[1][2]).toEqual(request);
});

test("does not dispatch an old draft after account identity changes", async () => {
  const { result } = renderHook(() => useScoutingCollection("org", "game", "user", jest.fn()));
  await waitFor(() => expect(result.current.loading).toBe(false));
  mockIdentity.mockImplementationOnce(() => { throw new Error("SessionIdentityChanged"); });
  await act(async () => { await result.current.execute({ name: "point", payload: { winner: "us", contacts: [] } }); });
  expect(mockApply).not.toHaveBeenCalled();
});

const draftKey='goatleta:scouting-draft:v1:user:org:game';
const extended:ScoutingDetail={...base,captureVersion:3};
const opponentPoint:ScoutingDetail={...extended,session:{...base.session,revision:2,matchState:{...base.session.matchState!,scoreThem:11,recoveredOutcome:null}}};

test('an opponent ace persists and submits one point with no fabricated receiver',async()=>{
  mockLoad.mockResolvedValue(extended);mockApply.mockResolvedValue(opponentPoint);const onSaved=jest.fn();
  const {result}=renderHook(()=>useScoutingCollection('org','game','user',onSaved));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  const outcome:ScoutingRallyOutcome={kind:'ace',team:'them'};act(()=>result.current.changeOutcome(outcome));
  await waitFor(()=>expect(JSON.parse(mockStored.get(draftKey)!).outcome).toEqual(outcome));
  expect(mockApply).not.toHaveBeenCalled();
  await act(async()=>{await result.current.execute({name:'point',payload:{winner:'them',contacts:[],outcome}});});
  expect(mockApply).toHaveBeenCalledTimes(1);expect(mockApply.mock.calls[0]).toEqual(['org','game',expect.objectContaining({command:{name:'point',payload:{winner:'them',contacts:[],outcome}}}),3]);
  expect(result.current.contacts).toEqual([]);expect(result.current.outcome).toBeNull();
  expect(result.current.detail?.session.matchState).toMatchObject({scoreUs:12,scoreThem:11});expect(onSaved).toHaveBeenCalledTimes(1);
});

test('an outcome-only draft survives reload and a reopened point can be redone with its exact outcome',async()=>{
  mockLoad.mockResolvedValue(extended);const outcome:ScoutingRallyOutcome={kind:'falta',team:'us',reason:'rede'};
  const first=renderHook(()=>useScoutingCollection('org','game','user',jest.fn()));
  await waitFor(()=>expect(first.result.current.loading).toBe(false));act(()=>first.result.current.changeOutcome(outcome));
  await waitFor(()=>expect(JSON.parse(mockStored.get(draftKey)!).outcome).toEqual(outcome));first.unmount();
  const second=renderHook(()=>useScoutingCollection('org','game','user',jest.fn()));
  await waitFor(()=>expect(second.result.current.outcome).toEqual(outcome));expect(second.result.current.contacts).toEqual([]);
  act(()=>second.result.current.changeOutcome(null));await waitFor(()=>expect(second.result.current.outcome).toBeNull());
  const reopened:ScoutingDetail={...extended,session:{...base.session,revision:2,matchState:{...base.session.matchState!,recoveredOutcome:outcome,recoveredDraft:[contact]}}};
  mockApply.mockResolvedValueOnce(reopened).mockResolvedValueOnce(opponentPoint);
  await act(async()=>{await second.result.current.execute({name:'reopen_point',payload:{rallyId:'fault-point'}});});
  expect(second.result.current.outcome).toEqual(outcome);expect(second.result.current.contacts).toEqual([contact]);
  await act(async()=>{await second.result.current.execute({name:'point',payload:{contacts:[contact],winner:'them',outcome}});});
  expect(mockApply.mock.calls.at(-1)[2].command.payload).toEqual({contacts:[contact],winner:'them',outcome});
  expect(second.result.current.outcome).toBeNull();expect(second.result.current.contacts).toEqual([]);
});

test('a persisted additive retry stays intact while a backend without capability 3 refuses transport',async()=>{
  const outcome:ScoutingRallyOutcome={kind:'ace',team:'them'},pending={revision:1,requestId:'persisted-outcome',command:{name:'point',payload:{contacts:[],winner:'them',outcome}}};
  mockStored.set(draftKey,JSON.stringify({version:2,revision:1,contacts:[],outcome,pending}));
  mockLoad.mockResolvedValue({...base,captureVersion:2});mockApply.mockRejectedValue(new Error('SCOUTING_CAPTURE_UPDATE_REQUIRED'));
  const {result}=renderHook(()=>useScoutingCollection('org','game','user',jest.fn()));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  await act(async()=>{expect(await result.current.execute()).toBe(false);});
  expect(mockApply).not.toHaveBeenCalled();expect(mockSet).not.toHaveBeenCalled();expect(result.current.pending).toEqual(pending);
  expect(result.current.outcome).toEqual(outcome);expect(result.current.error).toContain('nenhum ponto foi enviado');
  expect(JSON.parse(mockStored.get(draftKey)!).pending).toEqual(pending);
});

test('version 1 drafts load without inventing outcome or rewriting their stored bytes',async()=>{
  const raw=JSON.stringify({version:1,revision:1,contacts:[contact],pending:null});mockStored.set(draftKey,raw);
  const {result}=renderHook(()=>useScoutingCollection('org','game','user',jest.fn()));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.contacts).toEqual([contact]);expect(result.current.outcome).toBeNull();expect(mockStored.get(draftKey)).toBe(raw);
  expect(mockSet).not.toHaveBeenCalled();expect(mockApply).not.toHaveBeenCalled();
});

test.each([
  {kind:'ace',team:'them',studentId:'invented'},
  {kind:'falta',team:'us',reason:'unknown'},
])('invalid version 2 metadata %# stays preserved and cannot be overwritten',async outcome=>{
  const raw=JSON.stringify({version:2,revision:1,contacts:[],outcome,pending:null});mockStored.set(draftKey,raw);
  const {result}=renderHook(()=>useScoutingCollection('org','game','user',jest.fn()));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.readBlocked).toBe(true);expect(result.current.error).toContain('preservado');
  await act(async()=>{result.current.changeContacts([contact]);result.current.changeOutcome(null);await result.current.execute({name:'point',payload:{winner:'us',contacts:[]}});await result.current.reconcile(false);});
  expect(mockSet).not.toHaveBeenCalled();expect(mockApply).not.toHaveBeenCalled();expect(mockStored.get(draftKey)).toBe(raw);
});

test('a corrupt reload blocks writes even when a valid session was loaded earlier',async()=>{
  mockLoad.mockResolvedValue(extended);const {result}=renderHook(()=>useScoutingCollection('org','game','user',jest.fn()));
  await waitFor(()=>expect(result.current.loading).toBe(false));expect(result.current.detail?.session.id).toBe('game');
  const raw=JSON.stringify({version:2,revision:1,contacts:[],outcome:{kind:'ace',team:'them',extra:true},pending:null});mockStored.set(draftKey,raw);
  await act(async()=>{await result.current.reload();});expect(result.current.readBlocked).toBe(true);
  await act(async()=>{result.current.changeContacts([contact]);result.current.changeOutcome(null);await result.current.execute({name:'point',payload:{winner:'us',contacts:[]}});await result.current.reconcile(false);});
  expect(mockSet).not.toHaveBeenCalled();expect(mockApply).not.toHaveBeenCalled();expect(mockStored.get(draftKey)).toBe(raw);
});

test('clearing a recovered ending to explicit null survives reload without restoring the server ending',async()=>{
  const outcome:ScoutingRallyOutcome={kind:'ace',team:'them'};
  mockLoad.mockResolvedValue({...extended,session:{...base.session,matchState:{...base.session.matchState!,recoveredOutcome:outcome}}});
  const first=renderHook(()=>useScoutingCollection('org','game','user',jest.fn()));await waitFor(()=>expect(first.result.current.outcome).toEqual(outcome));
  act(()=>first.result.current.changeOutcome(null));await waitFor(()=>expect(JSON.parse(mockStored.get(draftKey)!).outcome).toBeNull());first.unmount();
  const second=renderHook(()=>useScoutingCollection('org','game','user',jest.fn()));await waitFor(()=>expect(second.result.current.loading).toBe(false));
  expect(second.result.current.outcome).toBeNull();expect(second.result.current.contacts).toEqual([]);
  expect(JSON.parse(mockStored.get(draftKey)!)).toMatchObject({version:2,revision:1,contacts:[],outcome:null});
  expect(mockApply).not.toHaveBeenCalled();
});

test('legacy draft inherits a reopened ending only at the same revision without rewriting its pending payload',async()=>{
  const outcome:ScoutingRallyOutcome={kind:'falta',team:'us',reason:'rede'};
  mockLoad.mockResolvedValue({...extended,session:{...base.session,matchState:{...base.session.matchState!,recoveredOutcome:outcome}}});
  const pending={revision:1,requestId:'legacy-pending',command:{name:'point',payload:{contacts:[contact],winner:'them'}}};
  const raw=JSON.stringify({version:1,revision:1,contacts:[contact],pending});mockStored.set(draftKey,raw);
  const same=renderHook(()=>useScoutingCollection('org','game','user',jest.fn()));await waitFor(()=>expect(same.result.current.loading).toBe(false));
  expect(same.result.current.outcome).toEqual(outcome);expect(same.result.current.pending).toEqual(pending);
  expect(same.result.current.pending!.command.payload).not.toHaveProperty('outcome');expect(mockStored.get(draftKey)).toBe(raw);same.unmount();
  mockStored.set(draftKey,JSON.stringify({version:1,revision:0,contacts:[contact],pending:null}));
  const stale=renderHook(()=>useScoutingCollection('org','game','user',jest.fn()));await waitFor(()=>expect(stale.result.current.loading).toBe(false));
  expect(stale.result.current.outcome).toBeNull();expect(stale.result.current.conflict).toBe(true);
  await act(async()=>{await stale.result.current.reconcile(true);});
  expect(stale.result.current.outcome).toEqual(outcome);expect(stale.result.current.conflict).toBe(false);expect(mockApply).not.toHaveBeenCalled();
});

test('well-formed contradictory metadata stays editable while malformed metadata remains blocked',async()=>{
  const attack={fundamental:'ataque',resultKey:'ponto',phase:'side_out'};
  mockLoad.mockResolvedValue(extended);mockStored.set(draftKey,JSON.stringify({version:2,revision:1,contacts:[attack],outcome:{kind:'ace',team:'them'},pending:null}));
  const {result}=renderHook(()=>useScoutingCollection('org','game','user',jest.fn()));await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.readBlocked).toBe(false);expect(result.current.error).toContain('Corrija');
  act(()=>result.current.changeOutcome(null));await waitFor(()=>expect(result.current.outcome).toBeNull());
  expect(result.current.contacts).toEqual([attack]);expect(mockApply).not.toHaveBeenCalled();
});

test('reload blocks immediate writes and an older completed read cannot replace a newer session snapshot',async()=>{
  mockLoad.mockResolvedValue(extended);const {result}=renderHook(()=>useScoutingCollection('org','game','user',jest.fn()));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  let oldRead!:(detail:ScoutingDetail)=>void,newRead!:(detail:ScoutingDetail)=>void;
  mockLoad.mockImplementationOnce(()=>new Promise(resolve=>{oldRead=resolve;})).mockImplementationOnce(()=>new Promise(resolve=>{newRead=resolve;}));
  let oldTask!:Promise<void>,newTask!:Promise<void>;
  act(()=>{oldTask=result.current.reload();result.current.changeContacts([contact]);});
  expect(result.current.readBlocked).toBe(true);expect(mockSet).not.toHaveBeenCalled();
  act(()=>{newTask=result.current.reload();});
  await act(async()=>{newRead(opponentPoint);await newTask;});expect(result.current.detail?.session.revision).toBe(2);
  await act(async()=>{oldRead(extended);await oldTask;});expect(result.current.detail?.session.revision).toBe(2);expect(result.current.readBlocked).toBe(false);
  expect(mockApply).not.toHaveBeenCalled();expect(mockSet).not.toHaveBeenCalled();
});

const reference = { hostSessionId: 'host-session', recordingId: 'camera-recording' };
const videoStamp = (timeMs: number): LiveCaptureStamp => ({ ...reference, scope: { userId: 'user', org: 'org', classId: 'class' }, segmentId: 'segment-1', epoch: 2, peerGeneration: 3, timeMs, uncertaintyMs: 501, mode: 'estimated' });
const videoBridge = (clock: () => LiveCaptureStamp | null): ScoutingCaptureBridge => ({ captureStamp: jest.fn(clock), captureReference: jest.fn(() => reference), applied: jest.fn(async () => undefined) });

test('contact gesture times and IDs survive editing and removal while point confirmation uses its own frozen instant', async () => {
  let now = 1000.125, finish!: (value: ScoutingDetail) => void;
  const bridge = videoBridge(() => videoStamp(now)); mockApply.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useScoutingCollection('org', 'game', 'user', jest.fn(), bridge));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.changeContacts([contact], { kind: 'append', index: 0 }));
  await waitFor(() => expect(JSON.parse(mockStored.get(draftKey)!).timing.contacts).toHaveLength(1));
  const first = JSON.parse(mockStored.get(draftKey)!).timing.contacts[0];
  now = 2200; const edited = { ...contact, resultKey: 'a_alto' };
  act(() => result.current.changeContacts([edited], { kind: 'replace', index: 0 }));
  await waitFor(() => expect(JSON.parse(mockStored.get(draftKey)!).contacts[0].resultKey).toBe('a_alto'));
  expect(JSON.parse(mockStored.get(draftKey)!).timing.contacts[0]).toEqual(first);
  now = 3000.75; const set = { fundamental: 'levantamento' as const, resultKey: 'organizou', phase: 'side_out' as const };
  act(() => result.current.changeContacts([edited, set], { kind: 'append', index: 1 }));
  await waitFor(() => expect(JSON.parse(mockStored.get(draftKey)!).timing.contacts).toHaveLength(2));
  const second = JSON.parse(mockStored.get(draftKey)!).timing.contacts[1];
  act(() => result.current.changeContacts([set], { kind: 'remove', index: 0 }));
  now = 9000.5; let task!: Promise<boolean>;
  act(() => { task = result.current.execute({ name: 'point', payload: { contacts: [set], winner: 'us' } }); });
  await waitFor(() => expect(mockApply).toHaveBeenCalledTimes(1));
  expect(bridge.applied).not.toHaveBeenCalled(); now = 17000;
  await act(async () => { finish(saved); await task; });
  const event = jest.mocked(bridge.applied).mock.calls[0][0];
  expect(event.timing).toEqual({ contacts: [second], pointStamp: videoStamp(9000.5), reference });
  expect(second.stamp).toEqual(videoStamp(3000.75)); expect(bridge.captureStamp).toHaveBeenCalledTimes(3);
  expect(mockApply.mock.calls[0][2].command).toEqual({ name: 'point', payload: { contacts: [set], winner: 'us' } });
  expect(event.before.actions).toEqual([]); expect(event.before.rallies).toEqual([]);
});

test('an unknown RPC outcome retains the same contact timing and pending ID through reload and retry', async () => {
  let now = 100; const bridge = videoBridge(() => videoStamp(now)); mockApply.mockRejectedValueOnce(new Error('timeout'));
  const first = renderHook(() => useScoutingCollection('org', 'game', 'user', jest.fn(), bridge));
  await waitFor(() => expect(first.result.current.loading).toBe(false));
  act(() => first.result.current.changeContacts([contact], { kind: 'append', index: 0 })); now = 250;
  await act(async () => { await first.result.current.execute({ name: 'point', payload: { contacts: [contact], winner: 'us' } }); });
  const request = cloneValue(first.result.current.pending), receipt = JSON.parse(mockStored.get(draftKey)!).pendingCapture;
  expect(bridge.applied).not.toHaveBeenCalled(); first.unmount(); now = 50000;
  const second = renderHook(() => useScoutingCollection('org', 'game', 'user', jest.fn(), bridge));
  await waitFor(() => expect(second.result.current.loading).toBe(false));
  await act(async () => { expect(await second.result.current.execute()).toBe(true); });
  expect(mockApply.mock.calls[1][2]).toEqual(request); expect(jest.mocked(bridge.applied).mock.calls[0][0].timing).toEqual(receipt.timing);
  expect(bridge.captureStamp).toHaveBeenCalledTimes(2);
});

test('a confirmed RPC with failed projection survives reload and retries only local video synchronization', async () => {
  const bridge = videoBridge(() => videoStamp(1200)); jest.mocked(bridge.applied).mockRejectedValueOnce(new Error('Local video storage unavailable'));
  const first = renderHook(() => useScoutingCollection('org', 'game', 'user', jest.fn(), bridge));
  await waitFor(() => expect(first.result.current.loading).toBe(false));
  await act(async () => { expect(await first.result.current.execute({ name: 'point', payload: { contacts: [], winner: 'us' } })).toBe(false); });
  expect(first.result.current.detail?.session.matchState?.scoreUs).toBe(13); expect(first.result.current.pending).not.toBeNull();
  expect(first.result.current.error).toBe('Registro confirmado. Tente novamente para sincronizar o vídeo.');
  const original = cloneValue(jest.mocked(bridge.applied).mock.calls[0][0]); first.unmount();
  const second = renderHook(() => useScoutingCollection('org', 'game', 'user', jest.fn(), bridge));
  await waitFor(() => expect(second.result.current.loading).toBe(false));
  expect(second.result.current.error).toContain('Registro confirmado');
  await act(async () => { expect(await second.result.current.execute()).toBe(true); });
  expect(mockApply).toHaveBeenCalledTimes(1); expect(jest.mocked(bridge.applied).mock.calls[1][0]).toEqual(original); expect(second.result.current.pending).toBeNull();
});

test('a failed final local receipt keeps the projected command retryable without another official mutation', async () => {
  let failClear = true; const bridge = videoBridge(() => videoStamp(1500));
  mockSet.mockImplementation(async (key, value) => { if (failClear && JSON.parse(value).pending === null) { failClear = false; throw new Error('Storage full'); } mockStored.set(key, value); });
  const { result } = renderHook(() => useScoutingCollection('org', 'game', 'user', jest.fn(), bridge));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { expect(await result.current.execute({ name: 'point', payload: { contacts: [], winner: 'them' } })).toBe(false); });
  expect(result.current.pending).not.toBeNull(); const event = cloneValue(jest.mocked(bridge.applied).mock.calls[0][0]);
  await act(async () => { expect(await result.current.execute()).toBe(true); });
  expect(mockApply).toHaveBeenCalledTimes(1); expect(jest.mocked(bridge.applied).mock.calls[1][0]).toEqual(event);
});

test('reopening and redoing a point reuse archived contact IDs and times instead of sampling the current recording', async () => {
  const timing: CaptureTimingDraft = { contacts: [{ id: 'original-contact', stamp: videoStamp(1300.25) }], pointStamp: videoStamp(1900.5), reference };
  const bridge = videoBridge(() => videoStamp(90000)); jest.mocked(bridge.applied).mockImplementation(async event => event.pending.command.name === 'reopen_point' ? { recoveredTiming: timing } : undefined);
  const reopened = { ...base, session: { ...base.session, revision: 2, matchState: { ...base.session.matchState!, recoveredDraft: [contact] } } };
  mockApply.mockResolvedValueOnce(reopened).mockResolvedValueOnce(saved);
  const { result } = renderHook(() => useScoutingCollection('org', 'game', 'user', jest.fn(), bridge));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { expect(await result.current.execute({ name: 'reopen_point', payload: { rallyId: 'sr_original' } })).toBe(true); });
  expect(result.current.contacts).toEqual([contact]);
  await act(async () => { expect(await result.current.execute({ name: 'point', payload: { contacts: [contact], winner: 'us' } })).toBe(true); });
  expect(jest.mocked(bridge.applied).mock.calls[1][0].timing).toEqual(timing); expect(bridge.captureStamp).not.toHaveBeenCalled();
  expect(mockApply.mock.calls[0][2].requestId).not.toBe(mockApply.mock.calls[1][2].requestId);
});

test('unsynchronized contacts retain a frozen recording reference and never invent a timestamp for legacy retries', async () => {
  const bridge = videoBridge(() => null);
  const first = renderHook(() => useScoutingCollection('org', 'game', 'user', jest.fn(), bridge));
  await waitFor(() => expect(first.result.current.loading).toBe(false)); act(() => first.result.current.changeContacts([contact], { kind: 'append', index: 0 }));
  await act(async () => { await first.result.current.execute({ name: 'point', payload: { contacts: [contact], winner: 'us' } }); });
  expect(jest.mocked(bridge.applied).mock.calls[0][0].timing).toMatchObject({ reference, pointStamp: null, contacts: [{ stamp: null }] }); first.unmount();
  const pending = { requestId: 'legacy-untimed', revision: 1, command: { name: 'point', payload: { contacts: [contact], winner: 'us' } } };
  mockStored.set(draftKey, JSON.stringify({ version: 2, revision: 1, contacts: [contact], pending })); jest.clearAllMocks();
  const second = renderHook(() => useScoutingCollection('org', 'game', 'user', jest.fn(), bridge));
  await waitFor(() => expect(second.result.current.loading).toBe(false));
  await act(async () => { await second.result.current.execute(); });
  expect(bridge.captureStamp).not.toHaveBeenCalled(); expect(bridge.captureReference).not.toHaveBeenCalled();
  expect(jest.mocked(bridge.applied).mock.calls[0][0].timing).toEqual({ contacts: [{ id: 'cc_legacy-untimed_0', stamp: null }], pointStamp: null });
});

test('training samples the result gesture once and sends no video metadata to the official command', async () => {
  mockLoad.mockResolvedValue({ ...base, session: { ...base.session, type: 'treino', matchState: null } });
  const bridge = videoBridge(() => videoStamp(1700.75));
  const { result } = renderHook(() => useScoutingCollection('org', 'game', 'user', jest.fn(), bridge));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await result.current.execute({ name: 'action', payload: { contacts: [contact] } }); });
  expect(jest.mocked(bridge.applied).mock.calls[0][0].timing).toMatchObject({ reference, contacts: [{ stamp: videoStamp(1700.75) }], pointStamp: null });
  expect(bridge.captureStamp).toHaveBeenCalledTimes(1); expect(mockApply.mock.calls[0][2].command).toEqual({ name: 'action', payload: { contacts: [contact] } });
});

test('an official response arriving after a scope switch cannot project or replace the new collector state', async () => {
  let finish!: (value: ScoutingDetail) => void; mockApply.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const bridge = videoBridge(() => videoStamp(1000));
  const { result, rerender } = renderHook(({ org, sessionId, userId }) => useScoutingCollection(org, sessionId, userId, jest.fn(), bridge), { initialProps: { org: 'org', sessionId: 'game', userId: 'user' } });
  await waitFor(() => expect(result.current.loading).toBe(false)); let task!: Promise<boolean>;
  act(() => { task = result.current.execute({ name: 'point', payload: { contacts: [], winner: 'us' } }); });
  await waitFor(() => expect(mockApply).toHaveBeenCalledTimes(1));
  mockLoad.mockResolvedValue({ ...base, session: { ...base.session, id: 'other-game', organizationId: 'other-org' } });
  rerender({ org: 'other-org', sessionId: 'other-game', userId: 'other-user' });
  await waitFor(() => expect(result.current.detail?.session.id).toBe('other-game'));
  await act(async () => { finish(saved); expect(await task).toBe(false); });
  expect(bridge.applied).not.toHaveBeenCalled(); expect(result.current.detail?.session.id).toBe('other-game'); expect(result.current.busy).toBe(false);
  expect(mockStored.has('goatleta:scouting-draft:v1:other-user:other-org:other-game')).toBe(false);
});

test('foreign persisted timing is preserved as unreadable rather than projected into another scope', async () => {
  const foreign = { ...videoStamp(1200), scope: { userId: 'other-user', org: 'other-org', classId: 'other-class' } };
  const raw = JSON.stringify({ version: 2, revision: 1, contacts: [contact], pending: null, timing: { contacts: [{ id: 'foreign-contact', stamp: foreign }], pointStamp: null } });
  mockStored.set(draftKey, raw); const bridge = videoBridge(() => videoStamp(9000));
  const { result } = renderHook(() => useScoutingCollection('org', 'game', 'user', jest.fn(), bridge));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.readBlocked).toBe(true);
  await act(async () => { await result.current.execute({ name: 'point', payload: { contacts: [], winner: 'us' } }); });
  expect(mockStored.get(draftKey)).toBe(raw); expect(mockApply).not.toHaveBeenCalled(); expect(bridge.applied).not.toHaveBeenCalled();
});

test('identity changes during the confirmed-receipt write block the video projection', async () => {
  let changed = false; const bridge = videoBridge(() => videoStamp(1200));
  mockSet.mockImplementation(async (key, value) => { mockStored.set(key, value); if (JSON.parse(value).pendingCapture?.confirmed) changed = true; });
  mockIdentity.mockImplementation(() => { if (changed) throw new Error('SessionIdentityChanged'); });
  try {
    const { result } = renderHook(() => useScoutingCollection('org', 'game', 'user', jest.fn(), bridge));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { expect(await result.current.execute({ name: 'point', payload: { contacts: [], winner: 'us' } })).toBe(false); });
    expect(mockApply).toHaveBeenCalledTimes(1); expect(bridge.applied).not.toHaveBeenCalled(); expect(result.current.pending).not.toBeNull();
  } finally { mockIdentity.mockImplementation(() => undefined); }
});

const cloneValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
