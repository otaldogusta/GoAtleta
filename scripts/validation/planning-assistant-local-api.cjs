// Disposable database + real PostgREST. No remote URL, credentials or app data.
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { randomUUID, createHmac } = require('node:crypto');
const { Buffer } = require('node:buffer');
const assert = require('node:assert/strict');
const suffix = randomUUID().slice(0, 8);
const database = `planning_qa_${suffix}`;
const container = `planning-qa-rest-${suffix}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 8e6 });
const stacks = docker('ps', '--format', '{{.Names}}').trim().split('\n').filter(x => x.startsWith('supabase_db_'));
assert.equal(stacks.length, 1, 'Start exactly one local Supabase Docker stack');
const stack = stacks[0];
const sql = (text, db = database) => execFileSync('docker', ['exec', '-i', stack, 'psql', '-U', 'postgres', '-d', db, '-q', '-v', 'ON_ERROR_STOP=1'], { input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const org = '20000000-0000-0000-0000-000000000001';
const other = '20000000-0000-0000-0000-000000000002';
const coach = '10000000-0000-0000-0000-000000000001';
const stranger = '10000000-0000-0000-0000-000000000002';
const admin = '10000000-0000-0000-0000-000000000003';
async function main() {
  let created = false;
  try {
    sql(`create database ${database};`, 'postgres'); created = true;
    const source = readFileSync('scripts/validation/class-profile-sql.mjs', 'utf8');
    let fixture = source.split('await db.exec(`')[1].split('`);')[0];
    fixture = fixture.replace('create role anon; create role authenticated; create role service_role bypassrls;', '')
      .replace(/\$\{(org|other|coach|stranger|admin)\}/g, (_, key) => ({ org, other, coach, stranger, admin })[key])
      .replace("nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid", "nullif(current_setting(''request.jwt.claims'',true),'''')::jsonb->>''sub''");
    // auth.uid must return UUID with modern PostgREST request.jwt.claims.
    fixture = fixture.replace("select nullif(current_setting(''request.jwt.claims'',true),'''')::jsonb->>''sub''", "select (nullif(current_setting(''request.jwt.claims'',true),'''')::jsonb->>''sub'')::uuid");
    sql(fixture);
    sql(readFileSync('supabase/migrations/20260929025310_class_pedagogical_profiles.sql', 'utf8'));
    sql(`alter table classes add ageband text, add modality text, add goal text, add mv_level text, add level int, add equipment text, add days int[], add starttime text, add duration int;
      alter table session_logs add rpe int, add attendance int, add participants_count int;
      create table students(organization_id uuid,classid text,name text);
      create table planning_cycles(id text,organization_id uuid,classid text,status text,year int,start_date date,periodization_policy_json jsonb,updated_at timestamptz);
      create table class_calendar_exceptions(organization_id uuid,class_id text,date date,kind text);
      create table class_competitive_profiles(organization_id uuid,class_id text,planning_mode text,cycle_start_date date,target_date date,tactical_system text,current_phase text);
      create table class_plans(id text,organization_id uuid,classid text,cycle_id text,startdate date,weeknumber int,phase text,theme text,technical_focus text,physical_focus text,mv_format text,rpe_target int);
      create table training_sessions(id text primary key,organization_id uuid,start_at timestamptz,status text,plan_id text);
      create table training_session_classes(session_id text references training_sessions(id),organization_id uuid,class_id text);
      create table training_session_attendance(session_id text,organization_id uuid,class_id text,status text);
      create table scouting_sessions(id text,organization_id uuid,classid text,date date,status text);
      create table scouting_actions(id int,organization_id uuid,classid text,session_id text,fundamental text,result_key text);
      create table scouting_logs(organization_id uuid,classid text,date date,${['serve','receive','set','attack_send'].flatMap(k=>[0,1,2].map(n=>`${k}_${n} int`)).join(',')});
      insert into class_pedagogical_profiles(organization_id,class_id,profile) values('${org}','raposas','{"facts":{"format":{"value":"6x6"}}}'),('${other}','outra','{"facts":{"private":{"value":"OTHER_CLASS"}}}');
      insert into students values('${org}','raposas','Ana Ficticia');
      insert into training_sessions select 'done-'||n,'${org}',now()-n*interval '1 day','completed',null from generate_series(1,12) n;
      insert into training_sessions values('planned','${org}',now()-interval '1 day','scheduled',null),('old','${org}',now()-interval '31 days','completed',null),('other','${other}',now()-interval '1 day','completed',null);
      insert into training_session_classes select id,organization_id,case when id='other' then 'outra' else 'raposas' end from training_sessions;
      insert into training_session_attendance values('done-1','${org}','raposas','present');
      insert into scouting_sessions values('scout','${org}','raposas',current_date-1,'concluido');
      insert into scouting_actions select n,'${org}','raposas','scout','serve','success' from generate_series(1,1005)n;
      grant select on all tables in schema public to authenticated;
      notify pgrst,'reload schema';`);
    const restName = stack.replace('supabase_db_', 'supabase_rest_');
    const original = JSON.parse(docker('inspect', restName))[0];
    const env = Object.fromEntries(original.Config.Env.map(v => [v.slice(0,v.indexOf('=')), v.slice(v.indexOf('=')+1)]));
    const uri = new URL(env.PGRST_DB_URI); uri.pathname = `/${database}`; env.PGRST_DB_URI = uri.toString(); env.PGRST_DB_SCHEMAS = 'public'; env.PGRST_DB_PRE_REQUEST = ''; env.PGRST_DB_EXTRA_SEARCH_PATH = 'public'; env.PGRST_DB_CONFIG = 'false';
    const key = JSON.parse(env.PGRST_JWT_SECRET).keys.find(k=>k.kty==='oct'); assert.ok(key?.k);
    const token = user => { const part = value=>Buffer.from(JSON.stringify(value)).toString('base64url'); const body=`${part({alg:'HS256',typ:'JWT',kid:key.kid})}.${part({role:'authenticated',sub:user,exp:Math.floor(Date.now()/1000)+600})}`; return `${body}.${createHmac('sha256',Buffer.from(key.k,'base64url')).update(body).digest('base64url')}`; };
    docker('run','-d','--name',container,'--network',Object.keys(original.NetworkSettings.Networks)[0],'-p','127.0.0.1:55441:3000',...Object.entries(env).flatMap(([k,v])=>['-e',`${k}=${v}`]),original.Config.Image);
    for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:55441/')).ok)break;}catch{} await new Promise(r=>setTimeout(r,250));}
    execFileSync('cmd.exe',['/d','/s','/c','npx --yes deno run --no-lock --allow-env --allow-net=127.0.0.1,esm.sh scripts/validation/planning-assistant-local-runner.ts'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,PLANNING_QA_TOKEN:token(coach),PLANNING_QA_DENIED_TOKEN:token(stranger),OPENAI_API_KEY:'local-simulated',ASSISTANT_MODEL:'gpt-4o-mini'}});
    assert.equal(sql('select count(*) from class_profile_messages;').trim().split('\n')[2]?.trim(), '0', 'Discussion must not write profile messages');
    console.log('PASS: real local PostgREST, official completed lessons/8 cap/30 days, 1005-action pagination, profile RLS, user/org/class denial, captured response, model simulation, no profile writes.');
  } finally {
    try { docker('rm','-f',container); } catch {}
    if(created) sql(`select pg_terminate_backend(pid) from pg_stat_activity where datname='${database}'; drop database ${database};`, 'postgres');
  }
}
main().catch(error=>{ console.error(error.stdout || error.stderr || error.message); process.exitCode=1; });
