import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const actor = '20000000-0000-0000-0000-000000000001';
const other = '20000000-0000-0000-0000-000000000002';
const unverified = '20000000-0000-0000-0000-000000000003';
const org = '10000000-0000-0000-0000-000000000001';
try {
  await db.exec(`
    create role anon; create role authenticated; create schema auth; create schema private;
    create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create table auth.users(id uuid primary key,is_anonymous boolean default false,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    insert into auth.users(id,raw_app_meta_data) values('${actor}','{"email_verified_hybrid_at":"2026-10-08"}'),('${other}','{"provider":"google"}');
    insert into auth.users(id,raw_user_meta_data) values('${unverified}','{"email_verified_hybrid_at":"2026-10-08"}');
    create table public.students(id text primary key,organization_id uuid,student_user_id uuid,name text,birthdate date,age int,
      phone text,cpf_input text,cpf_masked text,rg text,address text,gender_identity text,guardian_name text,guardian_phone text,guardian_relation text,
      position_primary text default 'indefinido',position_secondary text default 'indefinido',health_issue boolean default false,health_issue_notes text,
      medication_use boolean default false,medication_notes text,health_observations text,membership_status text default 'active',student_access_revoked_at timestamptz,
      classid text default 'class-a',owner_id uuid,financial_status text default 'unknown');
    insert into students(id,organization_id,student_user_id,name,birthdate,phone,cpf_masked) values
      ('own','${org}','${actor}','Ana','2008-01-01','5511999990000','***.***.***-25'),
      ('foreign','10000000-0000-0000-0000-000000000002','${other}','Other','2008-01-01','5511999990000',null),
      ('unverified','${org}','${unverified}','Pending','2008-01-01','5511999990000',null);
    alter table students enable row level security;
    grant usage on schema public,auth,private to authenticated,anon;
    grant select,update on students to authenticated;
    create policy self_read on students for select to authenticated using (student_user_id=auth.uid());
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261008235145_student_self_profile.sql',import.meta.url),'utf8'));
  const save = (id,profile) => db.query('select public.save_my_student_profile($1,$2) as receipt',[id,JSON.stringify(profile)]);
  await db.exec('set role anon');
  await assert.rejects(() => save('own',{name:'Denied'}),/permission denied/);
  await db.exec('reset role; set role authenticated');
  await assert.rejects(() => save('own',{name:'Denied'}),/STUDENT_SELF_ACCESS_DENIED/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[unverified]);
  await assert.rejects(() => save('unverified',{name:'Denied'}),/STUDENT_SELF_ACCESS_DENIED/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
  await assert.rejects(() => save('own',{name:'Denied'}),/STUDENT_SELF_ACCESS_DENIED/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
  await assert.rejects(() => save('foreign',{name:'Denied'}),/STUDENT_SELF_ACCESS_DENIED/);
  for (const field of ['organization_id','student_user_id','classid','owner_id','membership_status','financial_status','cpf_masked']) {
    await assert.rejects(() => save('own',{name:'Must not persist',[field]:'injected'}),/SELF_PROFILE_FIELD_DENIED/);
  }
  for (const patch of [null,{},[],{name:null},{health_issue:'true'},{birthdate:'2099-01-01'},{phone:'bad'},{position_primary:'admin'},{cpf_input:'123'},{address:'x'.repeat(2001)}]) {
    await assert.rejects(() => save('own',patch),/INVALID_SELF_PROFILE/);
  }
  const result = await save('own',{name:'Ana updated',birthdate:'2007-05-01',phone:'5511999990001',health_issue:true,health_issue_notes:'Synthetic fixture'});
  assert.deepEqual(result.rows[0].receipt,{student_id:'own',organization_id:org});
  assert.equal((await db.query("select name from students where id='own'")).rows[0].name,'Ana updated');
  // General UPDATE remains denied by RLS; no new policy grants self-edit of arbitrary columns.
  const denied = await db.query("update students set classid='hijacked' where id='own' returning id");
  assert.equal(denied.rows.length,0);
  await save('own',{health_issue:false});
  assert.equal((await db.query("select health_issue_notes from students where id='own'")).rows[0].health_issue_notes,null);
  await db.exec('reset role');
  const saved = (await db.query("select name,birthdate::text,phone,cpf_masked,classid,financial_status from students where id='own'")).rows[0];
  assert.deepEqual(saved,{name:'Ana updated',birthdate:'2007-05-01',phone:'5511999990001',cpf_masked:'***.***.***-25',classid:'class-a',financial_status:'unknown'});
  await db.exec("update students set membership_status='inactive' where id='own'; set role authenticated");
  await assert.rejects(() => save('own',{name:'Denied'}),/STUDENT_SELF_ACCESS_DENIED/);
  await db.exec("reset role; update students set membership_status='active',student_access_revoked_at=now() where id='own'; set role authenticated");
  await assert.rejects(() => save('own',{name:'Denied'}),/STUDENT_SELF_ACCESS_DENIED/);
  console.log('[student-self-profile] scoped save, receipt, immutable fields, validation, RLS and revoked/unverified access passed.');
} finally { await db.close(); }
