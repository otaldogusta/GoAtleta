import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = name => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const fn = (source, name) => {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('$$;', start) + 3);
};
const org = '20000000-0000-0000-0000-000000000001';
const otherOrg = '20000000-0000-0000-0000-000000000002';
const trainer = '10000000-0000-0000-0000-000000000001';
const otherTrainer = '10000000-0000-0000-0000-000000000002';
const outsider = '10000000-0000-0000-0000-000000000003';
const code = 'a'.repeat(64);
const otherCode = 'b'.repeat(64);
const hash = proof => createHash('sha256').update(proof).digest('hex');
const offer = 'v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n';
const answer = `${offer}a=setup:active\r\n`;
const anotherAnswer = `${offer}a=setup:passive\r\n`;
const query = async (name, params) => (await db.query(`select public.scouting_phone_video_${name}(${params.map((_, i) => `$${i + 1}`).join(',')}) as value`, params)).rows[0].value;
const scope = [org, 'class', 'game'];
const as = async (user = null) => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? '']);
  await db.exec(user ? 'set role authenticated' : 'set role anon');
};
const create = (id, context = scope, description = offer, proof = code) => query('create', [...context, id, hash(proof), description]);

try {
  await db.exec(`
    create role anon; create role authenticated; create schema auth; create schema private;
    grant usage on schema private to authenticated;
    create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    create table auth.users(id uuid primary key); insert into auth.users values('${trainer}'),('${otherTrainer}'),('${outsider}');
    create table organizations(id uuid primary key); insert into organizations values('${org}'),('${otherOrg}');
    create table organization_members(organization_id uuid,user_id uuid,role_level int);
    insert into organization_members values('${org}','${trainer}',10),('${org}','${otherTrainer}',10),('${otherOrg}','${outsider}',50);
    create table classes(id text primary key,organization_id uuid,owner_id uuid);
    insert into classes values('class','${org}','${trainer}'),('other-class','${otherOrg}','${outsider}');
    create table class_staff(class_id text,organization_id uuid,user_id uuid);
    insert into class_staff values('class','${org}','${trainer}'),('class','${org}','${otherTrainer}');
    create table class_staff_substitutions(organization_id uuid,class_id text,absent_user_id uuid,replacement_user_id uuid,status text,starts_on date,ends_on date);
    create table scouting_sessions(id text primary key,organization_id uuid not null,classid text not null,status text not null);
    insert into scouting_sessions values('game','${org}','class','concluido'),('other-game','${otherOrg}','other-class','em_andamento');
    grant usage on schema public,auth to authenticated,anon;
  `);
  await db.exec(fn(await migration('2026021002_fix_org_member_policies.sql'), 'is_org_admin'));
  const permissions = await migration('20260921114136_class_staff_history_and_transitions.sql');
  await db.exec(fn(permissions, 'can_manage_class'));
  await db.exec(fn(permissions, 'is_class_staff'));
  await db.exec(fn(await migration('20261007112922_scouting_rallies.sql'), 'scouting_can_access'));
  await db.exec(await migration('20261110013811_scouting_phone_video_pairing.sql'));
  assert.equal((await db.query("select has_schema_privilege('authenticated','private','USAGE') as allowed")).rows[0].allowed, true);

  const id = randomUUID();
  await as();
  await assert.rejects(create(id), /permission denied/);
  await assert.rejects(query('read_answer', [...scope, id]), /permission denied/);
  await assert.rejects(query('close', [...scope, id]), /permission denied/);
  await as(outsider);
  await assert.rejects(create(id), /PHONE_VIDEO_ACCESS_DENIED/);
  await as(trainer);
  await assert.rejects(create(id, [org, 'other-class', 'game']), /PHONE_VIDEO_ACCESS_DENIED/);
  await assert.rejects(create(id, [otherOrg, 'other-class', 'other-game']), /PHONE_VIDEO_ACCESS_DENIED/);
  await assert.rejects(create(id, scope, 'x'.repeat(16385)), /PHONE_VIDEO_INVALID_PAIRING/);
  const expiry = new Date(await create(id)).getTime();
  assert.ok(expiry > Date.now() + 590000 && expiry <= Date.now() + 600000);
  assert.deepEqual(await query('read_answer', [...scope, id]), { answer: null });
  await assert.rejects(db.query('select * from private.scouting_phone_video_pairs'), /permission denied/);

  await as();
  assert.equal(await query('offer', [randomUUID(), code]), null);
  assert.equal(await query('offer', [id, otherCode]), null);
  assert.equal(await query('offer', [id, 'malformed']), null);
  assert.equal(await query('offer', [id, code]), offer);
  assert.equal(await query('answer', [id, otherCode, answer]), false);
  assert.equal(await query('answer', [id, code, 'x'.repeat(16385)]), false);
  assert.equal(await query('answer', [id, code, answer]), true);
  assert.equal(await query('answer', [id, code, answer]), true);
  assert.equal(await query('answer', [id, code, anotherAnswer]), false);

  await as(otherTrainer);
  await assert.rejects(query('read_answer', [...scope, id]), /PHONE_VIDEO_PAIRING_UNAVAILABLE/);
  await query('close', [...scope, id]);
  await as(trainer);
  assert.deepEqual(await query('read_answer', [...scope, id]), { answer });
  await assert.rejects(query('read_answer', [org, 'other-class', 'game', id]), /PHONE_VIDEO_ACCESS_DENIED/);
  const replacement = randomUUID();
  await create(replacement, scope, offer, otherCode);
  await assert.rejects(query('read_answer', [...scope, id]), /PHONE_VIDEO_PAIRING_UNAVAILABLE/);
  await as();
  assert.equal(await query('offer', [id, code]), null);
  assert.equal(await query('answer', [id, code, answer]), false);
  assert.equal(await query('offer', [replacement, otherCode]), offer);
  await as(trainer);
  await query('close', [...scope, replacement]);
  await query('close', [...scope, replacement]);
  await as();
  assert.equal(await query('offer', [replacement, otherCode]), null);

  const expiring = randomUUID();
  await as(trainer);
  await create(expiring);
  await db.exec('reset role');
  await db.query("update private.scouting_phone_video_pairs set expires_at=clock_timestamp()-interval '1 second' where id=$1", [expiring]);
  await as();
  assert.equal(await query('offer', [expiring, code]), null);
  assert.equal(await query('answer', [expiring, code, answer]), false);
  await as(trainer);
  await assert.rejects(query('read_answer', [...scope, expiring]), /PHONE_VIDEO_PAIRING_UNAVAILABLE/);
  const live = randomUUID();
  await create(live);
  await db.exec('reset role');
  const stored = (await db.query('select id, proof_hash, offer, answer from private.scouting_phone_video_pairs order by created_at')).rows;
  assert.equal(stored.length, 3);
  assert.equal(stored.find(row => row.id === id).offer, null);
  assert.equal(stored.find(row => row.id === id).answer, null);
  assert.equal(stored.find(row => row.id === live).proof_hash, hash(code));
  await as(trainer);
  await create(randomUUID());
  await create(randomUUID());
  await assert.rejects(create(randomUUID()), /PHONE_VIDEO_RATE_LIMITED/);

  await db.exec('reset role');
  await db.query('delete from public.class_staff where user_id=$1', [trainer]);
  await as(trainer);
  await assert.rejects(query('read_answer', [...scope, live]), /PHONE_VIDEO_ACCESS_DENIED/);
  console.log('scouting phone-video pairing: SQL scope, proof, single answer, revocation, expiry and throttling passed');
} finally {
  await db.close();
}
