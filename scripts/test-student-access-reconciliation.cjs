// Isolated PostgreSQL (PGlite), never connects to Supabase or reads credentials.
// Run: node scripts/test-student-access-reconciliation.cjs <pglite module path>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite');
const uid = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const org = '33333333-3333-4333-8333-333333333333';
const db = new PGlite();
let passed = 0;

async function reset() {
  await db.exec(`reset role;
    truncate public.student_relationships, public.student_relationship_invites, public.student_invites, public.students, auth.users;
    insert into auth.users (id,email,email_confirmed_at,raw_app_meta_data) values
      ('${uid}','student@example.test',now(),'{"email_verified_hybrid_at":"2026-09-03T20:00:00Z"}'),
      ('${other}','other@example.test',now(),'{"provider":"google"}');
    insert into public.students(id,organization_id,login_email,membership_status)
      values ('student-1','${org}',' STUDENT@example.test ','active');
    select set_config('request.jwt.claim.sub','${uid}',false), set_config('request.jwt.claim.role','authenticated',false);`);
}
async function claim() {
  await db.exec('set role authenticated');
  try { return (await db.query('select public.reconcile_my_student_access_v1() as status')).rows[0].status; }
  finally { await db.exec('reset role'); }
}
async function test(name, run) {
  await reset();
  await run();
  passed++;
  console.log(`PASS ${name}`);
}

(async () => {
  // Minimal dependencies: real PostgreSQL roles, RLS, PL/pgSQL and actual migration.
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
    grant usage on schema auth to authenticated, service_role;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',is_anonymous boolean default false,deleted_at timestamptz,banned_until timestamptz);
    create table public.students(id text primary key,organization_id uuid,login_email text,student_user_id uuid,membership_status text);
    create table public.student_relationships(organization_id uuid,student_id text,user_id uuid,contact_email text,relationship_kind text,status text);
    create table public.student_invites(organization_id uuid,student_id text,revoked boolean default false);
    create table public.student_relationship_invites(organization_id uuid,student_id text,invited_email text,relationship_kind text,revoked_at timestamptz);
    alter table public.students enable row level security;
    create policy self_read on public.students for select to authenticated using(student_user_id=auth.uid());
    grant select on public.students to authenticated;`);
  await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260904004732_reconcile_verified_student_access.sql'), 'utf8'));

  await test('verified email links exactly one pre-registration, no extra relationship grants', async () => {
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.students')).rows.length, 0);
    await db.exec('reset role');
    assert.equal(await claim(), 'linked');
    assert.equal(await claim(), 'already_linked');
    assert.equal((await db.query('select student_user_id from public.students')).rows[0].student_user_id, uid);
    assert.equal((await db.query('select * from public.student_relationships')).rows.length, 0);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.students')).rows.length, 1);
    await db.exec('reset role');
  });
  await test('signup then email verification retries successfully', async () => {
    await db.exec("update auth.users set raw_app_meta_data='{}',email_confirmed_at=null");
    assert.equal(await claim(), 'verification_required');
    await db.exec(`update auth.users set email_confirmed_at=now(),raw_app_meta_data='{"email_verified_hybrid_at":"verified"}' where id='${uid}'`);
    assert.equal(await claim(), 'linked');
  });
  await test('user metadata cannot supply email proof', async () => {
    await db.exec(`update auth.users set raw_app_meta_data='{}',raw_user_meta_data='{"email_verified_hybrid_at":"forged","provider":"google"}'`);
    assert.equal(await claim(), 'verification_required');
  });
  await test('confirmed timestamp alone does not bypass hybrid verification', async () => {
    await db.exec("update auth.users set raw_app_meta_data='{}'");
    assert.equal(await claim(), 'verification_required');
  });
  await test('trusted OAuth provider is accepted', async () => {
    await db.exec(`update auth.users set raw_app_meta_data='{"providers":["google"]}'`);
    assert.equal(await claim(), 'linked');
  });
  await test('missing confirmation still blocks OAuth proof', async () => {
    await db.exec("update auth.users set email_confirmed_at=null,raw_app_meta_data='{\"provider\":\"google\"}'");
    assert.equal(await claim(), 'verification_required');
  });
  for (const [name, sql] of [
    ['anonymous account', 'is_anonymous=true'], ['banned account', "banned_until=now()+interval '1 day'"], ['deleted account','deleted_at=now()'],
  ]) await test(name, async () => {
    await db.exec(`update auth.users set ${sql}`);
    assert.equal(await claim(), 'review_required');
  });
  await test('unmatched account remains new', async () => {
    await db.exec("update public.students set login_email='different@example.test'");
    assert.equal(await claim(), 'not_found');
  });
  await test('same email across organizations is ambiguous', async () => {
    await db.exec(`insert into public.students values ('student-2','${other}','student@example.test',null,'active',null)`);
    assert.equal(await claim(), 'review_required');
    assert.equal((await db.query('select * from public.students where student_user_id is not null')).rows.length, 0);
  });
  await test('same email for siblings is ambiguous', async () => {
    await db.exec(`insert into public.students values ('student-2','${org}','student@example.test',null,'active',null)`);
    assert.equal(await claim(), 'review_required');
  });
  await test('another linked user is never overwritten', async () => {
    await db.exec(`update public.students set student_user_id='${other}'`);
    assert.equal(await claim(), 'review_required');
  });
  await test('inactive membership and missing organization are not claimed', async () => {
    await db.exec("update public.students set membership_status='inactive'");
    assert.equal(await claim(), 'review_required');
    await db.exec("update public.students set membership_status='active',organization_id=null");
    assert.equal(await claim(), 'review_required');
  });
  for (const kind of ['athlete','guardian','payer']) await test(`${kind} relationship is not replaced`, async () => {
    await db.exec(`insert into public.student_relationships values ('${org}','student-1','${uid}','student@example.test','${kind}','revoked')`);
    assert.equal(await claim(), 'review_required');
  });
  await test('active guardian remains a guardian', async () => {
    await db.exec(`insert into public.student_relationships values ('${org}','student-1','${uid}','student@example.test','guardian','active')`);
    assert.equal(await claim(), 'review_required');
  });
  await test('legacy and relationship invitation history takes precedence', async () => {
    await db.exec(`insert into public.student_invites values ('${org}','student-1',true)`);
    assert.equal(await claim(), 'invite_required');
    await db.exec(`truncate public.student_invites; insert into public.student_relationship_invites values ('${org}','student-1','student@example.test','athlete',now())`);
    assert.equal(await claim(), 'invite_required');
  });
  await test('guardian invite for another person does not block self access', async () => {
    await db.exec(`insert into public.student_relationship_invites values ('${org}','student-1','parent@example.test','guardian',null)`);
    assert.equal(await claim(), 'linked');
  });
  await test('revoked direct access is not restored, even if its marker is cleared', async () => {
    assert.equal(await claim(), 'linked');
    await db.exec('update public.students set student_user_id=null');
    await db.exec('update public.students set student_access_revoked_at=null');
    assert.equal(await claim(), 'review_required');
    // Explicit administrative/validated-invite writes still work.
    await db.exec(`update public.students set student_user_id='${uid}'`);
    assert.equal(await claim(), 'already_linked');
  });
  await test('authenticated user cannot reconcile someone else, or use service wrapper', async () => {
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select private.reconcile_student_access($1)',[other]), /NOT_AUTHORIZED/);
    await assert.rejects(db.query('select public.reconcile_student_access_for_user_v1($1)',[other]), /permission denied/);
    await db.exec('reset role');
  });
  await test('anonymous role cannot invoke either entry point', async () => {
    await db.exec('set role anon');
    await assert.rejects(db.query('select public.reconcile_my_student_access_v1()'), /permission denied/);
    await assert.rejects(db.query('select private.reconcile_student_access($1)',[uid]), /permission denied/);
    await db.exec('reset role');
  });
  await test('service webhook uses the same checks', async () => {
    await db.exec("select set_config('request.jwt.claim.role','service_role',false); set role service_role");
    assert.equal((await db.query('select public.reconcile_student_access_for_user_v1($1) as status',[uid])).rows[0].status,'linked');
    await db.exec('reset role');
  });
  await test('failed update rolls back, then retry links once', async () => {
    await db.exec('alter table public.students add constraint simulate_failure check(student_user_id is null)');
    await assert.rejects(claim(), /simulate_failure/);
    await db.exec('alter table public.students drop constraint simulate_failure');
    assert.equal(await claim(), 'linked');
  });
  // Minimal family schema and an organization permission boundary for the other
  // pending migration. No production identities or records enter this fixture.
  await db.exec(`alter table public.students add column name text, add column guardian_name text;
    alter table public.student_relationships add column id uuid default gen_random_uuid(),
      add column relationship_label text, add column claimed_at timestamptz default now(),
      add column can_view_profile boolean, add column can_view_schedule boolean,
      add column can_view_attendance boolean, add column can_view_progress boolean,
      add column can_view_health boolean, add column can_sign_consents boolean,
      add column can_view_financial boolean, add column can_pay boolean;
    alter table public.student_relationship_invites add column id uuid default gen_random_uuid(),
      add column relationship_label text, add column used_at timestamptz,
      add column expires_at timestamptz, add column created_at timestamptz default now();
    create function public.can_manage_student_invites(sid text, oid uuid) returns boolean
      language sql as $$ select auth.uid()='${uid}'::uuid and oid='${org}'::uuid $$;`);
  await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260903174500_update_student_family_relationship.sql'), 'utf8'));
  async function addFamily(kind = 'guardian', status = 'active') {
    await db.query(`insert into public.student_relationships
      (id,organization_id,student_id,user_id,contact_email,relationship_kind,status)
      values ($1,$2,'student-1',$3,'family@example.test',$4,$5)`, [other,org,other,kind,status]);
  }
  async function updateFamily(kind = 'payer') {
    return db.query(`select public.update_student_relationship_v1($1,$2,'Family',true,true,true,true,true,true,false,true)`, [other,kind]);
  }
  await test('family update retains identity, normalizes payment and blocks future scopes', async () => {
    await addFamily(); await db.exec('set role authenticated'); await updateFamily(); await db.exec('reset role');
    const r = (await db.query('select * from public.student_relationships')).rows[0];
    assert.equal(r.user_id, other); assert.equal(r.relationship_kind, 'payer');
    assert.equal(r.can_pay,true); assert.equal(r.can_view_financial,true);
    assert.equal(r.can_view_health,false); assert.equal(r.can_sign_consents,false);
  });
  await test('family writes reject another actor and organization', async () => {
    await addFamily();
    await db.exec(`select set_config('request.jwt.claim.sub','${other}',false); set role authenticated`);
    await assert.rejects(updateFamily(), /NOT_AUTHORIZED/); await db.exec('reset role');
    await db.exec(`select set_config('request.jwt.claim.sub','${uid}',false); update public.student_relationships set organization_id='${other}'; set role authenticated`);
    await assert.rejects(updateFamily(), /NOT_AUTHORIZED/); await db.exec('reset role');
  });
  await test('family edit cannot convert athlete or reactivate revoked access', async () => {
    await addFamily('athlete'); await db.exec('set role authenticated');
    await assert.rejects(updateFamily(), /ATHLETE_RELATIONSHIP_IMMUTABLE/); await db.exec('reset role');
    await db.exec("update public.student_relationships set relationship_kind='guardian'; set role authenticated");
    await assert.rejects(updateFamily('athlete'), /ATHLETE_RELATIONSHIP_IMMUTABLE/); await db.exec('reset role');
    await db.exec("update public.student_relationships set status='revoked'; set role authenticated");
    await assert.rejects(updateFamily(), /RELATIONSHIP_NOT_ACTIVE/); await db.exec('reset role');
  });
  await test('family summary is scoped and prioritizes active access over pending invitation', async () => {
    await addFamily();
    await db.exec(`insert into public.student_relationship_invites
      (organization_id,student_id,invited_email,relationship_kind,expires_at)
      values ('${org}','student-1','invite@example.test','guardian',now()+interval '1 day'); set role authenticated`);
    const rows = (await db.query('select * from public.list_student_family_access_summaries_v1($1)',[org])).rows;
    assert.equal(rows.length,1); assert.equal(rows[0].access_status,'active'); assert.equal(rows[0].contact_email,'family@example.test');
    assert.equal((await db.query('select * from public.list_student_family_access_summaries_v1($1)',[other])).rows.length,0);
    await db.exec('reset role');
    await db.exec(`select set_config('request.jwt.claim.sub','${other}',false); set role authenticated`);
    assert.equal((await db.query('select * from public.list_student_family_access_summaries_v1($1)',[org])).rows.length,0);
    await db.exec('reset role');
  });
  await test('family summary hides expired and revoked invitations', async () => {
    await db.exec(`insert into public.student_relationship_invites
      (organization_id,student_id,invited_email,relationship_kind,expires_at)
      values ('${org}','student-1','invite@example.test','guardian',now()+interval '1 day')`);
    const status = async () => {
      await db.exec('set role authenticated');
      try { return (await db.query('select * from public.list_student_family_access_summaries_v1($1)',[org])).rows[0].access_status; }
      finally { await db.exec('reset role'); }
    };
    assert.equal(await status(),'invited');
    await db.exec("update public.student_relationship_invites set expires_at=now()-interval '1 day'");
    assert.equal(await status(),'none');
    await db.exec("update public.student_relationship_invites set expires_at=now()+interval '1 day',revoked_at=now()");
    assert.equal(await status(),'none');
  });
  await test('family endpoints deny anonymous callers and expose no public definer', async () => {
    await db.exec('set role anon');
    await assert.rejects(updateFamily(), /permission denied/);
    await assert.rejects(db.query('select * from public.list_student_family_access_summaries_v1($1)',[org]), /permission denied/);
    await db.exec('reset role');
    assert.equal((await db.query("select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('update_student_relationship_v1','list_student_family_access_summaries_v1') and p.prosecdef")).rows[0].n,0);
  });
  console.log(`${passed} SQL scenarios passed (isolated PostgreSQL; no hosted data changed).`);
})().catch(error => { console.error(error.message); process.exitCode=1; }).finally(() => db.close());
