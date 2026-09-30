import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const org = '20000000-0000-0000-0000-000000000001';
const other = '20000000-0000-0000-0000-000000000002';
const coach = '10000000-0000-0000-0000-000000000001';
const stranger = '10000000-0000-0000-0000-000000000002';
const admin = '10000000-0000-0000-0000-000000000003';
const id = n => `30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
    create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create table organizations(id uuid primary key); insert into organizations values('${org}'),('${other}');
    create table classes(id text primary key, organization_id uuid); insert into classes values('raposas','${org}'),('outra','${other}'),('sem_vinculo','${org}');
    create table organization_members(organization_id uuid,user_id uuid,role_level int);
    insert into organization_members values('${org}','${coach}',10),('${org}','${stranger}',10),('${org}','${admin}',50);
    create table class_staff(organization_id uuid,class_id text,user_id uuid); insert into class_staff values('${org}','raposas','${coach}');
    create table session_logs(id text,classid text,organization_id uuid,createdat text);
    create table training_plans(id text primary key,organization_id uuid,classid text,title text,tags jsonb,warmup jsonb,main jsonb,cooldown jsonb,
      warmuptime text,maintime text,cooldowntime text,applydays int[],applydate date,createdat text default now()::text,version int,status text,origin text,deleted_at timestamptz,
      inputhash text,generatedat timestamptz,finalizedat timestamptz,parent_plan_id text,previous_version_id text,pedagogy jsonb,created_by uuid,updated_by uuid);
    grant usage on schema public,auth to authenticated,service_role,anon;
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/20260929025310_class_pedagogical_profiles.sql',import.meta.url),'utf8'));
  const call = async (action,n,payload={},version=null,actor=coach,organization=org,cls='raposas') => (await db.query(
    'select mutate_class_profile($1,$2,$3,$4,$5,$6,$7) as result', [organization,cls,actor,id(n),action,payload,version])).rows[0].result;
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[coach]);
  await assert.rejects(() => call('bootstrap',1,{},0), /permission denied/);
  await assert.rejects(() => db.exec("insert into class_pedagogical_profiles(organization_id,class_id) values('"+org+"','raposas')"),/permission denied/);
  await db.exec('reset role; set role service_role');
  await assert.rejects(() => call('bootstrap',1,{},0,stranger), /PROFILE_FORBIDDEN/);
  await assert.rejects(() => call('bootstrap',1,{},0,admin,other,'outra'), /PROFILE_FORBIDDEN/);
  await assert.rejects(() => call('bootstrap',1,{},0,coach,org,'sem_vinculo'), /PROFILE_FORBIDDEN/);
  await call('bootstrap',1,{changes:[{key:'gameFormat',value:'6x6',quote:'Ciclo anterior'}]},0);
  await call('bootstrap',2,{changes:[{key:'gameFormat',value:'2x2'}]},0); // import never overwrites
  const msg = await call('message',3,{content:'A turma permite um quique.'});
  assert.equal(msg.status,'pending');
  assert.equal((await call('message',3,{content:msg.content})).id,msg.id);
  await assert.rejects(() => call('message',3,{content:'outro texto'}),/PROFILE_REQUEST_REUSED/);
  await assert.rejects(() => call('commit',3,{changes:[]},0),/PROFILE_VERSION_CONFLICT/);
  let saved = await call('commit',3,{changes:[{key:'bounce',value:'um quique',quote:'um quique'}],reply:'Entendido.'},1);
  assert.equal(saved.version,2);
  assert.equal((await call('commit',3,{},1)).version,2); // retry after lost response
  saved = await call('selectors',4,{changes:[{key:'netHeight',value:'2.2'}]},2);
  assert.equal(saved.version,3);
  saved = await call('undo',5,{revisionId:id(3)},3);
  assert.equal(saved.profile.facts.bounce,undefined);
  assert.equal(saved.profile.facts.netHeight.value,'2.2');
  await call('message',6,{content:'Pode quicar duas vezes.'});
  saved = await call('commit',6,{changes:[{key:'bounce',value:'duas vezes',quote:'duas vezes'}]},4);
  saved = await call('undo',7,{revisionId:id(3)},5);
  assert.equal(saved.profile.facts.bounce.value,'duas vezes'); // later correction survives
  await call('suggest',8,{evidenceKey:'two-reports',candidate:{changes:[{key:'continuity',value:'Mantém o rally',quote:'Mantém o rally'}]}},5);
  await call('reject',9,{suggestionId:id(8)},5);
  await call('suggest',10,{evidenceKey:'two-reports',candidate:{changes:[]}},5);
  await assert.rejects(() => call('accept',11,{suggestionId:id(8)},5),/PROFILE_SUGGESTION_STALE/);
  await db.exec('reset role; set role authenticated');
  assert.equal((await db.query('select * from class_pedagogical_profiles')).rows.length,1);
  assert.equal((await db.query('select * from class_profile_suggestions')).rows.length,1);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[stranger]);
  for(const table of ['class_pedagogical_profiles','class_profile_messages','class_profile_revisions','class_profile_suggestions']) {
    assert.equal((await db.query(`select * from ${table}`)).rows.length,0);
    await assert.rejects(() => db.exec(`delete from ${table}`),/permission denied/);
  }
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
  assert.equal((await db.query('select * from class_pedagogical_profiles')).rows.length,1);
  await db.exec('reset role; set role anon');
  await assert.rejects(() => db.query('select * from class_pedagogical_profiles'),/permission denied/);
  await db.exec('reset role');
  await db.query(`insert into training_plans(id,organization_id,classid,applydate,version,status,origin,main) values('base',$1,'raposas','2099-01-01',1,'generated','auto','["Original"]')`,[org]);
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[coach]);
  const preview = async () => (await db.query('select preview_class_profile_plans($1,$2,$3) as result',[org,'raposas',['2099-01-01']])).rows[0].result;
  const token = (await preview())[0].token;
  const next = {id:'next',title:'Ajustado',main:['6x6 com um quique'],warmup:[],cooldown:[],pedagogy:{decisionTrace:{influences:{pedagogicalProfile:{version:5}}}}};
  const apply = (version=5,plan=next) => db.query('select apply_class_profile_plan($1,$2,$3,$4,$5,$6)',[org,'raposas','base',token,version,plan]);
  await assert.rejects(() => apply(4),/PROFILE_VERSION_CONFLICT/);
  await db.exec('reset role');
  await db.query("update training_plans set main='[\"Manual alteration\"]' where id='base'");
  await db.exec('set role authenticated');
  await assert.rejects(() => apply(),/PROFILE_PLAN_CHANGED/);
  await db.exec('reset role');
  await db.query("update training_plans set main='[\"Original\"]' where id='base'");
  await db.query("insert into session_logs values('done','raposas',$1,'2099-01-01 15:00:00+00')",[org]);
  await db.exec('set role authenticated');
  assert.equal((await preview()).length,0);
  await assert.rejects(() => apply(),/PROFILE_PLAN_PROTECTED/);
  await db.exec("reset role; update session_logs set createdat='invalid legacy date'; set role authenticated");
  assert.equal((await preview()).length,0); // Unknown execution date must not silently permit replacement.
  await db.exec("reset role; delete from session_logs; update training_plans set origin='edited_auto' where id='base'; set role authenticated");
  assert.equal((await preview()).length,0);
  await db.exec("reset role; update training_plans set origin='auto' where id='base'; set role authenticated");
  await apply(); await apply(); // response-loss retry is idempotent
  assert.equal((await preview())[0].plan.id,'next');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[stranger]);
  await assert.rejects(() => preview(),/PROFILE_FORBIDDEN/);
  await assert.rejects(() => apply(),/PROFILE_FORBIDDEN/);
  await db.exec('reset role; set role service_role');
  await call('message',21,{content:'Domina passe'});
  await call('commit',21,{changes:[{key:'fundamentals',value:'Domina passe',quote:'Domina passe'}]},5);
  await call('message',22,{content:'Também domina saque'});
  const appended = await call('commit',22,{changes:[{key:'fundamentals',value:'domina saque',quote:'Também domina saque',operation:'append'}]},6);
  assert.equal(appended.profile.facts.fundamentals.value,'Domina passe; domina saque');
  assert.equal(appended.profile.facts.fundamentals.claims.length,2);
  assert.equal(appended.profile.facts.fundamentals.claims[0].sourceId,id(21));
  console.log('Class profile SQL: RLS, roles, org/class isolation, pending messages, atomic revisions, retries, conflicts, undo and rejected-evidence deduplication passed.');
} finally { await db.close(); }
