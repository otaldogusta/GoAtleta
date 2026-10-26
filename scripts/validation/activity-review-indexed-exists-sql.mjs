import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Isolated PostgreSQL, canonical admin helper and both real RPC migrations.
// Synthetic policies deliberately hide a class even from the org admin: the
// invoker RPC must preserve that table boundary rather than bypass it.
const db = new PGlite();
const org = '61000000-0024-4000-8000-000000000100';
const otherOrg = '61000000-0024-4000-8000-000000000200';
const admin = '20000000-0000-4000-8000-000000000001';
const staff = '20000000-0000-4000-8000-000000000002';
const foreign = '20000000-0000-4000-8000-000000000003';
const readMigration = name => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const original = await readMigration('20261024102000_activity_review_context_read.sql');
const optimized = await readMigration('20261024102703_activity_review_context_indexed_exists.sql');
const helperSource = await readMigration('2026021002_fix_org_member_policies.sql');
const helperStart = helperSource.indexOf('create or replace function public.is_org_admin(');
assert.ok(helperStart >= 0);
const adminHelper = helperSource.slice(helperStart, helperSource.indexOf('$$;', helperStart) + 3);
const asUser = async user => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec('set role authenticated');
};
const read = (organizationId = org, today = '2026-10-24') => db.query(
  'select public.get_activity_review_context_v1($1::uuid,$2::date) as context', [organizationId, today]);
let checks = 0;
try {
  await db.exec(`
    create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql as
      'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create table organization_members(organization_id uuid,user_id uuid,role_level integer);
    insert into organization_members values ('${org}','${admin}',50),('${org}','${staff}',10),('${otherOrg}','${foreign}',50);
    create table students(id text primary key,organization_id uuid,classid text);
    create table attendance_logs(id text primary key,organization_id uuid,classid text,date date,note text);
    create table organization_activity_reviews(id uuid primary key,organization_id uuid,class_ids text[],start_date date,end_date date);
    insert into students values ('s-a','${org}','class-a'),('s-a2','${org}','class-a'),('s-b','${org}','class-b'),('s-hidden','${org}','class-hidden'),('s-null','${org}',null),('s-foreign','${otherOrg}','class-a');
    insert into attendance_logs values
      ('a-first','${org}','class-a','2026-09-26','PRIVATE note'),
      ('a-first2','${org}','class-a','2026-09-26','PRIVATE duplicate'),
      ('a-last','${org}','class-a','2026-10-23','PRIVATE'),
      ('b-last','${org}','class-b','2026-10-23','PRIVATE'),
      ('outside-low','${org}','class-a','2026-09-25','PRIVATE'),
      ('outside-high','${org}','class-a','2026-10-24','PRIVATE'),
      ('hidden','${org}','class-hidden','2026-10-23','PRIVATE'),
      ('foreign','${otherOrg}','class-a','2026-10-23','PRIVATE');
    insert into organization_activity_reviews values
      ('10000000-0000-4000-8000-000000000001','${org}',array['class-a'],'2026-09-20','2026-09-26'),
      ('10000000-0000-4000-8000-000000000002','${org}',array['class-a'],'2026-09-20','2026-09-25'),
      ('10000000-0000-4000-8000-000000000003','${otherOrg}',array['class-a'],'2026-10-20','2026-10-23');
    alter table students enable row level security;
    alter table attendance_logs enable row level security;
    alter table organization_activity_reviews enable row level security;
    create policy student_read on students for select to authenticated using
      (organization_id='${org}'and classid<>'class-hidden'and auth.uid()in('${admin}','${staff}'));
    create policy attendance_read on attendance_logs for select to authenticated using
      (organization_id='${org}'and classid<>'class-hidden'and auth.uid()in('${admin}','${staff}'));
    create policy review_read on organization_activity_reviews for select to authenticated using
      (organization_id='${org}'and auth.uid()in('${admin}','${staff}'));
    grant usage on schema public,auth to authenticated,anon;
    grant select on students,attendance_logs,organization_activity_reviews to authenticated;
    create index attendance_logs_org_class_date on attendance_logs(organization_id,classid,date);
  `);
  await db.exec(adminHelper);
  await db.exec('revoke all on function public.is_org_admin(uuid) from public,anon; grant execute on function public.is_org_admin(uuid) to authenticated;');
  await db.exec(original);
  await asUser(admin);
  const baseline = (await read()).rows[0].context;
  await db.exec('reset role');
  await db.exec(optimized);
  const definition = (await db.query("select prosecdef,provolatile from pg_proc where oid='public.get_activity_review_context_v1(uuid,date)'::regprocedure")).rows[0];
  assert.equal(definition.prosecdef, false);
  assert.equal(definition.provolatile, 's'); checks += 1;
  await db.exec('set role anon');
  await assert.rejects(read(), /permission denied/); checks += 1;
  await asUser('');
  await assert.rejects(read(), /Not authorized/); checks += 1;
  await asUser(admin);
  assert.deepEqual((await read()).rows[0].context, baseline); checks += 1;
  const context = (await read()).rows[0].context;
  assert.deepEqual(context.enrolledClassIds, ['class-a', 'class-b']);
  assert.deepEqual(context.attendance, [{ classid: 'class-a', date: '2026-09-26' }, { classid: 'class-a', date: '2026-10-23' }, { classid: 'class-b', date: '2026-10-23' }]); checks += 1;
  assert.equal(context.reviews.length, 1);
  assert.ok(!JSON.stringify(context).includes('PRIVATE'));
  assert.ok(!JSON.stringify(context).includes('class-hidden')); checks += 1;
  await assert.rejects(read(null), /Missing activity review scope/);
  await assert.rejects(read(org, null), /Missing activity review scope/); checks += 1;
  await assert.rejects(read(otherOrg), /admin access required/); checks += 1;
  await asUser(staff);
  await assert.rejects(read(), /admin access required/); checks += 1;
  await asUser(foreign);
  await assert.rejects(read(), /admin access required/); checks += 1;
  await asUser(admin);
  await db.exec('reset role');
  await db.exec(`insert into attendance_logs values('no-enrollment','${org}','class-without-enrollment','2026-10-23','PRIVATE');`);
  await asUser(admin);
  const afterUnenrolled = (await read()).rows[0].context;
  assert.deepEqual(afterUnenrolled, context); checks += 1;
  await db.exec('reset role');
  await db.exec(`insert into students values('new-enrollment','${org}','class-without-enrollment');`);
  await asUser(admin);
  const withEnrollment = (await read()).rows[0].context;
  assert.ok(withEnrollment.enrolledClassIds.includes('class-without-enrollment'));
  assert.ok(withEnrollment.attendance.some(row => row.classid === 'class-without-enrollment')); checks += 1;
  await db.exec('reset role');
  await db.exec(`insert into attendance_logs values('leap-low','${org}','class-a','2028-02-02','PRIVATE'),('leap-last','${org}','class-a','2028-02-29','PRIVATE'),('leap-today','${org}','class-a','2028-03-01','PRIVATE');`);
  await asUser(admin);
  assert.deepEqual((await read(org, '2028-03-01')).rows[0].context.attendance, [{ classid: 'class-a', date: '2028-02-02' }, { classid: 'class-a', date: '2028-02-29' }]); checks += 1;
  await db.exec('reset role');
  await db.exec('create or replace function public.is_org_admin(org_id uuid) returns boolean language sql security definer set search_path=public as $$ select null::boolean $$;');
  await asUser(admin);
  await assert.rejects(read(), /admin access required/); checks += 1;
  console.log(JSON.stringify({ suite: 'activity-review-indexed-exists-sql', checks, status: 'passed', runtime: 'isolated PGlite PostgreSQL' }));
} finally { await db.close(); }
