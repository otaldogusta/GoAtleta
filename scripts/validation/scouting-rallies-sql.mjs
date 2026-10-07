import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Isolated PostgreSQL; synthetic identities, current permission functions and
// actual migrations. Does not connect to Supabase or use application credentials.
const db = new PGlite();
const hostedCompat = process.argv.includes('--hosted-compat');
const migration = name => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const fn = (source, name) => {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0); return source.slice(start, source.indexOf('$$;', start) + 3);
};
const org = '20000000-0000-0000-0000-000000000001';
const other = '20000000-0000-0000-0000-000000000002';
const admin = '10000000-0000-0000-0000-000000000001';
const trainer = '10000000-0000-0000-0000-000000000002';
const outsider = '10000000-0000-0000-0000-000000000003';
const asUser = async user => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec('set role authenticated');
};
let revision = 0, sequence = 0;
const command = async (name, payload = {}, options = {}) => {
  const result = await db.query('select public.apply_scouting_command($1,$2,$3,$4,$5,$6::jsonb) result',
    [options.session ?? 'game', options.org ?? org, options.revision ?? revision,
      options.request ?? `request-${++sequence}`, name, JSON.stringify(payload)]);
  const detail = result.rows[0].result;
  revision = detail.session.revision;
  return detail;
};
const contact = (fundamental, resultKey, extra = {}) => ({ fundamental, resultKey, phase: 'side_out', studentId: 'student', ...extra });
const detail = async () => (await db.query('select public.get_scouting_detail($1,$2) result', ['game', org])).rows[0].result;
try {
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    create table auth.users(id uuid primary key); insert into auth.users values('${admin}'),('${trainer}'),('${outsider}');
    create table organizations(id uuid primary key); insert into organizations values('${org}'),('${other}');
    create table organization_members(organization_id uuid,user_id uuid,role_level int);
    insert into organization_members values('${org}','${admin}',50),('${org}','${trainer}',10);
    create table classes(id text primary key,organization_id uuid,owner_id uuid);
    insert into classes values('class','${org}','${admin}'),('foreign-class','${other}','${outsider}');
    create table class_staff(class_id text,organization_id uuid,user_id uuid);
    insert into class_staff values('class','${org}','${trainer}');
    create table class_staff_substitutions(organization_id uuid,class_id text,absent_user_id uuid,replacement_user_id uuid,status text,starts_on date,ends_on date);
    create table students(id text primary key,name text,organization_id uuid,classid text);
    insert into students values('student','Ana','${org}','class'),('foreign','Other','${other}','foreign-class');
    create table student_class_enrollments(student_id text,organization_id uuid,class_id text,status text);
    grant usage on schema public,auth to authenticated,anon;
    grant select on all tables in schema public to authenticated;
  `);
  await db.exec(fn(await migration('2026021002_fix_org_member_policies.sql'), 'is_org_admin'));
  const permissions = await migration('20260921114136_class_staff_history_and_transitions.sql');
  await db.exec(fn(permissions, 'can_manage_class'));
  await db.exec(fn(permissions, 'is_class_staff'));
  const base = await migration('2026010601_create_scouting_logs.sql');
  await db.exec(base.match(/create table if not exists public\.scouting_logs \([\s\S]*?\n\);/)[0]);
  await db.exec('alter table scouting_logs add column organization_id uuid, add column client_id text unique, add column mode text;');
  if (hostedCompat) await db.exec(await readFile(new URL('./fixtures/scouting-hosted-compat.sql', import.meta.url), 'utf8'));
  await db.exec(await migration('202606030700_create_scouting_sessions_actions.sql'));
  await db.exec(`insert into scouting_sessions(id,organization_id,classid,type,date) values('legacy','${org}','class','treino','2026-10-05');
    insert into scouting_actions(id,session_id,organization_id,classid,fundamental,phase,result_key,result_label,result_level)
    values('old-action','legacy','${org}','class','ataque','side_out','bloqueado','Bloqueado',1);`);
  if (hostedCompat) await db.exec("update scouting_actions set rally_id='historical-tag',zone='unknown' where id='old-action'");
  await db.exec(await migration('20261007112922_scouting_rallies.sql'));
  assert.deepEqual((await db.query("select result_key,result_level,rally_event_id,capture_zone from scouting_actions where id='old-action'")).rows[0], { result_key: 'bloqueado', result_level: 1, rally_event_id: null, capture_zone: null });
  if (hostedCompat) assert.deepEqual((await db.query("select rally_id,zone from scouting_actions where id='old-action'")).rows[0], { rally_id: 'historical-tag', zone: 'unknown' });
  await db.exec(`insert into scouting_sessions(id,organization_id,classid,type,date) values
    ('game','${org}','class','jogo','2026-10-06'),('training','${org}','class','treino','2026-10-06');`);
  await db.exec('set role anon');
  await assert.rejects(command('complete'), /permission denied/);
  await asUser(outsider);
  await assert.rejects(command('complete'), /access denied/);
  await assert.rejects(db.query('select get_scouting_overview($1,$2)', [org, 'class']), /access denied/);
  await asUser(trainer);
  await assert.rejects(command('start_set', {}, { org: other }), /access denied/);
  await command('start_set', { setNumber: 1, scoreUs: 12, scoreThem: 10, serve: 'them', rotation: 1 });
  const contacts = [contact('recepcao', 'b_medio', { zone: 5 }), contact('levantamento', 'organizou'), contact('ataque', 'ponto')];
  const payload = { winner: 'us', contacts };
  const beforeRevision = revision;
  let saved = await command('point', payload, { request: 'point-0001' });
  assert.equal(saved.actions.length, 3);
  assert.equal(saved.actions[0].athlete_name, 'Ana');
  assert.equal(saved.actions.find(a => a.fundamental === 'recepcao').capture_zone, 5);
  assert.equal(saved.actions[0].rally_event_id, saved.rallies[0].id);
  assert.deepEqual(saved.session.match_state, { setNumber: 1, scoreUs: 13, scoreThem: 10, serve: 'us', rotation: 6, recoveredDraft: [] });
  assert.equal(saved.rallies.length, 1);
  const overview = (await db.query('select get_scouting_overview($1,$2) result', [org, 'class'])).rows[0].result;
  const gameOverview = overview.find(row => row.session.id === 'game');
  assert.equal(gameOverview.counts.reduce((n, c) => n + c.count, 0), 3);
  assert.equal(gameOverview.rallyStats.receivingWon, 1);
  await assert.rejects(db.query('select get_scouting_overview($1,$2)', [other, 'class']), /access denied/);
  assert.equal((await command('point', payload, { request: 'point-0001', revision: beforeRevision })).rallies.length, 1);
  await assert.rejects(command('point', { winner: 'them', contacts: [] }, { request: 'point-0001' }), /reused/);
  await assert.rejects(command('point', payload, { revision: beforeRevision }), /revision conflict/);
  await assert.rejects(command('point', { winner: 'us', contacts: [contact('ataque', 'erro')] }), /contradicts/);
  await assert.rejects(command('point', { winner: 'us', contacts: [contact('ataque', 'ponto', { studentId: 'foreign' })] }), /outside class/);
  await assert.rejects(command('point', { winner: 'us', contacts: [contact('recepcao', 'bogus')] }), /Invalid scouting result/);
  assert.equal((await detail()).session.revision, revision);
  await assert.rejects(db.exec("update scouting_sessions set match_state='{}' where id='game'"), /Use scouting command/);
  await assert.rejects(db.exec("delete from scouting_actions where session_id='game'"), /Use scouting command/);
  await assert.rejects(db.exec("delete from scouting_rallies"), /permission denied/);
  const reopened = await command('reopen_point', { rallyId: saved.rallies[0].id });
  assert.equal(reopened.actions.length, 0);
  assert.equal(reopened.session.match_state.scoreUs, 12);
  assert.equal(reopened.session.match_state.rotation, 1);
  assert.equal(reopened.session.match_state.recoveredDraft.length, 3);
  await assert.rejects(command('complete'), /Resolve scouting draft/);
  // Replaying an already saved request must not resurrect a reopened point.
  assert.equal((await command('point', payload, { request: 'point-0001' })).rallies.length, 0);
  saved = await command('point', payload);
  assert.equal(saved.rallies.length, 1);
  await db.exec("reset role; alter table scouting_actions add constraint fail_point check(capture_zone is distinct from 6);");
  await asUser(trainer);
  const beforeFailure = await detail();
  await assert.rejects(command('point', { winner: 'them', contacts: [contact('recepcao','b_medio', { zone: 6 })] }), /fail_point/);
  assert.deepEqual(await detail(), beforeFailure);
  await command('complete');
  await assert.rejects(command('point', { winner: 'us', contacts: [] }), /completed/);
  await assert.rejects(db.exec("update scouting_sessions set status='em_andamento' where id='game'"), /Use scouting command/);
  revision = 0;
  const trained = await command('action', { contacts: [contact('recepcao', 'a_alto')] }, { session: 'training' });
  assert.equal(trained.actions.length, 1);
  assert.equal((await command('undo_action', { actionId: trained.actions[0].id }, { session: 'training' })).actions.length, 0);
  await assert.rejects(command('undo_action', {}, { session: 'training' }), /not the latest/);
  await db.exec('reset role');
  assert.equal((await db.query("select attack_send_2 from scouting_logs where id='legacy_game'")).rows[0].attack_send_2, 1);
  await asUser(admin);
  await db.exec("delete from scouting_sessions where id='game'");
  await db.exec("update scouting_actions set result_label='Historical label' where id='old-action'");
  assert.equal((await db.query("select revision from scouting_sessions where id='legacy'")).rows[0].revision, 1);
  if (hostedCompat) {
    await db.exec(`insert into scouting_actions(id,scouting_session_id,class_id,skill,game_phase,quality,score,label)
      values('compat-write','legacy','class','saque','saque','high',2,'Dificultou')`);
    assert.equal((await db.query("select session_id from scouting_actions where id='compat-write'")).rows[0].session_id, 'legacy');
  }
  console.log(`scouting-rallies-sql: passed (${hostedCompat ? 'hosted compatibility schema' : 'clean schema'}; atomic save/rollback, replay, revision, scope, athlete, reopen, legacy, training, completion, cascade)`);
} finally { await db.close(); }
