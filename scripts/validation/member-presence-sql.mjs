import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const org = '20000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';
const admin = '10000000-0000-4000-8000-000000000001';
const teacher = '10000000-0000-4000-8000-000000000002';
const outsider = '10000000-0000-4000-8000-000000000003';
const asUser = async (id, role = 'authenticated') => {
  await db.exec(`reset role; set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
};
const status = async (organization, user) => (await db.query('select * from public.get_org_member_presence($1,$2)', [organization,user])).rows[0]?.status;
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key);
    create table public.organizations(id uuid primary key);
    create table public.organization_members(organization_id uuid,user_id uuid,role_level int,primary key(organization_id,user_id));
    create function public.is_org_admin(org uuid) returns boolean language sql stable security definer set search_path='' as $$
      select exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid() and role_level>=50)
    $$;
    insert into auth.users values('${admin}'),('${teacher}'),('${outsider}');
    insert into public.organizations values('${org}'),('${other}');
    insert into public.organization_members values('${org}','${admin}',50),('${org}','${teacher}',10),('${other}','${outsider}',50);
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261022214444_org_member_presence.sql', import.meta.url),'utf8'));
  await asUser(admin);
  assert.equal(await status(org,teacher),'unknown');
  await asUser(teacher);
  await db.query('select public.touch_my_org_presence($1)',[org]);
  await assert.rejects(db.query('select public.touch_my_org_presence($1)',[other]),/Not authorized/);
  assert.equal(await status(org,teacher),'online');
  assert.equal(await status(other,teacher),undefined);
  await assert.rejects(status(org,admin),/Not authorized/);
  await assert.rejects(db.query('select * from private.org_member_presence'),/permission denied/);
  await asUser(admin);
  assert.equal(await status(org,teacher),'online');
  assert.equal(await status(org,outsider),undefined);
  await assert.rejects(status(other,outsider),/Not authorized/);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select user_id from private.org_member_presence')).rows,[{user_id:teacher}]);
  await db.exec("update private.org_member_presence set last_seen_at=clock_timestamp()-interval '76 seconds'");
  await asUser(admin);
  assert.equal(await status(org,teacher),'offline');
  await asUser(teacher);
  await db.query('select public.touch_my_org_presence($1)',[org]);
  await asUser(admin);
  assert.equal(await status(org,teacher),'online');
  await asUser(null);
  await assert.rejects(db.query('select public.touch_my_org_presence($1)',[org]),/Not authorized/);
  await asUser(null,'anon');
  await assert.rejects(status(org,teacher),/permission denied/);
  await assert.rejects(db.query('select public.touch_my_org_presence($1)',[org]),/permission denied/);
  console.log('Member presence SQL passed: authentic actor, unknown/online/offline, organization boundaries and direct/anonymous denial.');
} finally { await db.close(); }
