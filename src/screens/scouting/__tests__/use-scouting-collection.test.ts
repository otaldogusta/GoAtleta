import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useScoutingCollection } from "../use-scouting-collection";
import type { ScoutingDetail } from "../../../db/scouting-collection";

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
