import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL in memory, real migration/function/policy source, synthetic
// users only. No remote service or application database is opened.
const db = new PGlite();
const migration = (name) => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const functionSql = (source, name) => {
  const start = source.indexOf(`create or replace function ${name}(`);
  assert.ok(start >= 0, `missing function ${name}`);
  return source.slice(start, source.indexOf('$$;', start) + 3);
};
const orgA = '20000000-0000-0000-0000-000000000001';
const orgB = '20000000-0000-0000-0000-000000000002';
const admin = '10000000-0000-0000-0000-000000000001';
const trainer = '10000000-0000-0000-0000-000000000002';
const outsider = '10000000-0000-0000-0000-000000000003';
const asUser = async (user) => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
  await db.exec('set role authenticated');
};
const row = (id, studentid, note = '') => ({ id, studentid, classid: 'class-A', organization_id: orgA,
  date: '2026-09-05', status: 'presente', pain_score: 0, note, createdat: '2026-09-05T12:00:00Z' });
const replace = (records, org = orgA, classId = 'class-A') => db.query(
  'select * from public.replace_attendance_records($1, $2, $3, $4::jsonb)', [org, classId, '2026-09-05', JSON.stringify(records)]);
const snapshot = async () => (await db.query('select id, studentid, status, note from attendance_logs order by id')).rows;
let checks = 0;
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${admin}'), ('${trainer}'), ('${outsider}');
    create table organizations(id uuid primary key);
    insert into organizations values ('${orgA}'), ('${orgB}');
    create table organization_members(organization_id uuid, user_id uuid, role_level integer);
    insert into organization_members values ('${orgA}', '${admin}', 50), ('${orgB}', '${admin}', 50), ('${orgA}', '${trainer}', 10);
    create table classes(id text primary key, organization_id uuid, owner_id uuid);
    insert into classes values ('class-A','${orgA}','${admin}'), ('class-B','${orgB}','${admin}');
    create table class_staff(class_id text, organization_id uuid, user_id uuid);
    insert into class_staff values ('class-A', '${orgA}', '${trainer}');
    create table students(id text primary key, organization_id uuid, classid text);
    insert into students values ('s1','${orgA}','class-A'), ('s2','${orgA}','class-A'), ('foreign','${orgB}','class-B');
    create table student_class_enrollments(student_id text, organization_id uuid, class_id text, status text);
  `);
  const baseSchema = await migration('2026010601_create_scouting_logs.sql');
  await db.exec(baseSchema.match(/create table if not exists public\.attendance_logs \([\s\S]*?\n\);/)[0]);
  await db.exec(`alter table attendance_logs add column organization_id uuid not null references organizations(id);
    alter table attendance_logs add column created_by uuid references auth.users(id),
      add column updated_by uuid references auth.users(id), add column updated_at timestamptz;`);
  await db.exec(functionSql(await migration('2026021002_fix_org_member_policies.sql'), 'public.is_org_admin'));
  await db.exec(functionSql(await migration('20260825211521_harden_invite_revocation_and_member_removal.sql'), 'public.is_class_staff'));
  const classPolicies = await migration('2026021203_update_rls_classes_by_staff.sql');
  await db.exec(classPolicies.slice(0, classPolicies.indexOf('drop policy if exists "classes insert trainer"')));
  const rowPolicies = await migration('2026021204_update_rls_class_scoped_entities_by_staff.sql');
  await db.exec(rowPolicies.slice(0, rowPolicies.indexOf('alter table public.session_logs')));
  await db.exec(functionSql(await migration('2026021401_add_audit_fields.sql'), 'public.set_audit_fields'));
  await db.exec(`create trigger attendance_logs_audit before insert or update on attendance_logs
    for each row execute function public.set_audit_fields();
    grant usage on schema public, auth to authenticated, anon;
    grant select, insert, update, delete on all tables in schema public to authenticated;`);
  await db.exec(await migration('20260905173905_replace_attendance_records_atomically.sql'));

  await db.exec('set role anon');
  await assert.rejects(replace([]), /permission denied/); checks += 1;
  await asUser(outsider);
  await assert.rejects(replace([]), /Attendance access denied/); checks += 1;
  await asUser(admin);
  const records = [row('r1', 's1', 'original'), row('r2', 's2')];
  assert.equal((await replace(records)).rows[0].saved_count, 2); checks += 1;
  await replace(records);
  assert.equal((await snapshot()).length, 2); checks += 1;
  assert.equal((await db.query('select created_by from attendance_logs limit 1')).rows[0].created_by, admin); checks += 1;
  const before = await snapshot();
  await assert.rejects(replace([{ ...row('r1', 's1'), organization_id: orgB }]), /Invalid attendance/);
  assert.deepEqual(await snapshot(), before); checks += 1;
  await assert.rejects(replace([row('r1', 'foreign')]), /Invalid attendance/);
  assert.deepEqual(await snapshot(), before); checks += 1;
  await assert.rejects(replace([row('r1', 's1'), row('r3', 's1')]), /Invalid attendance/);
  assert.deepEqual(await snapshot(), before); checks += 1;
  await assert.rejects(replace([], orgB, 'class-A'), /Attendance access denied/); checks += 1;
  await assert.rejects(replace([{ ...row('r1', 'foreign'), organization_id: orgB, classid: 'class-B' }], orgB, 'class-B'), /identifier belongs to another scope/);
  assert.deepEqual(await snapshot(), before); checks += 1;

  // A real failing database constraint must roll back the full operation.
  await db.exec("reset role; alter table attendance_logs add constraint synthetic_note_failure check (note <> 'constraint-failure');");
  await asUser(admin);
  await assert.rejects(replace([row('r1', 's1', 'would-change'), row('r2', 's2', 'constraint-failure')]), /synthetic_note_failure/);
  assert.deepEqual(await snapshot(), before); checks += 1;

  await asUser(trainer);
  await replace([row('r1', 's1', 'trainer-update'), row('r2', 's2')]);
  assert.equal((await snapshot())[0].note, 'trainer-update'); checks += 1;
  const trainerBefore = await snapshot();
  // Existing policies allow staff updates but reserve deletion to org admins.
  // A silently denied DELETE must roll back earlier updates and report failure.
  await assert.rejects(replace([row('r1', 's1', 'must-rollback')]), /not authorized in full/);
  assert.deepEqual(await snapshot(), trainerBefore); checks += 1;
  await db.exec(`reset role; delete from organization_members where user_id = '${trainer}';`);
  await asUser(trainer);
  await assert.rejects(replace(records), /Attendance access denied/); checks += 1;
  await asUser(admin);
  assert.equal((await replace([])).rows[0].saved_count, 0);
  assert.deepEqual(await snapshot(), []); checks += 1;
  console.log(JSON.stringify({ suite: 'attendance-atomic-sql', checks, status: 'passed', runtime: 'isolated PGlite PostgreSQL' }));
} finally {
  await db.close();
}
