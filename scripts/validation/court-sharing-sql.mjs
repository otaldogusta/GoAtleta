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
  const legacy = { version: 1, sport: 'volleyball_indoor', actors: [{ id: 'player' }], markers: [], layers: [], court: {}, timeline: { steps: [{ id: 'step' }] },
    organizationId: 'private-org', editor: { version: 1, coordinates: 'regulation', title: 'Jogada', drawings: {}, hiddenLayers: [], lessonLink: { private: true }, actorMeta: { player: { team: 'A', studentId: 'private-student' } } } };
  const document = {
    ...legacy, actors: [...legacy.actors, { id: 'visible-player' }, { id: 'reserve' }],
    timeline: { steps: [{ id: 'step', visibleActorIds: ['player', 'visible-player'], actorElevations: { player: 2 } }, { id: 'next' }] },
    editor: { ...legacy.editor,
      drawings: { step: [{ id: 'target', kind: 'target', hidden: true, elevation: 1 }], next: [{ id: 'ball', kind: 'ball' }] },
      actorMeta: { player: { ...legacy.editor.actorMeta.player, hidden: true }, 'visible-player': { hidden: false }, reserve: { hidden: 'true' } },
      layerOrder: { step: [
        { kind: 'actor', id: 'player', studentId: 'private-student' },
        { kind: 'drawing', id: 'target' },
        { kind: 'actor', id: 'visible-player' },
        { kind: 'actor', id: 'player' },
        { kind: 'actor', id: 'reserve' },
        { kind: 'drawing', id: 'ball' },
        { kind: 'student', id: 'private-student' },
      ], next: { unexpected: true }, unknown: [{ kind: 'actor', id: 'player' }] },
    },
  };
  const publish = (organization, classId, proof = code, payload = document, key = 'board') => query('select public.publish_court_share($1,$2,$3,$4::jsonb,$5) as value', [organization, classId, key, JSON.stringify(payload), proof]);
  await asUser(staff, 'authenticated');
  const legacyShare = await publish(org, 'class', code, legacy, 'legacy-board');
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../../supabase/migrations/20261112120823_preserve_court_share_layers.sql', import.meta.url), 'utf8'));
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
  const read = (proof, id = share.id) => query('select public.read_court_share($1,$2) as value', [id, proof]);
  const legacyValue = await read(code, legacyShare.id);
  assert.equal(legacyValue.permission, 'viewer');
  assert.equal(legacyValue.document.editor.layerOrder, undefined);
  assert.equal(legacyValue.document.editor.actorMeta.player.hidden, undefined);
  const value = await read(code);
  assert.equal(value.permission, 'viewer');
  assert.deepEqual(value.document.editor.layerOrder, { step: [
    { kind: 'actor', id: 'player' }, { kind: 'drawing', id: 'target' }, { kind: 'actor', id: 'visible-player' },
  ] });
  assert.equal(value.document.editor.actorMeta.player.hidden, true);
  assert.equal(value.document.editor.actorMeta['visible-player'].hidden, false);
  assert.equal(value.document.editor.actorMeta.reserve.hidden, undefined);
  assert.equal(value.document.editor.drawings.step[0].hidden, true);
  assert.equal(value.document.editor.drawings.step[0].elevation, 1);
  assert.equal(value.document.timeline.steps[0].actorElevations.player, 2);
  assert.equal(value.document.editor.actorMeta.player.studentId, undefined);
  assert.equal(value.document.editor.lessonLink, undefined);
  assert.equal(value.document.organizationId, undefined);
  assert.equal(await read(replacement), null);
  assert.equal(await read('bad'), null);
  await assert.rejects(publish(org, 'class'), /permission denied/);
  await assert.rejects(db.query('select * from public.court_shares'), /permission denied/);
  await assert.rejects(db.query("update public.court_shares set document='{}'"), /permission denied/);
  await asUser(staff, 'authenticated');
  assert.equal((await publish(org, 'class', replacement, legacy)).id, share.id);
  await asUser('', 'anon');
  assert.equal(await read(code), null);
  const republished = await read(replacement);
  assert.equal(republished.permission, 'viewer');
  assert.equal(republished.document.editor.layerOrder, undefined);
  assert.equal(republished.document.editor.actorMeta.player.hidden, undefined);
  await asUser(staff, 'authenticated');
  await db.query('select public.revoke_court_share($1,$2,$3,$4)', [org, 'class', 'board', share.id]);
  await asUser('', 'anon');
  assert.equal(await read(replacement), null);
  console.log('[court-sharing] isolated SQL: scoped publishing, public layer projection, legacy documents, rotation and revocation passed');
} finally { await db.close(); }
