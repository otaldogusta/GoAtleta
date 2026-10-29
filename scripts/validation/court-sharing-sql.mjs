import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Isolated PostgreSQL; canonical permission helpers represented by synthetic staff.
const db = new PGlite();
const org = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const staff = '33333333-3333-4333-8333-333333333333', outsider = '44444444-4444-4444-8444-444444444444';
const code = 'a'.repeat(64), replacement = 'b'.repeat(64);
try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create table auth.users(id uuid primary key); insert into auth.users values('${staff}'),('${outsider}');
    create table public.organizations(id uuid primary key); insert into organizations values('${org}'),('${other}');
    create table public.classes(id text primary key,organization_id uuid); insert into classes values('class','${org}'),('other','${other}');
    create function public.is_org_admin(uuid) returns boolean language sql as 'select false';
    create function public.is_class_staff(text) returns boolean language sql as $$select auth.uid()='${staff}'::uuid and $1='class'$$;
    grant usage on schema public,auth to anon,authenticated;`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261027134015_court_sharing.sql', import.meta.url), 'utf8'));
  const query = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  const asUser = async (id, role) => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec(`set role ${role}`); };
  const document = { version: 1, sport: 'volleyball_indoor', actors: [], markers: [], layers: [], court: {}, timeline: { steps: [{ id: 'step' }] },
    organizationId: 'private-org', editor: { version: 1, coordinates: 'regulation', title: 'Jogada', drawings: {}, hiddenLayers: [], lessonLink: { private: true }, actorMeta: { player: { team: 'A', studentId: 'private-student' } } } };
  const publish = (organization, classId, proof = code) => query('select public.publish_court_share($1,$2,$3,$4::jsonb,$5) as value', [organization, classId, 'board', JSON.stringify(document), proof]);
  await asUser(staff, 'authenticated');
  const share = await publish(org, 'class');
  assert.ok(share.id);
  await assert.rejects(publish(other, 'class'), /access denied/);
  await assert.rejects(publish(other, 'other'), /access denied/);
  await asUser(outsider, 'authenticated');
  await assert.rejects(publish(org, 'class'), /access denied/);
  await assert.rejects(db.query('select public.get_court_share($1,$2,$3)', [org, 'class', 'board']), /access denied/);
  await assert.rejects(db.query('select public.revoke_court_share($1,$2,$3,$4)', [org, 'class', 'board', share.id]), /access denied/);
  await asUser('', 'anon');
  const read = proof => query('select public.read_court_share($1,$2) as value', [share.id, proof]);
  const value = await read(code);
  assert.equal(value.permission, 'viewer');
  assert.equal(value.document.editor.actorMeta.player.studentId, undefined);
  assert.equal(value.document.editor.lessonLink, undefined);
  assert.equal(value.document.organizationId, undefined);
  assert.equal(await read(replacement), null);
  assert.equal(await read('bad'), null);
  await assert.rejects(publish(org, 'class'), /permission denied/);
  await assert.rejects(db.query('select * from public.court_shares'), /permission denied/);
  await assert.rejects(db.query("update public.court_shares set document='{}'"), /permission denied/);
  await asUser(staff, 'authenticated');
  await publish(org, 'class', replacement);
  await asUser('', 'anon');
  assert.equal(await read(code), null);
  assert.equal((await read(replacement)).permission, 'viewer');
  await asUser(staff, 'authenticated');
  await db.query('select public.revoke_court_share($1,$2,$3,$4)', [org, 'class', 'board', share.id]);
  await asUser('', 'anon');
  assert.equal(await read(replacement), null);
  console.log('[court-sharing] isolated SQL: scoped publishing, private projection, anonymous readonly access, rotation and revocation passed');
} finally { await db.close(); }
