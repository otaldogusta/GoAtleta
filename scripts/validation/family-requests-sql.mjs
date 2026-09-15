import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const org='20000000-0000-0000-0000-000000000001';
const foreign='20000000-0000-0000-0000-000000000002';
const admin='10000000-0000-0000-0000-000000000001';
const parent='10000000-0000-0000-0000-000000000002';
const child='10000000-0000-0000-0000-000000000003';
const key='30000000-0000-0000-0000-000000000001';
const actor = (id) => db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
const sql = (file) => readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8');
const rejects = async (operation, pattern) => {
  await db.exec('savepoint expected_failure');
  try { await assert.rejects(operation, pattern); }
  finally { await db.exec('rollback to savepoint expected_failure; release savepoint expected_failure'); }
};
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{"email_verified_hybrid_at":"yes"}',is_anonymous boolean default false);
    insert into auth.users(id,email) values('${admin}','admin@example.com'),('${parent}','parent@example.com'),('${child}','child@example.com');
    create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create table organizations(id uuid primary key,name text);
    insert into organizations values('${org}','Org'),('${foreign}','Other');
    create table classes(id text primary key,organization_id uuid,name text,days jsonb,starttime text);
    create table students(id text primary key,organization_id uuid references organizations(id),name text,classid text,student_user_id uuid,
      login_email text,deleted_at timestamptz,membership_status text default 'active',student_access_revoked_at timestamptz);
    insert into students(id,organization_id,name) values('s','${org}','Lucas'),('s2','${org}','Lia'),('foreign','${foreign}','Other');
    create function public.is_org_admin(id uuid) returns boolean language sql as $$ select auth.uid()='${admin}'::uuid and id='${org}'::uuid $$;
  `);
  await db.exec(`create function public.is_platform_admin() returns boolean language sql as 'select false';
    create table organization_members(organization_id uuid,user_id uuid,role_level integer);
    insert into organization_members values('${org}','${admin}',50);
    create table organization_access_requests(id uuid primary key default gen_random_uuid(),organization_id uuid,requester_user_id uuid,
      requester_email text,requester_name text,status text default 'pending',requested_at timestamptz default now(),reviewed_at timestamptz,
      reviewed_by uuid,review_role_level integer,review_idempotency_key uuid);
    create unique index pending_request on organization_access_requests(organization_id,requester_user_id) where status='pending';
    create table notifications(organization_id uuid,recipient_user_id uuid,inbox_scope text,actor_user_id uuid,type text,title text,body text,action_url text,source_type text,source_id text);
  `);
  const foundation=await sql('20260831005113_family_access_foundation.sql');
  await db.exec(foundation.slice(foundation.indexOf('create unique index'),foundation.indexOf('alter table public.student_relationships enable')));
  const coreStart=foundation.indexOf('create or replace function public.claim_student_relationship_invite_v1(');
  const coreEnd=foundation.indexOf('$$;',coreStart)+3;
  await db.exec(foundation.slice(coreStart,coreEnd));
  await db.exec(await sql('20260914025117_athlete_access_requests.sql'));
  await db.exec(await sql('20260914051017_family_access_requests.sql'));
  await db.exec('begin');
  await actor(parent);
  const request=async (kind='guardian',name='Lucas') => (await db.query('select request_family_access($1,$2,$3,$4) id',[org,kind,name,'Pai'])).rows[0].id;
  const req=await request();
  assert.equal(await request(),req);
  await rejects(()=>request('guardian','Lia'),/pedido pendente/);
  await rejects(()=>db.query('select list_family_request_candidates($1)',[req]),/authorized/);
  await actor(admin);
  await db.exec(`insert into classes values('schedule-class','${org}','Vôlei','[1,3]'::jsonb,'14:00'); update students set classid='schedule-class' where id='s';`);
  const scheduledCandidate = (await db.query('select * from list_family_request_candidates($1)', [req])).rows.find(row => row.id === 's');
  assert.deepEqual(scheduledCandidate.class_days, [1, 3]);
  assert.equal(scheduledCandidate.class_start_time, '14:00');
  await actor(parent);
  const persisted=await request();
  await actor(admin);
  await rejects(()=>db.query('select review_family_access_request($1,$2,$3,$4)',[persisted,'approved','foreign',key]),/instituição/);
  await db.query('select review_family_access_request($1,$2,$3,$4)',[persisted,'approved','s',key]);
  assert.equal((await db.query('select review_family_access_request($1,$2,$3,$4) changed',[persisted,'approved','s',key])).rows[0].changed,false);
  const rel=(await db.query('select * from student_relationships where user_id=$1',[parent])).rows[0];
  assert.equal(rel.relationship_kind,'guardian'); assert.equal(rel.can_view_financial,false); assert.equal(rel.can_view_health,false);
  assert.equal((await db.query("select student_user_id from students where id='s'")).rows[0].student_user_id,null);
  assert.equal((await db.query('select count(*)::int n from organization_members where user_id=$1',[parent])).rows[0].n,0);
  await actor(parent);
  await rejects(()=>db.query('select create_guardian_athlete_invite($1,$2,$3,$4)',[org,'s2','a'.repeat(64),'child@example.com']),/NOT_AUTHORIZED/);
  await db.query('select create_guardian_athlete_invite($1,$2,$3,$4)',[org,'s','a'.repeat(64),'child@example.com']);
  const invite=(await db.query('select * from student_relationship_invites')).rows[0];
  assert.equal(invite.relationship_kind,'athlete'); assert.equal(invite.can_pay,false);
  await rejects(()=>db.query('select claim_student_relationship_invite_v1($1,$2,$3)',['a'.repeat(64),child,'wrong@example.com']),/EMAIL_MISMATCH/);
  const receipt=(await db.query('select claim_student_relationship_invite_v1($1,$2,$3) receipt',['a'.repeat(64),child,'child@example.com'])).rows[0].receipt;
  assert.equal(receipt.status,'claimed');
  assert.equal((await db.query("select student_user_id from students where id='s'")).rows[0].student_user_id,child);
  assert.equal((await db.query('select count(*)::int n from organization_members where user_id=$1',[child])).rows[0].n,0);
  assert.equal((await db.query('select claim_student_relationship_invite_v1($1,$2,$3) receipt',['a'.repeat(64),child,'child@example.com'])).rows[0].receipt.status,'already_claimed');
  await db.query(`insert into student_relationship_invites(organization_id,student_id,token_hash,invited_email,invited_via,relationship_kind,created_by,can_view_health,can_view_financial,can_pay)
    values($1,'s',$2,'child@example.com','link','athlete',$3,true,true,true)`,[org,'c'.repeat(64),admin]);
  await db.query('select claim_student_relationship_invite_v1($1,$2,$3)',['c'.repeat(64),child,'child@example.com']);
  const preserved=(await db.query('select can_view_health,can_view_financial,can_pay from student_relationships where user_id=$1',[child])).rows[0];
  assert.deepEqual(preserved,{can_view_health:false,can_view_financial:false,can_pay:false});
  assert.equal((await db.query("select has_function_privilege('authenticated','public.claim_student_relationship_invite_core(text,uuid,text)','execute') allowed")).rows[0].allowed,false);
  await actor(admin);
  await rejects(()=>db.query('select review_family_access_request($1,$2,$3,$4)',[persisted,'rejected',null,key]),/já revisada/);
  // A second child uses a distinct reviewed relationship, not another account or membership.
  await actor(parent);
  const sibling=await request('guardian','Lia');
  await actor(admin);
  await db.query('select review_family_access_request($1,$2,$3,$4)',[sibling,'approved','s2','30000000-0000-0000-0000-000000000002']);
  assert.equal((await db.query('select count(*)::int n from student_relationships where user_id=$1',[parent])).rows[0].n,2);
  await actor(parent);
  await db.query('select create_guardian_athlete_invite($1,$2,$3,$4)',[org,'s2','b'.repeat(64),'child@example.com']);
  await db.exec("update student_relationship_invites set created_at=now()-interval '2 days',expires_at=now()-interval '1 hour' where token_hash=repeat('b',64)");
  await rejects(()=>db.query('select claim_student_relationship_invite_v1($1,$2,$3)',['b'.repeat(64),child,'child@example.com']),/EXPIRED/);
  await db.exec("update student_relationship_invites set expires_at=now()+interval '1 day',revoked_at=now() where token_hash=repeat('b',64)");
  await rejects(()=>db.query('select claim_student_relationship_invite_v1($1,$2,$3)',['b'.repeat(64),child,'child@example.com']),/REVOKED/);
  await db.exec("update student_relationship_invites set revoked_at=null where token_hash=repeat('b',64); update student_relationships set status='revoked',revoked_at=now(),revocation_reason='Test revocation' where student_id='s2' and relationship_kind='guardian'");
  await rejects(()=>db.query('select claim_student_relationship_invite_v1($1,$2,$3)',['b'.repeat(64),child,'child@example.com']),/REVOKED/);
  await rejects(async () => {
    await db.exec('set local role authenticated');
    await db.query('select claim_student_relationship_invite_v1($1,$2,$3)',['a'.repeat(64),child,'child@example.com']);
  },/permission denied/);
  await rejects(async () => {
    await db.exec('set local role anon');
    await db.query('select request_family_access($1,$2,$3,$4)',[org,'athlete','Lucas',null]);
  },/permission denied/);
  // Multiple parents and institutions remain separate relationships.
  const secondParent='10000000-0000-0000-0000-000000000004';
  await db.query('insert into auth.users(id,email) values($1,$2)',[secondParent,'second-parent@example.com']);
  await db.query(`insert into student_relationship_invites(organization_id,student_id,token_hash,invited_email,invited_via,relationship_kind,created_by)
    values($1,'s',$2,'second-parent@example.com','link','athlete',$3)`,[org,'d'.repeat(64),admin]);
  for(let retry=0;retry<2;retry++) {
    const conflict=(await db.query('select claim_student_relationship_invite_v1($1,$2,$3) receipt',['d'.repeat(64),secondParent,'second-parent@example.com'])).rows[0].receipt;
    assert.equal(conflict.status,'conflict');
  }
  assert.equal((await db.query("select count(*)::int n from notifications where source_type='family_invite_conflict'")).rows[0].n,1);
  assert.equal((await db.query("select student_user_id from students where id='s'")).rows[0].student_user_id,child);
  await actor(secondParent);
  const otherParentRequest=await request('guardian','Lucas');
  await actor(admin);
  await db.query('select review_family_access_request($1,$2,$3,$4)',[otherParentRequest,'approved','s','30000000-0000-0000-0000-000000000003']);
  assert.equal((await db.query("select count(*)::int n from student_relationships where student_id='s' and relationship_kind='guardian' and status='active'")).rows[0].n,2);
  await db.exec(`create or replace function public.is_org_admin(id uuid) returns boolean language sql as $$ select auth.uid()='${admin}'::uuid and id in ('${org}'::uuid,'${foreign}'::uuid) $$`);
  await actor(parent);
  const foreignRequest=(await db.query('select request_family_access($1,$2,$3,$4) id',[foreign,'guardian','Other','Pai'])).rows[0].id;
  await actor(admin);
  const foreignCandidates=(await db.query('select * from list_family_request_candidates($1)',[foreignRequest])).rows;
  assert.deepEqual(foreignCandidates.map(row=>row.id),['foreign']);
  await db.query('select review_family_access_request($1,$2,$3,$4)',[foreignRequest,'approved','foreign','30000000-0000-0000-0000-000000000004']);
  assert.equal((await db.query("select count(distinct organization_id)::int n from student_relationships where user_id=$1",[parent])).rows[0].n,2);
  await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int n from student_relationships')).rows[0].n,0);
  console.log('Family requests SQL passed: org scope, no staff grants, siblings, multiple guardians/institutions, identity, expiry, revocation, role grants, replay and rollback (isolated PostgreSQL).');
} catch (error) { console.error(error.message); process.exitCode=1; }
finally { await db.close(); }
