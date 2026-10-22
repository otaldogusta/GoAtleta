import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Synthetic pre-existing cross-domain tables. Permission RPCs, claims, policies
// and creation triggers execute the actual migration, never a remote database.
const db = new PGlite();
const org = '20000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';
const teacher = '10000000-0000-4000-8000-000000000001';
const admin = '10000000-0000-4000-8000-000000000002';
const owner = '10000000-0000-4000-8000-000000000003';
const invited = '10000000-0000-4000-8000-000000000004';
const legacy = '10000000-0000-4000-8000-000000000005';
const migration = name => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const query = (sql, args = []) => db.query(sql, args);
const scalar = async (sql, args = []) => (await query(sql, args)).rows[0].value;
const asUser = async (id, role = 'authenticated') => {
  await db.exec(`reset role; set role ${role}`);
  await query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
};
const insert = (id, organization = org, fields = '') => query(
  `insert into public.classes(id, organization_id${fields ? ', user_id, tenant_id' : ''})
   values ($1, $2${fields ? `, '${teacher}', '${org}'` : ''})`, [id, organization]);

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function public.app_tenant_id() returns uuid language sql stable as $$ select '${org}'::uuid $$;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create table public.organizations(id uuid primary key, name text);
    create table public.organization_members(organization_id uuid references organizations, user_id uuid references auth.users,
      role_level int, primary key(organization_id, user_id));
    create table public.organization_member_permissions(organization_id uuid, user_id uuid, permission_key text,
      is_allowed boolean, updated_at timestamptz, updated_by uuid, primary key(organization_id,user_id,permission_key),
      foreign key(organization_id,user_id) references organization_members);
    create table public.classes(id text primary key, organization_id uuid references organizations, owner_id uuid default auth.uid(),
      user_id uuid, tenant_id uuid, name text default 'Teste', unit text);
    create table public.class_staff(organization_id uuid, class_id text references classes, user_id uuid references auth.users,
      staff_role text, primary key(class_id,user_id));
    create table public.class_staff_tenures(id uuid primary key default gen_random_uuid(), organization_id uuid,
      class_id text references classes, user_id uuid, display_name_snapshot text, staff_role text, status text,
      starts_on date, date_precision text, created_by uuid);
    create table public.class_staff_versions(organization_id uuid, class_id text references classes, version bigint,
      primary key(organization_id,class_id));
    create table public.notifications(id uuid primary key default gen_random_uuid(), organization_id uuid,
      recipient_user_id uuid, actor_user_id uuid, type text, title text, body text, action_url text,
      source_type text, source_id text, metadata jsonb);
    create table public.trainers(user_id uuid primary key references auth.users);
    create table public.trainer_invites(id uuid primary key default gen_random_uuid(), code_hash text, organization_id uuid,
      created_by uuid, expires_at timestamptz, max_uses int default 1, uses int default 0, revoked boolean default false,
      claimed_by uuid, claimed_at timestamptz, target_role_level int, invited_via text, invited_to text,
      initial_permissions jsonb, delivery_status text);
    create table public.invite_staff_calls(invite_id uuid, user_id uuid);
    create function public.apply_trainer_invite_staff(p_invite_id uuid,p_user_id uuid)
      returns void language sql as $$ insert into public.invite_staff_calls values(p_invite_id,p_user_id) $$;
    create function public.is_org_admin(p_org_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
      select exists(select 1 from public.organization_members where organization_id = p_org_id and user_id = auth.uid() and role_level >= 50)
    $$;
    create function public.is_org_member(p_org_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
      select exists(select 1 from public.organization_members where organization_id = p_org_id and user_id = auth.uid())
    $$;
    -- Class assignment/role change are cross-domain dependencies of the existing
    -- access RPC; these fixtures do not authorize or mutate permission rows.
    create function public.admin_set_member_class_heads(p_org_id uuid,p_user_id uuid,p_class_ids text[])
      returns void language sql as $$ select $$;
    create function public.admin_update_member_role(p_org_id uuid,p_user_id uuid,p_role_level int)
      returns void language sql as $$ update public.organization_members set role_level=p_role_level
        where organization_id=p_org_id and user_id=p_user_id $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant select on public.organization_members to authenticated;
    grant select, insert, update, delete on public.organization_member_permissions, public.class_staff to authenticated;
    grant select, insert, update on public.classes to authenticated;
    alter table public.classes enable row level security;
    alter table public.organization_member_permissions enable row level security;
    alter table public.class_staff enable row level security;
    create policy staff_read on public.class_staff for select to authenticated
      using(public.is_org_member(organization_id));
    create policy staff_admin on public.class_staff for all to authenticated
      using(public.is_org_admin(organization_id)) with check(public.is_org_admin(organization_id));
    create policy permissions_read on public.organization_member_permissions for select to authenticated
      using(user_id=auth.uid() or public.is_org_admin(organization_id));
    create policy permissions_admin on public.organization_member_permissions for all to authenticated
      using(public.is_org_admin(organization_id)) with check(public.is_org_admin(organization_id));
    create policy classes_read on public.classes for select to authenticated
      using(public.is_org_admin(organization_id) or (owner_id=auth.uid() and public.is_org_member(organization_id)));
    -- Reproduce the hosted legacy branch: it must not bypass explicit permission.
    create policy authenticated_fd920a729e_insert on public.classes for insert to authenticated
      with check(public.is_org_admin(organization_id) or (tenant_id=public.app_tenant_id() and user_id=auth.uid()));
    create policy legacy_update on public.classes for update to authenticated
      using(public.is_org_admin(organization_id) or owner_id=auth.uid())
      with check(public.is_org_admin(organization_id) or owner_id=auth.uid());
    insert into public.organizations values('${org}','Instituição A'),('${other}','Instituição B');
    insert into auth.users(id,email) values('${teacher}','teacher@example.test'),('${admin}','admin@example.test'),
      ('${owner}','owner@example.test'),('${invited}','invite@example.test'),('${legacy}','legacy@example.test');
    insert into public.organization_members values('${org}','${teacher}',10),('${org}','${admin}',50),('${org}','${owner}',100);
  `);
  const receipts = await migration('20260729154736_apply_member_access_change_atomically.sql');
  await db.exec(receipts.slice(0, receipts.indexOf('create or replace function')));
  const claimSource = await migration('20260825212548_include_financial_permission_in_trainer_invites.sql');
  // Preserve the real claim plus the extra staff hook observed in the hosted DB.
  // The hook's implementation is a fixture; the permission migration must retain it.
  await db.exec(claimSource.replace('\n  update public.trainer_invites invite', '\n  perform public.apply_trainer_invite_staff(p_invite_id, p_user_id);\n\n  update public.trainer_invites invite'));
  await db.exec(await migration('20261022161413_class_creation_permissions.sql'));
  await asUser(teacher);
  assert.equal(await scalar("select public.can_create_class($1) as value", [org]), false);
  assert.equal(await scalar("select is_allowed as value from public.get_my_member_permissions($1) where permission_key='classes_create'", [org]), false);
  await assert.rejects(() => insert('denied-default'), /row-level security/);
  await assert.rejects(() => insert('denied-legacy', org, 'legacy'), /row-level security/);
  await assert.rejects(() => query("select public.admin_set_member_permission($1,$2,'classes_create',true)", [org,teacher]), /Not authorized/);
  await assert.rejects(() => query("insert into public.organization_member_permissions values($1,$2,'classes_create',true,now(),$2)", [org,teacher]), /row-level security/);
  await assert.rejects(() => query('select * from public.admin_apply_member_access_change_v2($1,$2,10,ARRAY[]::text[],ARRAY[\'classes\',\'classes_create\'],$3)', [org,teacher,'30000000-0000-4000-8000-000000000099']), /Not authorized/);

  await asUser(admin);
  assert.equal(await scalar("select public.can_create_class($1) as value", [org]), true);
  await insert('admin-class');
  await assert.rejects(() => query("select public.admin_set_member_permission($1,$2,'classes_create',true)", [other,teacher]), /Not authorized/);
  const keys = ['classes','classes_create'];
  const apply = (requestId, permissionKeys) => query(
    'select * from public.admin_apply_member_access_change_v2($1,$2,10,ARRAY[]::text[],$3,$4)', [org,teacher,permissionKeys,requestId]);
  const grantReceipt = '30000000-0000-4000-8000-000000000001';
  await apply(grantReceipt, keys);
  await apply(grantReceipt, keys); // receipt replay retains the explicit grant
  assert.equal(await scalar("select is_allowed as value from public.admin_list_member_permissions($1,$2) where permission_key='classes_create'", [org,teacher]), true);

  await asUser(teacher);
  await insert('allowed-class');
  await assert.rejects(() => query("insert into public.class_staff(organization_id,class_id,user_id,staff_role) values($1,'admin-class',$2,'head')",[org,teacher]), /row-level security/);
  assert.equal(await scalar("select count(*)::int as value from public.classes where id='allowed-class'"), 1);
  await assert.rejects(() => insert('other-org', other), /row-level security/);
  await assert.rejects(() => insert('other-org-legacy', other, 'legacy'), /row-level security/);
  await assert.rejects(() => query('insert into public.classes(id,organization_id,owner_id) values($1,$2,$3)', ['spoof-owner',org,admin]), /row-level security/);
  await assert.rejects(() => query("update public.classes set organization_id=$1 where id='allowed-class'", [other]), /Class scope and owner/);
  await assert.rejects(() => query("update public.classes set owner_id=$1 where id='allowed-class'", [admin]), /Class scope and owner/);
  await asUser(admin);
  await query("select public.admin_set_member_permission($1,$2,'classes',false)", [org,teacher]);
  await asUser(teacher);
  await assert.rejects(() => insert('no-area-access'), /row-level security/);
  await asUser(admin);
  await query("select public.admin_set_member_permission($1,$2,'classes',true)", [org,teacher]);
  await apply('30000000-0000-4000-8000-000000000002', ['classes']);
  await asUser(teacher);
  await assert.rejects(() => insert('revoked'), /row-level security/);
  assert.equal(await scalar("select count(*)::int as value from public.classes where id='allowed-class'"), 1);

  await asUser(owner);
  await insert('owner-class');
  await asUser(admin);
  const invite = (hash, permissions) => query("select * from public.create_trainer_invite_access($1,$2,10,'link',null,$3::jsonb)", [org,hash.repeat(64),JSON.stringify(permissions)]);
  const initial = (await invite('a', ['classes','classes_create'])).rows[0].invite_id;
  const old = (await invite('b', ['classes'])).rows[0].invite_id;
  await assert.rejects(() => query('select public.claim_trainer_invite_access($1,$2)', [initial,invited]), /permission denied/);
  await asUser(admin, 'service_role');
  await query('select public.claim_trainer_invite_access($1,$2)', [initial,invited]);
  await query('select public.claim_trainer_invite_access($1,$2)', [old,legacy]);
  await asUser(invited);
  await insert('invited-class');
  await asUser(legacy);
  await assert.rejects(() => insert('old-invite-denied'), /row-level security/);
  await asUser(null);
  await assert.rejects(() => insert('no-session'), /row-level security/);
  await asUser(null, 'anon');
  await assert.rejects(() => insert('anonymous'), /permission denied/);
  await assert.rejects(() => query('select public.can_create_class($1)',[org]), /permission denied/);
  await db.exec('reset role');
  assert.equal(await scalar('select count(*)::int as value from public.invite_staff_calls'),2);
  assert.equal(await scalar("select has_function_privilege('authenticated','private.initialize_created_class_staff()','EXECUTE') as value"),false);
  assert.equal(await scalar("select has_function_privilege('anon','public.admin_set_member_permission(uuid,uuid,text,boolean)','EXECUTE') as value"),false);
  assert.equal(await scalar("select count(*)::int as value from public.class_staff where class_id='allowed-class' and user_id=$1 and staff_role='head'",[teacher]),1);
  assert.equal(await scalar("select count(*)::int as value from public.class_staff_tenures where class_id='allowed-class' and user_id=$1 and staff_role='head'",[teacher]),1);
  assert.equal(await scalar("select version::int as value from public.class_staff_versions where class_id='allowed-class'"),1);
  assert.equal(await scalar("select count(*)::int as value from public.class_staff where class_id in ('admin-class','owner-class')"),0);
  assert.equal(await scalar("select count(*)::int as value from public.classes where id in ('denied-default','denied-legacy','other-org','other-org-legacy','spoof-owner','revoked','old-invite-denied','anonymous','no-session')"),0);
  console.log('Class creation SQL passed: default deny, administrative grant/revoke and replay, invite opt-in, legacy-policy bypass blocked, org/owner isolation, creator staff/history, anonymous denial.');
} finally {
  await db.close();
}
