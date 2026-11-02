import { applyScoutingCommand, loadScoutingOverview, loadScoutingDetail } from "../scouting-collection";
const mockPost = jest.fn();
const mockGet = jest.fn();
const mockAssert = jest.fn();
jest.mock("../client", () => ({ supabasePost: (...args: unknown[]) => mockPost(...args), supabaseGet: (...args: unknown[]) => mockGet(...args) }));
jest.mock("../../auth/session", () => ({ getSessionIdentity: () => ({ userId: "user", generation: 3 }), assertSessionIdentity: (...args: unknown[]) => mockAssert(...args) }));
jest.mock("../scouting-sessions", () => ({ scoutingSessionRowToModel: (row: unknown) => row, scoutingActionRowToModel: (row: unknown) => row }));
beforeEach(() => { jest.clearAllMocks(); });
test("commands carry explicit org, revision, request identity, and auth generation", async () => {
  mockPost.mockResolvedValue({ session: {}, actions: [], rallies: [] });
  await applyScoutingCommand("org", "session", { revision: 7, requestId: "request-0001", command: { name: "point", payload: { contacts: [], winner: "them" } } });
  expect(mockPost).toHaveBeenCalledWith("/rpc/apply_scouting_command", { p_organization_id: "org", p_session_id: "session", p_expected_revision: 7, p_request_id: "request-0001", p_command: "point", p_payload: { contacts: [], winner: "them" } }, undefined, { userId: "user", generation: 3 });
  expect(mockAssert).toHaveBeenCalledWith({ userId: "user", generation: 3 });
});
test("schema rollout fallback is read-only and remains organization scoped", async () => {
  mockPost.mockRejectedValue(new Error("PGRST202")); mockGet.mockResolvedValue([]);
  expect((await loadScoutingOverview("org", "class", 50)).ready).toBe(false);
  expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("organization_id=eq.org&classid=eq.class"), { userId: "user", generation: 3 });
});
test("network/auth failures are not reported as an empty history", async () => {
  mockPost.mockRejectedValue(new Error("403 42501"));
  await expect(loadScoutingOverview("org", "class")).rejects.toThrow("42501");
  await expect(loadScoutingDetail("org", "session")).rejects.toThrow("42501");
  expect(mockGet).not.toHaveBeenCalled();
});

test.each([undefined,null,2,4,'3',true])('capability %p does not opt a backend into capture version 3',async captureVersion=>{
  mockPost.mockResolvedValue({session:{},actions:[],rallies:[],captureVersion});
  expect((await loadScoutingDetail('org','session')).captureVersion).toBe(2);
});

test('only an explicit numeric captureVersion 3 unlocks the additive outcome and maps it without a contact',async()=>{
  const outcome={kind:'ace',team:'them'},raw={id:'point-1',session_id:'session',set_number:1,number:1,won:false,serve:'them',rotation:1,score_us:0,score_them:1,contacts:[],outcome,createdat:'2026-11-02T10:00:00Z'};
  mockPost.mockResolvedValue({session:{},actions:[],rallies:[raw],captureVersion:3});
  const detail=await loadScoutingDetail('org','session');
  expect(detail.captureVersion).toBe(3);expect(detail.rallies[0]).toMatchObject({outcome,contacts:[],won:false,scoreUs:0,scoreThem:1});
  expect(detail.actions).toEqual([]);expect(raw.contacts).toEqual([]);
});

test.each([
  {name:'point',payload:{contacts:[],winner:'them',outcome:{kind:'ace',team:'them'}}},
  {name:'point',payload:{contacts:[],winner:'them',outcome:{kind:'falta',team:'us',reason:'rede'}}},
  {name:'point',payload:{contacts:[],winner:'them',outcome:null}},
  {name:'point',payload:{contacts:[{fundamental:'ataque',resultKey:'freeball_devolvida',phase:'transicao'}],winner:'us'}},
  {name:'action',payload:{contacts:[{fundamental:'ataque',resultKey:'bloqueio_continua',phase:'side_out'}]}},
])('legacy/default capability blocks additive command %# before any transport request',async command=>{
  const pending={revision:1,requestId:'additive-request',command} as Parameters<typeof applyScoutingCommand>[2];
  await expect(applyScoutingCommand('org','session',pending)).rejects.toThrow('SCOUTING_CAPTURE_UPDATE_REQUIRED');
  await expect(applyScoutingCommand('org','session',pending,2)).rejects.toThrow('SCOUTING_CAPTURE_UPDATE_REQUIRED');
  expect(mockPost).not.toHaveBeenCalled();expect(mockGet).not.toHaveBeenCalled();
});

test('explicit capability 3 sends one point intent with no invented receiver or extra action',async()=>{
  const payload={contacts:[],winner:'them' as const,outcome:{kind:'ace' as const,team:'them' as const}};
  mockPost.mockResolvedValue({session:{},actions:[],rallies:[],captureVersion:3});
  await applyScoutingCommand('org','session',{revision:1,requestId:'ace-request',command:{name:'point',payload}},3);
  expect(mockPost).toHaveBeenCalledTimes(1);expect(mockPost.mock.calls[0][1]).toMatchObject({p_command:'point',p_payload:payload});
  expect(mockPost.mock.calls[0][1].p_payload.contacts).toEqual([]);
});

test('malformed returned outcome fails the read without falling back or writing a replacement',async()=>{
  mockPost.mockResolvedValue({session:{},actions:[],captureVersion:3,rallies:[{outcome:{kind:'ace',team:'them',studentId:'invented'}}]});
  await expect(loadScoutingDetail('org','session')).rejects.toThrow('desfecho válido');
  expect(mockPost).toHaveBeenCalledTimes(1);expect(mockGet).not.toHaveBeenCalled();
});
