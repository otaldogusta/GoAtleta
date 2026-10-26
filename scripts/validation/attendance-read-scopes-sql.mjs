import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { validateMonthlyAttendanceSummary } from './monthly-attendance-summary-cases.mjs';

// PostgreSQL-only fixture: canonical class/admin helpers, actual pre-migration
// attendance predicates, and the draft migration. Never connects to Supabase.
const db = new PGlite();
const org = '61000000-0024-4000-8000-000000000100';
const otherOrg = '61000000-0024-4000-8000-000000000200';
const orphanOrg = '61000000-0024-4000-8000-000000000300';
const actors = Object.fromEntries([
  'admin', 'head', 'assigned', 'absent', 'substitute', 'expired', 'future',
  'cancelled', 'revoked', 'student', 'foreign', 'otherAdmin', 'otherStudent', 'ownerOnly', 'family',
].map((name, index) => [name, `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`]));
const migrationName = '20261024183530_optimize_attendance_read_policy_scopes.sql';
const migration = await readFile(new URL(`../../supabase/migrations/${migrationName}`, import.meta.url), 'utf8');
const adminSource = await readFile(new URL('../../supabase/migrations/2026021002_fix_org_member_policies.sql', import.meta.url), 'utf8');
const classSource = await readFile(new URL('../../supabase/migrations/20260921114136_class_staff_history_and_transitions.sql', import.meta.url), 'utf8');
function canonicalFunction(source, name) {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `Missing canonical ${name}`);
  return source.slice(start, source.indexOf('$$;', start) + 3);
}
const canonical = [
  canonicalFunction(adminSource, 'is_org_admin'),
  canonicalFunction(classSource, 'can_read_class'),
  canonicalFunction(classSource, 'can_manage_class'),
  canonicalFunction(classSource, 'is_class_staff'),
].join('\n');
const oldPolicies = `
  create policy "authenticated_4992c9cc37_select" on public.attendance_logs
  for select to authenticated using (
    exists(select 1 from public.students s where s.id=attendance_logs.studentid
      and s.student_user_id=(select auth.uid()))
    or (public.is_org_admin(organization_id) or public.is_class_staff(classid))
  );
  create policy temporal_staff_read on public.attendance_logs
  for select to authenticated using(public.can_read_class(classid));
`;
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
let checks = 0;
const asUser = async (user, role = 'authenticated') => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? '']);
  await db.exec(`set role ${role}`);
};
const rowsAndCount = async () => {
  const rows = (await db.query('select * from public.attendance_logs order by date desc,id desc')).rows;
  const count = Number((await db.query('select count(*)::text as total from public.attendance_logs')).rows[0].total);
  const countA = Number((await db.query('select count(*)::text as total from public.attendance_logs where organization_id=$1', [org])).rows[0].total);
  return { rows, count, countA };
};
const readMatrix = async () => {
  const matrix = {};
  for (const [name, user] of Object.entries(actors)) {
    await asUser(user); matrix[name] = await rowsAndCount();
  }
  await asUser(''); matrix.noSession = await rowsAndCount();
  await asUser('', 'anon'); matrix.anon = await rowsAndCount();
  await asUser('', 'service_role'); matrix.serviceRole = await rowsAndCount();
  await db.exec('reset role'); matrix.superuser = await rowsAndCount();
  return matrix;
};
const tableContract = async () => {
  await db.exec('reset role');
  return (await db.query(`select json_build_object(
    'table',(select row_to_json(x)from(select relacl::text,relrowsecurity,relforcerowsecurity from pg_class where oid='public.attendance_logs'::regclass)x),
    'writes',(select json_agg(x order by policyname)from(select policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public'and tablename='attendance_logs'and cmd<>'SELECT')x),
    'helpers',(select json_agg(x order by proname)from(select proname,proacl::text,prosecdef,provolatile,proconfig,pg_get_functiondef(oid)definition from pg_proc where oid in('public.is_org_admin(uuid)'::regprocedure,'public.can_read_class(text)'::regprocedure,'public.can_manage_class(text)'::regprocedure,'public.is_class_staff(text)'::regprocedure))x)
  )as contract`)).rows[0].contract;
};
const writeMatrix = async () => {
  const matrix = {};
  const actorTargets = {
    assigned: [org, 'other', 's-other', 'other'],
    absent: [org, 'absence', 's-absence', 'absence'], substitute: [org, 'absence', 's-absence', 'absence'],
    expired: [org, 'expired', 's-expired', 'expired'], future: [org, 'future', 's-future', 'future'],
    cancelled: [org, 'cancelled', 's-cancelled', 'cancelled'], ownerOnly: [org, 'owner-only', 's-owner', 'owner-only'],
    otherAdmin: [otherOrg, 'foreign', 's-foreign', 'foreign'], otherStudent: [otherOrg, 'foreign', 's-foreign', 'foreign'],
    foreign: [otherOrg, 'foreign', 's-foreign', 'foreign'],
  };
  for (const [name, user] of [...Object.entries(actors), ['anon', ''], ['noSession', ''], ['serviceRole', '']]) {
    matrix[name] = {};
    const [targetOrg, targetClass, targetStudent, targetId] = actorTargets[name] ?? [org, 'main', 's-a', 'a-1'];
    const statements = [
      ['insert', `insert into public.attendance_logs(id,organization_id,classid,studentid,date,status,note) values('write-test',${quote(targetOrg)},${quote(targetClass)},${quote(targetStudent)},'2026-10-24','presente','temporary')returning id`],
      ['update', `update public.attendance_logs set note='temporary' where id=${quote(targetId)}returning id`],
      ['delete', `delete from public.attendance_logs where id=${quote(targetId)}returning id`],
    ];
    for (const [operation, statement] of statements) {
      await db.exec('reset role;begin');
      try {
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
        await db.exec(`set local role ${name === 'anon' ? 'anon' : name === 'serviceRole' ? 'service_role' : 'authenticated'}`);
        const result = await db.query(statement);
        matrix[name][operation] = { ids: result.rows.map(row => row.id) };
      } catch (error) { matrix[name][operation] = { errorCode: error.code }; }
      finally { await db.exec('rollback'); }
    }
  }
  return matrix;
};
try {
  await db.exec(`
    create role authenticated;create role anon;create role service_role bypassrls;
    create schema auth;create schema private;
    create function auth.uid()returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create table public.organization_members(organization_id uuid,user_id uuid,role_level integer,primary key(organization_id,user_id));
    create table public.classes(id text primary key,organization_id uuid,owner_id uuid);
    create table public.class_staff(id text primary key,organization_id uuid,class_id text,user_id uuid,staff_role text);
    create table public.class_staff_substitutions(id text primary key,organization_id uuid,class_id text,absent_user_id uuid,replacement_user_id uuid,status text,starts_on date,ends_on date);
    create table public.students(id text primary key,organization_id uuid,classid text,student_user_id uuid);
    create table public.attendance_logs(id text primary key,organization_id uuid,classid text,studentid text,date date,status text,note text,pain_score integer,createdat timestamptz default '2026-10-24T12:00:00Z');
    insert into public.organization_members values
      ('${org}','${actors.admin}',50),('${orphanOrg}','${actors.admin}',50),
      ('${org}','${actors.head}',10),('${org}','${actors.assigned}',10),('${org}','${actors.absent}',10),
      ('${org}','${actors.substitute}',10),('${org}','${actors.expired}',10),('${org}','${actors.future}',10),
      ('${org}','${actors.cancelled}',10),('${otherOrg}','${actors.foreign}',10),('${otherOrg}','${actors.otherAdmin}',50);
    insert into public.classes values
      ('main','${org}',null),('other','${org}',null),('absence','${org}',null),
      ('expired','${org}',null),('future','${org}',null),('cancelled','${org}',null),
      ('owner-only','${org}','${actors.ownerOnly}'),('foreign','${otherOrg}',null);
    insert into public.class_staff values
      ('head','${org}','main','${actors.head}','head'),
      ('assigned','${org}','other','${actors.assigned}','assistant'),
      ('absent','${org}','absence','${actors.absent}','head');
    insert into public.class_staff_substitutions values
      ('active','${org}','absence','${actors.absent}','${actors.substitute}','active',current_date-1,current_date+1),
      ('expired','${org}','expired','${actors.absent}','${actors.expired}','active',current_date-4,current_date-1),
      ('future','${org}','future','${actors.absent}','${actors.future}','active',current_date+1,current_date+4),
      ('cancelled','${org}','cancelled','${actors.absent}','${actors.cancelled}','cancelled',current_date-1,current_date+1);
    insert into public.students values
      ('s-a','${org}','main','${actors.student}'),('s-a2','${org}','main',null),('s-other','${org}','other',null),
      ('s-absence','${org}','absence',null),('s-expired','${org}','expired',null),('s-future','${org}','future',null),
      ('s-cancelled','${org}','cancelled',null),('s-owner','${org}','owner-only',null),('s-foreign','${otherOrg}','foreign','${actors.otherStudent}');
    insert into public.attendance_logs(id,organization_id,classid,studentid,date,status,note,pain_score)values
      ('a-1','${org}','main','s-a','2026-10-01','presente','preserve',3),
      ('a-2','${org}','main','s-a2','2026-10-24','faltou','preserve',0),
      ('other','${org}','other','s-other','2026-10-24','presente','preserve',1),
      ('absence','${org}','absence','s-absence','2026-10-24','presente','preserve',1),
      ('expired','${org}','expired','s-expired','2026-10-24','presente','preserve',1),
      ('future','${org}','future','s-future','2026-10-24','presente','preserve',1),
      ('cancelled','${org}','cancelled','s-cancelled','2026-10-24','presente','preserve',1),
      ('owner-only','${org}','owner-only','s-owner','2026-10-24','presente','preserve',1),
      ('foreign','${otherOrg}','foreign','s-foreign','2026-10-24','presente','preserve',1),
      ('mismatch-org','${otherOrg}','main','s-a','2026-10-24','presente','preserve',1),
      ('mismatch-class','${org}','foreign','s-foreign','2026-10-24','presente','preserve',1),
      ('orphan-class','${org}','missing','s-a2','2026-10-24','presente','preserve',1),
      ('orphan-org','${orphanOrg}','missing','missing','2026-10-24','presente','preserve',1),
      ('orphan-student','${org}','main','missing','2026-10-24','presente','preserve',1);
    grant usage on schema public,auth to authenticated,anon,service_role;
    grant select,insert,update,delete on all tables in schema public to authenticated,service_role;
    grant select on all tables in schema public to anon;
  `);
  await db.exec(canonical);
  await db.exec(`
    alter table public.students enable row level security;
    create policy student_read on public.students for select to authenticated using(
      public.can_read_class(classid)or student_user_id=(select auth.uid())or public.is_org_admin(organization_id)or public.is_class_staff(classid));
    alter table public.attendance_logs enable row level security;
    create policy "attendance_logs insert trainer"on public.attendance_logs for insert to authenticated with check(public.is_org_admin(organization_id)or public.is_class_staff(classid));
    create policy "attendance_logs update trainer"on public.attendance_logs for update to authenticated using(public.is_org_admin(organization_id)or public.is_class_staff(classid))with check(public.is_org_admin(organization_id)or public.is_class_staff(classid));
    create policy "attendance_logs delete trainer"on public.attendance_logs for delete to authenticated using(public.is_org_admin(organization_id));
  `);
  await db.exec(oldPolicies);
  const beforeReads = await readMatrix();
  const beforeWrites = await writeMatrix();
  const beforeContract = await tableContract();
  assert.ok(beforeReads.admin.rows.some(row => row.id === 'orphan-org'));
  assert.ok(beforeReads.head.rows.some(row => row.id === 'mismatch-org'));
  assert.deepEqual(beforeReads.student.rows.map(row => row.id), ['mismatch-org', 'a-1']);
  assert.equal(beforeReads.assigned.count, 1);assert.equal(beforeReads.absent.count, 1);assert.equal(beforeReads.substitute.count, 1);
  for (const name of ['expired','future','cancelled','revoked','foreign','ownerOnly','family','noSession','anon']) assert.equal(beforeReads[name].count, 0, name);
  assert.deepEqual(beforeWrites.absent.update.ids, []);
  assert.deepEqual(beforeWrites.substitute.update.ids, ['absence']);
  assert.deepEqual(beforeWrites.assigned.update.ids, ['other']);
  checks += 19;
  // Unknown policy blocks before new functions or canonical policies are touched.
  await db.exec('create policy unexpected_custom_read on public.attendance_logs for select to authenticated using(false)');
  await assert.rejects(db.exec(migration), /Unexpected attendance SELECT policies/);
  assert.equal((await db.query("select to_regprocedure('private.attendance_readable_class_ids()')is null as absent")).rows[0].absent, true);
  await db.exec('drop policy unexpected_custom_read on public.attendance_logs');checks += 2;
  await db.exec('alter policy temporal_staff_read on public.attendance_logs using(public.can_read_class(classid)and id is not null)');
  await assert.rejects(db.exec(migration), /Unexpected attendance SELECT policies/);
  await db.exec('alter policy temporal_staff_read on public.attendance_logs using(public.can_read_class(classid))');checks += 1;
  await db.exec(migration);
  const afterContract = await tableContract();assert.deepEqual(afterContract, beforeContract);checks += 1;
  assert.deepEqual(await readMatrix(), beforeReads);checks += Object.keys(beforeReads).length;
  assert.deepEqual(await writeMatrix(), beforeWrites);checks += Object.keys(beforeWrites).length;
  await db.exec('reset role');
  const properties = (await db.query(`select proname,prosecdef,provolatile,pronargs,proconfig,
    has_function_privilege('anon',p.oid,'execute')anon_execute,
    has_function_privilege('authenticated',p.oid,'execute')authenticated_execute,
    exists(select 1 from aclexplode(p.proacl)where grantee=0)public_execute
    from pg_proc p where p.oid in('private.attendance_admin_organization_ids()'::regprocedure,'private.attendance_readable_class_ids()'::regprocedure)`)).rows;
  assert.equal(properties.length, 2);
  for (const value of properties) {
    assert.equal(value.prosecdef, true);assert.equal(value.provolatile, 's');assert.equal(value.pronargs, 0);
    assert.equal(value.anon_execute, false);assert.equal(value.public_execute, false);assert.equal(value.authenticated_execute, true);
    assert.ok(value.proconfig.some(config => config.startsWith('search_path=')));
    assert.ok(!value.proconfig.some(config => config.startsWith('row_security=')));
  } checks += 2;
  await validateMonthlyAttendanceSummary(db, { actors, org, otherOrg, orphanOrg, asUser });
  // There is no TTL/session cache: the very next statement on the same
  // connection must observe a canonical membership/assignment revocation.
  await asUser(actors.assigned);assert.equal((await rowsAndCount()).count, 1);
  await db.exec(`reset role;delete from public.class_staff where user_id='${actors.assigned}';delete from public.organization_members where user_id='${actors.assigned}';`);
  await asUser(actors.assigned);assert.equal((await rowsAndCount()).count, 0);checks += 1;
  await asUser(actors.admin);assert.ok((await rowsAndCount()).rows.some(row => row.id === 'orphan-org'));
  await db.exec(`reset role;delete from public.organization_members where user_id='${actors.admin}'and organization_id='${orphanOrg}';`);
  await asUser(actors.admin);assert.ok(!(await rowsAndCount()).rows.some(row => row.id === 'orphan-org'));checks += 1;
  await asUser(actors.substitute);assert.equal((await rowsAndCount()).count, 1);
  await db.exec("reset role;update public.class_staff_substitutions set ends_on=current_date-1 where id='active'");
  await asUser(actors.substitute);assert.equal((await rowsAndCount()).count, 0);checks += 1;
  console.log(JSON.stringify({ suite: 'attendance-read-scopes-sql', status: 'passed', checks, actorCases: Object.keys(beforeReads).length, writeActors: Object.keys(beforeWrites).length, method: 'Isolated PGlite; exact rows/all fields/order/COUNT/WRITE/RLS/grants equality plus same-connection revocation and unknown-policy guard' }));
} finally { await db.close(); }
