import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useScoutingCollection } from "../use-scouting-collection";
import type { ScoutingDetail } from "../../../db/scouting-collection";
import type { ScoutingRallyOutcome } from '../../../core/models';

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
beforeEach(() => { jest.clearAllMocks(); mockStored.clear(); mockLoad.mockResolvedValue(base); mockApply.mockResolvedValue(saved); });

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
