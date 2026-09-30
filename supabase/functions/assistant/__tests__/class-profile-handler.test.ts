import { handleClassProfile } from "../class-profile-handler";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requestAssistantCompletion } from "../model-policy";
jest.mock("https://esm.sh/@supabase/supabase-js@2", () => ({ createClient: jest.fn() }), { virtual: true });
jest.mock("../../_shared/framework.ts", () => ({ createError: (status: number, code: string, error: string) => ({ status, json: async () => ({code,error}) }), createSuccess: (data: unknown) => ({ status: 200, json: async () => data }) }));
jest.mock("../model-policy.ts", () => ({ resolveAssistantModel: () => "test", requestAssistantCompletion: jest.fn() }));
const requestId = "30000000-0000-4000-8000-000000000001";
const current = { organization_id: "org", class_id: "raposas", version: 1, profile: {schemaVersion: 1, facts: {gameFormat: {value: "6x6"}}} };
const message = { id: requestId, content: "A bola pode pingar uma vez", status: "pending", author_id: "coach", reply: "", question: "" };
let messages: object[];
let writer: jest.Mock;
function client(allowed=true) {
  return {
    rpc: jest.fn().mockResolvedValue({ data: allowed }),
    from: (table: string) => {
      const result = () => ({data: table === "class_pedagogical_profiles" ? current : table === "class_profile_messages" ? messages : []});
      const chain: any = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, maybeSingle: async () => result(), then: (resolve: (x: unknown) => unknown) => Promise.resolve(result()).then(resolve) };
      return chain;
    },
  };
}
beforeEach(() => {
  jest.clearAllMocks(); messages=[];
  (global as any).Deno = {env:{get: () => "test-only"}};
  writer = jest.fn().mockImplementation(async (_name, args) => {
    if (args.p_action === "message") { messages=[message]; return {data:message}; }
    return { data: current };
  });
  (createClient as jest.Mock).mockReturnValue({rpc:writer});
});
afterAll(() => { delete (global as any).Deno; });
const send = (supabase = client()) => handleClassProfile({supabase: supabase as any,organizationId:"org",classId:"raposas",userId:"coach",body:{action:"send",requestId,content:message.content}});
test("persists the original before inference, and a provider failure leaves a retryable message", async () => {
  (requestAssistantCompletion as jest.Mock).mockImplementation(async () => {
    expect(writer.mock.calls[0][1].p_action).toBe("message"); expect(messages).toHaveLength(1);
    throw new Error("provider down");
  });
  const response = await send();
  expect(await response!.json()).toMatchObject({status:"pending",messages:[expect.objectContaining({content:message.content})]});
  expect(writer.mock.calls.map(call => call[1].p_action)).toEqual(["message"]);
});
test("persistence failure never calls the model or returns a saved status", async () => {
  writer.mockResolvedValueOnce({error:{message:"offline"}});
  const response = await send();
  expect(response!.status).toBe(500); expect(requestAssistantCompletion).not.toHaveBeenCalled();
});
test("rejects unassigned users before constructing a privileged writer", async () => {
  expect((await send(client(false)))!.status).toBe(403);
  expect(createClient).not.toHaveBeenCalled(); expect(requestAssistantCompletion).not.toHaveBeenCalled();
});

test("bootstraps from the real planning cycle updated_at column without rewriting the cycle", async () => {
  const base = client();
  const select = jest.fn();
  const order = jest.fn();
  const legacyDate = "2026-09-28T14:00:00Z";
  const chain: any = { select: (fields: string) => { select(fields); return chain; }, eq: () => chain,
    order: (field: string) => { order(field); return chain; },
    limit: async () => ({data:[{id:"cycle",updated_at:legacyDate,periodization_policy_json:{classDiagnostic:{gameLevel:"6x6",netHeightMeters:2.2,teacherContext:"Pode pingar uma vez"}}}]}),
  };
  let reads = 0;
  const supabase = { ...base, from: (table: string) => {
    if (table === "planning_cycles") return chain;
    if (table === "class_pedagogical_profiles" && reads++ === 0) {
      const empty: any = {select:()=>empty,eq:()=>empty,maybeSingle:async()=>({data:null})};
      return empty;
    }
    return base.from(table);
  }};
  const response = await handleClassProfile({supabase:supabase as any,organizationId:"org",classId:"raposas",userId:"coach",body:{action:"load"}});
  expect(response!.status).toBe(200);
  expect(select).toHaveBeenCalledWith("id,periodization_policy_json,updated_at");
  expect(order).toHaveBeenCalledWith("updated_at");
  expect(writer.mock.calls[0][1]).toMatchObject({p_action:"bootstrap",p_expected_version:0,p_payload:{sourceDate:legacyDate,changes:expect.arrayContaining([{key:"gameFormat",value:"6x6",quote:"Ciclo cycle"}])}});
});
test("re-interprets a racing update and commits against the refreshed version", async () => {
  const interpreted = {kind:"report",changes:[{key:"bounce",value:"pode pingar uma vez",quote:"pode pingar uma vez"}],reply:"Quique mantido como adaptação no 6x6.",question:"Em qual situação?"};
  (requestAssistantCompletion as jest.Mock).mockResolvedValue({ok:true,json:async () => ({choices:[{message:{content:JSON.stringify(interpreted)}}]})});
  let commits=0;
  writer.mockImplementation(async (_name,args) => {
    if (args.p_action === "message") {messages=[message];return {data:message};}
    if (args.p_action === "commit" && commits++ === 0) return {error:{message:"PROFILE_VERSION_CONFLICT"}};
    return {data:current};
  });
  const response = await send();
  expect(await response!.json()).toMatchObject({status:"saved",revisionId:requestId});
  expect(requestAssistantCompletion).toHaveBeenCalledTimes(2);
  expect(writer.mock.calls.at(-1)[1].p_payload.changes[0].value).toBe("pode pingar uma vez");
});
