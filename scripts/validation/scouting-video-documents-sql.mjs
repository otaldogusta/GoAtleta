import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Isolated PostgreSQL with synthetic identities. No credentials or remote writes.
const db = new PGlite();
const migration = name => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const fn = (source, name) => { const start = source.indexOf(`create or replace function public.${name}(`); assert.ok(start >= 0); return source.slice(start, source.indexOf('$$;', start) + 3); };
const org = '20000000-0000-0000-0000-000000000001', other = '20000000-0000-0000-0000-000000000002';
const admin = '10000000-0000-0000-0000-000000000001', staff = '10000000-0000-0000-0000-000000000002';
const outsider = '10000000-0000-0000-0000-000000000003', athlete = '10000000-0000-0000-0000-000000000004';
const secondStaff = '10000000-0000-0000-0000-000000000005';
const fingerprint = 'a'.repeat(64);
const doc = { version: 1, media: { fingerprint, name: 'synthetic.mp4', duration: 20, width: 1280, height: 720 },
  rallies: [{ id: 'r1', start: 0, winner: 'us', reviewed: true, pointTime: 15 }],
  contacts: [{ id: 'c1', studentId: 'player', skill: 'Saque', team: 'us', time: 3, athlete: 'Atleta', outcome: 'Ace' }],
  corrections: [{ time: 3, x: 0.5, y: 0.5 }],
  analysis: { model: 'vballnet-v4c-browser-1', sampledFps: 30, positions: [{ time: 1, x: 0.5, y: 0.5 }], cuts: [5] } };
const asUser = async (id, role = 'authenticated') => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']); await db.exec(`set role ${role}`); };
const rpc = async (sql, params = []) => (await db.query(sql, params)).rows[0]?.result;
const get = (fp = fingerprint, session = 'game', scope = org) => rpc('select public.get_scouting_video_document($1,$2,$3) result', [scope, session, fp]);
const save = (document = doc, revision = 0, id = 'mutation-first', scope = org, session = 'game') => rpc('select public.save_scouting_video_document($1,$2,$3,$4::jsonb,$5,$6) result', [scope, session, document.media.fingerprint, JSON.stringify(document), revision, id]);
const errorCode = (code, message) => error => error.code === code && error.message.includes(message);
try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create table auth.users(id uuid primary key); insert into auth.users values('${admin}'),('${staff}'),('${outsider}'),('${athlete}'),('${secondStaff}');
    create table organizations(id uuid primary key); insert into organizations values('${org}'),('${other}');
    create table organization_members(organization_id uuid,user_id uuid,role_level int);
    insert into organization_members values('${org}','${admin}',50),('${org}','${staff}',10),('${org}','${secondStaff}',10),('${other}','${outsider}',50);
    create table classes(id text primary key,organization_id uuid,owner_id uuid);
    insert into classes values('class','${org}','${admin}'),('other-class','${org}','${admin}'),('foreign-class','${other}','${outsider}');
    create table class_staff(class_id text,organization_id uuid,user_id uuid);
    insert into class_staff values('class','${org}','${staff}'),('class','${org}','${secondStaff}');
    create table class_staff_substitutions(organization_id uuid,class_id text,absent_user_id uuid,replacement_user_id uuid,status text,starts_on date,ends_on date);
    create table students(id text primary key,organization_id uuid,classid text);
    insert into students values('player','${org}','class'),('past-player','${org}','other-class'),('foreign','${other}','foreign-class'),('different-class-player','${org}','other-class');
    create table student_class_enrollments(student_id text,organization_id uuid,class_id text,status text);
    insert into student_class_enrollments values('past-player','${org}','class','inactive');
    create table scouting_sessions(id text primary key,organization_id uuid,classid text,status text);
    insert into scouting_sessions values('game','${org}','class','em_andamento'),('other-game','${org}','other-class','em_andamento'),
      ('foreign-game','${other}','foreign-class','em_andamento'),('invalid-scope-game','${org}','foreign-class','em_andamento');
    grant usage on schema public,auth to authenticated,anon;
  `);
  await db.exec(fn(await migration('2026021002_fix_org_member_policies.sql'), 'is_org_admin'));
  const permissions = await migration('20260921114136_class_staff_history_and_transitions.sql');
  await db.exec(fn(permissions, 'can_manage_class')); await db.exec(fn(permissions, 'is_class_staff'));
  await db.exec(fn(await migration('20261007112922_scouting_rallies.sql'), 'scouting_can_access'));
  await db.exec(await migration('20261017004249_scouting_video_documents.sql'));
  await asUser(null, 'anon'); await assert.rejects(get(), /permission denied/); await assert.rejects(save(), /permission denied/);
  await asUser(null); await assert.rejects(get(), errorCode('42501', 'ACCESS_DENIED'));
  await asUser(outsider); await assert.rejects(get(), errorCode('42501', 'ACCESS_DENIED')); await assert.rejects(save(), errorCode('42501', 'ACCESS_DENIED'));
  await asUser(athlete); await assert.rejects(get(), errorCode('42501', 'ACCESS_DENIED')); await assert.rejects(save(), errorCode('42501', 'ACCESS_DENIED'));
  await asUser(staff);
  await assert.rejects(get(fingerprint, 'other-game'), errorCode('42501', 'ACCESS_DENIED'));
  await assert.rejects(get(fingerprint, 'foreign-game', other), errorCode('42501', 'ACCESS_DENIED'));
  await assert.rejects(get(fingerprint, 'invalid-scope-game'), errorCode('42501', 'ACCESS_DENIED'));
  await assert.rejects(get(fingerprint, 'missing'), errorCode('42501', 'ACCESS_DENIED'));
  await assert.rejects(save(doc, 0, 'wrong-org', other), errorCode('42501', 'ACCESS_DENIED'));
  assert.equal(await get(), null); assert.equal(await get(null), null);
  let saved = await save(); assert.equal(saved.revision, 1); assert.deepEqual(saved.document, doc);
  assert.equal(saved.organizationId, org); assert.equal(saved.sessionId, 'game'); assert.equal(saved.fingerprint, fingerprint);
  assert.deepEqual(await get(), saved); assert.deepEqual(await get(null), saved);
  assert.deepEqual(await save(), saved, 'same operation retries exactly');
  await assert.rejects(db.query('select * from public.scouting_video_documents'), /permission denied/);
  await assert.rejects(db.query('select * from public.scouting_video_document_mutations'), /permission denied/);
  await assert.rejects(db.query('select public.scouting_video_normalize_document($1::jsonb,$2)', [JSON.stringify(doc), fingerprint]), /permission denied/);
  await assert.rejects(db.query("update public.scouting_video_documents set revision=99"), /permission denied/);
  await assert.rejects(save(doc, 0, 'stale'), errorCode('40001', 'VIDEO_DOCUMENT_CONFLICT'));
  await assert.rejects(save({ ...doc, contacts: [] }, 0), errorCode('22023', 'VIDEO_DOCUMENT_MUTATION_REUSED'));
  await asUser(secondStaff); assert.deepEqual((await get()).document, doc, 'analysis belongs to class/session, not author');
  await assert.rejects(save(), errorCode('22023', 'VIDEO_DOCUMENT_MUTATION_REUSED'));
  const changed = { ...doc, corrections: [{ time: 4, x: 0.4, y: 0.4 }] };
  saved = await save(changed, 1, 'second-staff'); assert.equal(saved.revision, 2);
  await asUser(staff); const originalRetry = await save(); assert.equal(originalRetry.revision, 1);
  assert.deepEqual((await get()).document, changed, 'old acknowledgement never rewinds canonical content');
  assert.equal((await get()).revision, 2);
  // The isolated PGlite connection serializes requests; both still submit the same stale revision.
  const concurrent = await Promise.allSettled([save(doc, 2, 'device-a'), save(changed, 2, 'device-b')]);
  assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(concurrent.filter(r => r.status === 'rejected' && r.reason.code === '40001').length, 1);
  assert.equal((await get()).revision, 3);
  const beforeInvalid = await get();
  const invalid = [
    { ...doc, version: 2 }, { ...doc, media: { ...doc.media, duration: 0 } },
    { ...doc, rallies: [] }, { ...doc, rallies: [{ ...doc.rallies[0], start: 1 }] },
    { ...doc, rallies: [{ ...doc.rallies[0], pointTime: 20 }] }, { ...doc, contacts: [{ ...doc.contacts[0], studentId: 'foreign' }] },
    { ...doc, contacts: [{ ...doc.contacts[0], studentId: 'different-class-player' }] },
    { ...doc, contacts: [{ ...doc.contacts[0], time: -1 }] }, { ...doc, contacts: [{ ...doc.contacts[0], skill: 'invalid' }] },
    { ...doc, contacts: [{ ...doc.contacts[0], id: 'r1' }] },
    { ...doc, corrections: [{ time: 1, x: 2, y: 0 }] }, { ...doc, analysis: { ...doc.analysis, cuts: [5, 4] } },
    { ...doc, analysis: { ...doc.analysis, positions: [{ time: 21, x: 0, y: 0 }] } },
    { ...doc, contacts: Array.from({ length: 20001 }, (_, i) => ({ ...doc.contacts[0], id: `c${i}` })) },
    { ...doc, analysis: { ...doc.analysis, positions: Array(54001).fill({ time: 1, x: 0, y: 0 }) } },
    { ...doc, unwanted: 'x'.repeat(15000000) },
  ];
  for (const [i, malformed] of invalid.entries()) await assert.rejects(save(malformed, 3, `invalid-${i}`), errorCode('22023', 'VIDEO_DOCUMENT_'));
  const rawBase = JSON.stringify(doc);
  const numericBase = { version: 1, media: doc.media, rallies: [{ id: 'r1', start: 0, winner: null, reviewed: false }], contacts: [], corrections: [] };
  const rawMinimal = JSON.stringify(numericBase);
  const rawTwoRallies = JSON.stringify({ ...numericBase, rallies: [...numericBase.rallies, { id: 'r2', start: 1, winner: null, reviewed: false }] });
  const invalidNumericDocuments = [
    rawBase.replace('"width":1280', '"width":1e400'),
    rawBase.replace('"height":720', '"height":1e-400'),
    rawMinimal.replace('"duration":20', '"duration":1e-400'),
    rawTwoRallies.replace('"start":1', '"start":1e-400'),
    rawBase.replace('"cuts":[5]', '"cuts":[1,1.0000000000000000000001]'),
    rawBase.replace('"time":3', '"time":19.9999999999999999999999999999'),
  ];
  for (const [i, raw] of invalidNumericDocuments.entries()) {
    assert.notEqual(raw, rawBase, 'direct-RPC numeric fixture must modify the serialized document');
    await assert.rejects(rpc('select public.save_scouting_video_document($1,$2,$3,$4::jsonb,$5,$6) result',
      [org, 'game', fingerprint, raw, 3, `invalid-number-${i}`]), errorCode('22023', 'VIDEO_DOCUMENT_INVALID'));
  }
  assert.deepEqual(await get(), beforeInvalid, 'invalid writes roll back without revision or data changes');
  const fractionalDimensions = { ...doc, media: { ...doc.media, fingerprint: 'fractional-dimensions', width: 1280.5, height: 720.25 } };
  assert.deepEqual((await save(fractionalDimensions, 0, 'fractional-dimensions')).document, fractionalDimensions,
    'finite positive fractional dimensions remain supported by the existing core contract');
  const extremeDimensions = { ...doc, media: { ...doc.media, fingerprint: 'finite-dimension-limits', width: Number.MAX_VALUE, height: Number.MIN_VALUE } };
  assert.deepEqual((await save(extremeDimensions, 0, 'finite-dimension-limits')).document, extremeDimensions,
    'representable positive double boundaries remain supported');
  const canonical = { ...doc, extra: 'stripped', media: { ...doc.media, url: 'file:///private' },
    contacts: [{ ...doc.contacts[0], studentId: 'past-player', token: 'stripped' }] };
  saved = await save(canonical, 3, 'canonical'); assert.equal(saved.revision, 4);
  assert.equal(saved.document.extra, undefined); assert.equal(saved.document.media.url, undefined); assert.equal(saved.document.contacts[0].token, undefined);
  assert.equal(saved.document.contacts[0].studentId, 'past-player', 'historical class membership remains intact');
  const otherMedia = { ...doc, media: { ...doc.media, fingerprint: 'another-file' } };
  await save(otherMedia, 0, 'another-media'); assert.equal((await get(null)).fingerprint, 'another-file');
  const youtube = { ...doc, media: { ...doc.media, fingerprint: 'youtube:M7lc1UVf-VE', youtubeId: 'M7lc1UVf-VE' },
    analysis: { ...doc.analysis, source: { fingerprint, name: 'synthetic-original.mp4', duration: 20, width: 1280, height: 720, offsetSeconds: 0 } } };
  assert.deepEqual((await save(youtube, 0, 'youtube')).document, youtube, 'connected original tracking survives YouTube cloud restore');
  await assert.rejects(save({ ...youtube, analysis: { ...youtube.analysis, source: { ...youtube.analysis.source, fingerprint: 123 } } }, 1, 'bad-source-fingerprint'), errorCode('22023', 'VIDEO_DOCUMENT_INVALID'));
  await assert.rejects(save({ ...youtube, analysis: { ...youtube.analysis, source: { ...youtube.analysis.source, name: 'C:\\private\\synthetic.mp4' } } }, 1, 'bad-source-path'), errorCode('22023', 'VIDEO_DOCUMENT_INVALID'));
  assert.equal((await get(fingerprint)).revision, 4); assert.equal(await get('unknown-file'), null);
  await db.exec("reset role; update scouting_sessions set status='concluido' where id='game'");
  await asUser(staff); assert.equal((await get()).revision, 4, 'completed analysis remains readable');
  await assert.rejects(save(doc, 4, 'completed'), errorCode('55000', 'SESSION_COMPLETED'));
  assert.equal((await save(canonical, 3, 'canonical')).revision, 4, 'completed session may acknowledge a previously accepted operation');
  await asUser(admin); assert.equal((await get()).revision, 4, 'coordinator can read the class analysis');
  await db.exec("reset role; update scouting_sessions set status='cancelled' where id='game'");
  await asUser(staff); await assert.rejects(save(doc, 4, 'cancelled'), errorCode('55000', 'SESSION_COMPLETED'));
  await db.exec("reset role; delete from scouting_sessions where id='game'");
  assert.equal((await db.query('select count(*)::int n from scouting_video_documents')).rows[0].n, 0);
  assert.equal((await db.query('select count(*)::int n from scouting_video_document_mutations')).rows[0].n, 0);
  await asUser(staff); await assert.rejects(get(), errorCode('42501', 'ACCESS_DENIED'));
  console.log('scouting-video-documents-sql: passed (staff/class/org scope, private RLS/grants, canonical bounds, historical athletes, cross-device discovery, CAS/idempotency, completion and cascade; isolated serialized PostgreSQL)');
} finally { await db.close(); }
