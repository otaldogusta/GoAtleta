import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Exercise the real additive RPC as an unprivileged caller. These synthetic
// policies deliberately expose only one class: invoker must retain that boundary.
const db = new PGlite();
const org = '61000000-0024-4000-8000-000000000100';
const foreign = '61000000-0024-4000-8000-000000000200';
const migration = await readFile(new URL('../../supabase/migrations/20261024102000_activity_review_context_read.sql', import.meta.url), 'utf8');
const read = (organizationId = org, today = '2026-10-24') => db.query(
  'select get_activity_review_context_v1($1::uuid, $2::date) as context', [organizationId, today]);
try {
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth;
    create function auth.uid() returns uuid language sql as
      'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create table students(id text primary key, organization_id uuid, classid text);
    create table attendance_logs(id text primary key, organization_id uuid, classid text, date date, note text);
    create table organization_activity_reviews(id uuid primary key, organization_id uuid, class_ids text[], start_date date, end_date date);
    insert into students values ('s1','${org}','class-visible'),('s2','${org}','class-visible'),('s3','${org}','class-hidden'),('s4','${foreign}','class-visible');
    insert into attendance_logs values
      ('a1','${org}','class-visible','2026-09-26','sensitive note'),
      ('a2','${org}','class-visible','2026-09-26','another note'),
      ('a3','${org}','class-visible','2026-10-23','private'),
      ('a4','${org}','class-visible','2026-09-25','out of window'),
      ('a5','${org}','class-visible','2026-10-24','today excluded'),
      ('a6','${org}','class-hidden','2026-10-23','not visible'),
      ('a7','${foreign}','class-visible','2026-10-23','other organization');
    insert into organization_activity_reviews values
      ('10000000-0000-4000-8000-000000000001','${org}',array['class-visible'],'2026-09-20','2026-09-26'),
      ('10000000-0000-4000-8000-000000000002','${org}',array['class-visible'],'2026-09-20','2026-09-25'),
      ('10000000-0000-4000-8000-000000000003','${foreign}',array['class-visible'],'2026-10-20','2026-10-23');
    alter table students enable row level security;
    alter table attendance_logs enable row level security;
    alter table organization_activity_reviews enable row level security;
    create policy read_students on students for select to authenticated using
      (organization_id='${org}' and classid='class-visible' and auth.uid()='20000000-0000-4000-8000-000000000001');
    create policy read_attendance on attendance_logs for select to authenticated using
      (organization_id='${org}' and classid='class-visible' and auth.uid()='20000000-0000-4000-8000-000000000001');
    create policy read_reviews on organization_activity_reviews for select to authenticated using
      (organization_id='${org}' and auth.uid()='20000000-0000-4000-8000-000000000001');
    grant usage on schema public,auth to authenticated,anon;
    grant select on students,attendance_logs,organization_activity_reviews to authenticated;
  `);
  await db.exec(migration);
  const definition = (await db.query("select prosecdef, provolatile from pg_proc where oid='get_activity_review_context_v1(uuid,date)'::regprocedure")).rows[0];
  assert.equal(definition.prosecdef, false);
  assert.equal(definition.provolatile, 's');
  await db.exec('set role anon');
  await assert.rejects(read(), /permission denied/);
  await db.exec('reset role; set role authenticated');
  await assert.rejects(read(), /Not authorized/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", ['20000000-0000-4000-8000-000000000001']);
  const result = (await read()).rows[0].context;
  assert.deepEqual(result.enrolledClassIds, ['class-visible']);
  assert.deepEqual(result.attendance, [{ classid:'class-visible',date:'2026-09-26' },{ classid:'class-visible',date:'2026-10-23' }]);
  assert.deepEqual(result.reviews, [{ class_ids:['class-visible'],start_date:'2026-09-20',end_date:'2026-09-26' }]);
  assert.ok(!JSON.stringify(result).includes('sensitive'));
  assert.deepEqual((await read(foreign)).rows[0].context, { attendance:[],reviews:[],enrolledClassIds:[] });
  await assert.rejects(read(null), /Missing activity review scope/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", ['20000000-0000-4000-8000-000000000002']);
  assert.deepEqual((await read()).rows[0].context, { attendance:[],reviews:[],enrolledClassIds:[] });
  console.log('[activity-review-read] Invoker RLS, class boundary, date window, deduplication, projection, anonymous and foreign reads passed.');
} finally { await db.close(); }
