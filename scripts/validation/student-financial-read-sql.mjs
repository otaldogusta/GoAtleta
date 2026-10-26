import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// In-memory PostgreSQL only. This never contacts or modifies Supabase.
const db = new PGlite();
const org = '61000000-0024-4000-8000-000000000100';
const otherOrg = '61000000-0024-4000-8000-000000000200';
const actors = Object.fromEntries(['admin', 'financialStaff', 'noFinance', 'defaultStaff', 'foreign', 'self', 'family']
  .map((name, i) => [name, `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`]));
const readMigration = name => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const migration = await readMigration('20261025123000_student_financial_statuses_read_rpc.sql');
const permissionSource = await readMigration('20261022161413_class_creation_permissions.sql');
const financialSource = await readMigration('20260825222458_protect_student_financial_status.sql');
const familySource = await readMigration('20260831005113_family_access_foundation.sql');
function extractFunction(source, name) {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('$$;', start) + 3);
}
let checks = 0;
const asUser = async (actor, role = 'authenticated') => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? '']);
  await db.exec(`set role ${role}`);
};
const call = async (organization = org, ids = []) =>
  (await db.query('select public.get_student_financial_statuses_v1($1::uuid,$2::text[]) as value', [organization, ids])).rows[0].value;
const direct = async (organization, ids) => (await db.query(`select student_id,status from public.student_financial_statuses
  where organization_id=$1 and student_id=any($2::text[]) order by student_id`, [organization, ids])).rows;
const tableContract = async () => {
  await db.exec('reset role');
  return (await db.query(`select jsonb_build_object(
    'relations',(select jsonb_agg(to_jsonb(t) order by relname) from
      (select relname,relacl::text,relrowsecurity,relforcerowsecurity from pg_class
       where oid in('public.students'::regclass,'public.student_financial_statuses'::regclass))t),
    'policies',(select jsonb_agg(to_jsonb(t) order by tablename,policyname) from
      (select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public')t),
    'helpers',(select jsonb_agg(to_jsonb(t) order by proname) from
      (select proname,proacl::text,prosecdef,provolatile,proconfig,pg_get_functiondef(oid)definition from pg_proc
       where oid in('public.has_org_member_permission(uuid,text)'::regprocedure,
       'public.default_member_permission(integer,text)'::regprocedure,
       'public.has_student_relationship(uuid,text,text)'::regprocedure))t)
  ) as value`)).rows[0].value;
};
try {
  await db.exec(`
    create role authenticated;create role anon;create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon;
    create table auth.users(id uuid primary key);
    create table public.organizations(id uuid primary key);
    create table public.students(id text primary key,organization_id uuid not null,student_user_id uuid,financial_status text default 'unknown');
    create table public.organization_members(organization_id uuid,user_id uuid,role_level int,primary key(organization_id,user_id));
    create table public.organization_member_permissions(organization_id uuid,user_id uuid,permission_key text,is_allowed boolean,
      primary key(organization_id,user_id,permission_key));
    create table public.student_relationships(organization_id uuid,student_id text,user_id uuid,status text,
      can_view_profile boolean,can_view_schedule boolean,can_view_attendance boolean,can_view_progress boolean,
      can_view_health boolean,can_sign_consents boolean,can_view_financial boolean,can_pay boolean);
  `);
  await db.exec(extractFunction(permissionSource, 'default_member_permission'));
  await db.exec(extractFunction(permissionSource, 'has_org_member_permission'));
  await db.exec(extractFunction(familySource, 'has_student_relationship'));
  const tableEnd = financialSource.indexOf('-- Capture the current source of truth');
  assert.ok(tableEnd > 0);
  await db.exec(financialSource.slice(0, tableEnd));
  await db.query('insert into public.organizations values($1),($2)', [org, otherOrg]);
  for (const actor of Object.values(actors)) await db.query('insert into auth.users values($1)', [actor]);
  for (const [name, level] of [['admin', 50], ['financialStaff', 10], ['noFinance', 10], ['defaultStaff', 10], ['foreign', 50]]) {
    await db.query('insert into public.organization_members values($1,$2,$3)', [name === 'foreign' ? otherOrg : org, actors[name], level]);
  }
  for (const [name, allowed] of [['admin', false], ['financialStaff', true], ['noFinance', false]]) {
    await db.query("insert into public.organization_member_permissions values($1,$2,'financial',$3)", [org, actors[name], allowed]);
  }
  await db.query(`insert into public.students(id,organization_id)
    select 'student-'||lpad(value::text,5,'0'),$1 from generate_series(1,5000)value`, [org]);
  await db.query(`insert into public.students values('foreign-student',$1,null),('no-status',$2,null)`, [otherOrg, org]);
  await db.query(`update public.students set student_user_id=$1 where id='student-00001'`, [actors.self]);
  await db.query(`insert into public.student_financial_statuses(student_id,organization_id,status)
    select id,organization_id,(array['regular','delinquent','exempt','pending','unknown'])[1+(row_number()over(order by id)%5)::int]
    from public.students where id<>'no-status'`);
  await db.query(`insert into public.student_relationships(organization_id,student_id,user_id,status,can_view_financial)
    values($1,'student-00001',$2,'active',true)`, [org, actors.family]);
  const ids = Array.from({ length: 5000 }, (_, i) => `student-${String(i + 1).padStart(5, '0')}`);
  const before = await tableContract();
  await db.exec(migration);
  await assert.rejects(() => db.exec(migration), error => error.code === '42723'); checks++;
  const properties = (await db.query(`select prosecdef,provolatile,proconfig,prorettype::regtype::text return_type,
    has_function_privilege('authenticated',oid,'execute') auth,
    has_function_privilege('anon',oid,'execute') anon,
    exists(select 1 from aclexplode(proacl) where grantee=0) public
    from pg_proc where oid='public.get_student_financial_statuses_v1(uuid,text[])'::regprocedure`)).rows[0];
  assert.equal(properties.prosecdef, false); assert.equal(properties.provolatile, 's');
  assert.equal(properties.return_type, 'jsonb'); assert.ok(properties.proconfig.includes('search_path=""'));
  assert.equal(properties.auth, true); assert.equal(properties.anon, false); assert.equal(properties.public, false); checks += 7;
  for (const actor of Object.values(actors)) {
    await asUser(actor);
    for (const [organization, requested] of [[org, ids], [otherOrg, ['foreign-student', ids[0]]]]) {
      assert.deepEqual(await call(organization, requested), await direct(organization, requested)); checks++;
    }
  }
  await asUser(actors.admin);
  const large = await call(org, ids);
  assert.equal(large.length, 5000); assert.deepEqual(Object.keys(large[0]).sort(), ['status', 'student_id']); checks += 2;
  // One SQL scalar row contains every item, independent of a 1,000-row consumer cap.
  const scalar = await db.query('select public.get_student_financial_statuses_v1($1,$2::text[]) as value limit 1000', [org, ids]);
  assert.equal(scalar.rows.length, 1); assert.equal(scalar.rows[0].value.length, 5000); checks += 2;
  assert.deepEqual(await call(org, [ids[0], ids[0], 'no-status', 'foreign-student', 'missing']), await direct(org, [ids[0]])); checks++;
  assert.deepEqual(await call(org, []), []); checks++;
  await asUser(actors.family);
  assert.equal((await db.query("select public.has_student_relationship($1,'student-00001','financial') allowed", [org])).rows[0].allowed, true);
  assert.deepEqual(await call(org, [ids[0]]), []); checks += 2;
  await asUser(''); assert.deepEqual(await call(org, ids), []); checks++;
  await asUser('', 'anon'); await assert.rejects(() => call(org, ids), error => error.code === '42501'); checks++;
  await asUser(actors.admin);
  for (const args of [[null, ids], [org, null], [org, ['']], [org, [null]], [org, Array(5001).fill(ids[0])]]) {
    await assert.rejects(() => call(...args), error => error.code === '22023'); checks++;
  }
  await assert.rejects(() => db.query(`select public.get_student_financial_statuses_v1($1,array[['a'],['b']]::text[])`, [org]), error => error.code === '22023'); checks++;
  assert.deepEqual(await tableContract(), before); checks++;
  // Revocation is read on the next statement, without a permission TTL.
  await db.query("update public.organization_member_permissions set is_allowed=false where user_id=$1", [actors.financialStaff]);
  await asUser(actors.financialStaff); assert.deepEqual(await call(org, ids), []); checks++;
  await db.exec('reset role');
  assert.equal(Number((await db.query('select count(*) total from public.student_financial_statuses')).rows[0].total), 5001); checks++;
  console.log(JSON.stringify({ suite: 'student-financial-read-rpc', checks, actors: Object.keys(actors).length,
    scalarItems: large.length, tableAndPolicyContractUnchanged: true, network: false }));
} catch (error) {
  console.error(JSON.stringify({ suite: 'student-financial-read-rpc', checks,
    code: error.code ?? null, message: error.message }));
  process.exitCode = 1;
} finally { await db.close(); }
