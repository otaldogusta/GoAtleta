// eslint-disable-next-line import/no-unresolved -- Deno resolves this URL; checked with deno check.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handlePlanningDiscussion, loadPlanningEvidence } from "../../supabase/functions/assistant/planning-context-handler.ts";
const assert = (value: unknown, label: string) => { if (!value) throw new Error(label); };
// Only the model provider is simulated. All SQL/permission reads use real PostgREST.
const originalFetch = globalThis.fetch;
let prompt: any;
globalThis.fetch = async (input, init) => {
  if(String(input).startsWith("https://api.openai.com/")) {
    prompt = JSON.parse(String(init?.body));
    return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ reply: "Orientação simulada para o contexto capturado." }) }] }] });
  }
  return originalFetch(input, init);
};
const client = (token: string) => {
  const supabase = createClient("http://127.0.0.1:55441", "local", { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  // This isolated server exposes PostgREST directly, with no gateway prefix.
  return new Proxy(supabase, { get(target, key) { if(key === "from" || key === "rpc") return (...args: any[]) => { const query = (target[key] as any)(...args); query.url = new URL(query.url.toString().replace('/rest/v1/', '/')); return query; }; return Reflect.get(target,key); } });
};
const org = "20000000-0000-0000-0000-000000000001";
const supabase = client(Deno.env.get("PLANNING_QA_TOKEN")!);
const probe = await supabase.from('classes').select('id');
assert(!probe.error, `Local PostgREST: ${probe.error?.code} ${probe.error?.message}`);
const evidence = await loadPlanningEvidence(supabase, org, "raposas", { month: new Date().toISOString().slice(0,7) });
assert(evidence.sources.every(s => s.status !== "unavailable"), JSON.stringify(evidence.sources));
assert(evidence.confirmed.lessons.length === 8, "Eight official completed sessions");
assert(evidence.confirmed.lessons.every(l=>l.id.startsWith('done-')), "No planned, stale or other-class session");
assert(evidence.confirmed.scouting.completedSessions['serve:success'] === 1005, "Paginated actions aggregate");
const body = { lessonAction: "discuss", planningContext: { version:1,classId:"raposas",selection:{month:new Date().toISOString().slice(0,7),weekNumber:39},draft:{gameLevel:"4x4"}},messages:[{role:"user",content:"Analise"}] };
const response = await handlePlanningDiscussion({supabase,organizationId:org,classId:"raposas",body});
assert(response.status===200, `Discussion response ${response.status}`);
const json = await response.json();
assert(json.planningContextVersion===1 && json.contextDetails.selection.weekNumber===39 && json.draftTraining===null,"Captured advisory contract");
assert(!JSON.stringify(prompt).includes("Ana Ficticia") && !JSON.stringify(prompt).includes("OTHER_CLASS"),"Privacy projection");
for(const [actor,organizationId,classId] of [[client(Deno.env.get('PLANNING_QA_DENIED_TOKEN')!),org,'raposas'],[supabase,org,'sem_vinculo'],[supabase,'20000000-0000-0000-0000-000000000002','outra']] as const) {
  const denied = await handlePlanningDiscussion({supabase:actor,organizationId,classId,body:{...body,planningContext:{...body.planningContext,classId}}});
  assert(denied.status===403,`Scope denied ${denied.status}`);
}
const profiles = await supabase.from('class_pedagogical_profiles').select('*');
assert(profiles.data?.length===1,"Official profile RLS");
globalThis.fetch = originalFetch;
