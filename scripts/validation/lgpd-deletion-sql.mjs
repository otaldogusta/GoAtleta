import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Isolated PostgreSQL, synthetic identities only. This never opens a remote DB.
const db = new PGlite();
const migration = async (name) => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const user = '10000000-0000-0000-0000-000000000001';
const org = '20000000-0000-0000-0000-000000000001';
const otherUser = '10000000-0000-0000-0000-000000000002';
const otherOrg = '20000000-0000-0000-0000-000000000002';
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const videoDocument = (studentId, athlete) => ({
  version: 1, media: { fingerprint: `video-${studentId}`, name: 'synthetic.mp4', duration: 30, width: 640, height: 360 },
  rallies: [{ id: 'rally-1', start: 0, winner: null, reviewed: false }],
  contacts: [{ id: 'contact-1', time: 1, skill: 'Saque', team: 'us', athlete, studentId, outcome: 'Em jogo' }],
  corrections: [],
});
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema private;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${user}'), ('${otherUser}');
    create table public.organizations (id uuid primary key);
    create table public.students (
      id text primary key, owner_id uuid, organization_id uuid, classid text, name text not null,
      phone text not null default '', age integer not null default 0,
      login_email text, student_user_id uuid, photo_url text, birthdate date,
      cpf_input text, cpf_masked text, cpf_hmac text, cpf_encrypted bytea,
      cpf_encryption_version integer, rg text, rg_normalized text, ra text,
      ra_start_year integer, external_id text, guardian_name text, guardian_phone text,
      guardian_relation text, guardian_cpf_hmac text, health_issue boolean,
      health_issue_notes text, medication_use boolean, medication_notes text, health_observations text
    );
    create table public.consents (id uuid primary key default gen_random_uuid(), student_id text references students);
    create table public.student_relationships (id uuid primary key default gen_random_uuid(),
      student_id text, organization_id uuid, status text, revoked_at timestamptz, revocation_reason text);
    create table public.student_relationship_invites (id uuid primary key default gen_random_uuid(),
      student_id text, organization_id uuid, used_at timestamptz, revoked_at timestamptz, revocation_reason text);
    create table public.student_invites (id uuid primary key default gen_random_uuid(),
      student_id text, organization_id uuid, revoked boolean not null default false, revoked_at timestamptz);
    create table public.organization_members (organization_id uuid, user_id uuid, role_level integer);
    create table public.classes (id text primary key, organization_id uuid);
    create table public.student_class_enrollments (student_id text, class_id text, organization_id uuid, status text);
    create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    create function public.is_org_admin(p_org uuid) returns boolean language sql as
      'select exists(select 1 from public.organization_members where organization_id = p_org and user_id = auth.uid() and role_level >= 50)';
    create function public.is_class_staff(p_class text) returns boolean language sql as 'select false';
    create function private.set_lgpd_updated_at() returns trigger language plpgsql as
      'begin new.updated_at := now(); return new; end';
  `);
  // Load actual feature schemas/RPCs, including video replay and current profile
  // fields. Auth/organization helpers and the initial student schema are local
  // fixtures; this is not a certification of every hosted RLS policy.
  await db.exec(await migration('202603101145_add_student_college_course.sql'));
  await db.exec(await migration('20260911162058_add_student_profile_details.sql'));
  await db.exec(await migration('202603101700_create_athlete_intakes.sql'));
  await db.exec(await migration('202606030700_create_scouting_sessions_actions.sql'));
  await db.exec(await migration('20261007112922_scouting_rallies.sql'));
  await db.exec(await migration('20261017004249_scouting_video_documents.sql'));
  await db.exec(await migration('20260708142000_create_data_subject_requests.sql'));
  await db.exec(await migration('20260905173939_recover_lgpd_deletion_processing.sql'));
  await db.exec(await migration('20261021153000_complete_lgpd_student_copies.sql'));
  await db.exec(`
    grant usage on schema public, private, auth to authenticated, service_role;
    grant all on all tables in schema public to authenticated, service_role;
    insert into organizations values ('${org}'), ('${otherOrg}');
    insert into classes values ('c1', '${org}'), ('c2', '${otherOrg}');
    insert into organization_members values ('${org}', '${user}', 50);
    insert into students (id, owner_id, organization_id, classid, name, photo_url, health_issue_notes, address, gender_identity, college_course)
      values ('s1', '${user}', '${org}', 'c1', 'Synthetic Athlete', 'untrusted/object/url', 'synthetic health', 'synthetic address', 'synthetic gender', 'synthetic course'),
        ('s2', '${otherUser}', '${org}', 'c1', 'Other Athlete', null, 'other health', 'other address', 'other gender', null),
        ('s3', '${otherUser}', '${otherOrg}', 'c2', 'Foreign Athlete', null, 'foreign health', 'foreign address', 'foreign gender', null);
    insert into athlete_intakes (id,organization_id,student_id,full_name,email,birth_date,notes,cardio_risk)
      values ('intake-1','${org}','s1','Synthetic Athlete','synthetic@example.invalid','2000-01-01','synthetic medical note',true),
        ('intake-2','${org}','s2','Other Athlete',null,null,'other note',true),
        ('intake-foreign','${otherOrg}','s1','Foreign copy',null,null,'foreign note',true),
        ('intake-orphan','${org}',null,'Synthetic Athlete',null,null,'unlinked note',true);
    insert into scouting_sessions (id,organization_id,classid,revision,date,match_state)
      values ('game1','${org}','c1',5,'2026-10-01','{"scoreUs":7,"scoreThem":3,"recoveredDraft":[{"studentId":"s1","athleteName":"Synthetic Athlete","resultKey":"ace"},{"studentId":"s2","athleteName":"Other Athlete"}]}'),
        ('game2','${otherOrg}','c2',8,'2026-10-01','{"scoreUs":4,"recoveredDraft":[{"studentId":"s1","athleteName":"Foreign copy"}]}'),
        ('game-other','${org}','c1',3,'2026-10-01','{"scoreUs":2,"recoveredDraft":[]}');
    insert into scouting_actions (id,session_id,organization_id,classid,student_id,athlete_name,fundamental,phase,result_key,result_label,result_level)
      values ('action-1','game1','${org}','c1','s1','Synthetic Athlete','saque','saque','ace','Ace',3),
        ('action-2','game1','${org}','c1','s2','Other Athlete','saque','saque','ace','Ace',3),
        ('action-foreign','game2','${otherOrg}','c2','s1','Foreign copy','saque','saque','ace','Ace',3);
    insert into scouting_rallies (id,session_id,organization_id,classid,set_number,number,won,serve,score_us,score_them,contacts)
      values ('rally1','game1','${org}','c1',1,1,true,'us',7,3,'[{"studentId":"s1","athleteName":"Synthetic Athlete","zone":4},{"studentId":"s2","athleteName":"Other Athlete","zone":2}]'),
        ('rally-foreign','game2','${otherOrg}','c2',1,1,true,'us',4,0,'[{"studentId":"s1","athleteName":"Foreign copy"}]');
    insert into consents (student_id) values ('s1');
    insert into student_relationships (student_id, organization_id, status) values ('s1', '${org}', 'active');
    insert into student_relationship_invites (student_id, organization_id) values ('s1', '${org}');
    insert into student_invites (student_id, organization_id) values ('s1', '${org}');
    select set_config('request.jwt.claim.sub', '${user}', false);
    set role authenticated;
  `);
  await assert.rejects(db.query('select * from claim_lgpd_deletion_requests()'), /permission denied/);
  await assert.rejects(db.query('select * from prepare_lgpd_student_anonymization(gen_random_uuid(),gen_random_uuid())'), /permission denied/);
  await assert.rejects(db.query('select finish_lgpd_deletion_request(gen_random_uuid(),gen_random_uuid())'), /permission denied/);
  await assert.rejects(db.query(`insert into data_subject_requests(user_id,student_id,request_type)
    values ($1,'s3','deletion')`, [user]), /row-level security/);
  await assert.rejects(db.query(`insert into data_subject_requests (user_id, student_id, request_type, anonymized_at, cleanup_photo_path)
    values ($1, 's1', 'deletion', now(), 'other-org/private/avatar')`, [user]), /SERVER_OWNED_PROCESSING_STATE/);
  await db.query(`insert into data_subject_requests (user_id, student_id, request_type) values ($1, 's1', 'deletion')`, [user]);
  await db.exec('set role service_role');
  const originalVideo = videoDocument('s1', 'Synthetic Athlete');
  originalVideo.contacts.push({ ...originalVideo.contacts[0], id: 'contact-2', time: 2, studentId: 's2', athlete: 'Other Athlete' });
  const otherVideo = videoDocument('s2', 'Other Athlete');
  const saveVideoSql = 'select save_scouting_video_document($1,$2,$3,$4::jsonb,$5,$6)';
  await db.exec('set role authenticated');
  await db.query(saveVideoSql, [org, 'game1', 'video-s1', JSON.stringify(originalVideo), 0, 'mutation-target']);
  await db.query(saveVideoSql, [org, 'game1', 'video-s2', JSON.stringify(otherVideo), 0, 'mutation-other']);
  await db.exec('set role service_role');
  await db.query(`insert into scouting_video_documents(organization_id,session_id,fingerprint,document,revision,mutation_id)
    values ($1,'game2','video-foreign',$2::jsonb,4,'foreign-mutation')`, [otherOrg, JSON.stringify(originalVideo)]);
  await db.query(`insert into scouting_video_document_mutations(organization_id,session_id,fingerprint,mutation_id,intent_hash,response)
    values ($1,'game2','video-foreign','foreign-mutation','synthetic-hash','{}')`, [otherOrg]);
  const first = (await db.query('select * from claim_lgpd_deletion_requests()')).rows[0];
  assert.ok(first.processing_token);
  assert.equal((await db.query('select * from claim_lgpd_deletion_requests()')).rows.length, 0, 'active lease excludes another claim');
  assert.equal(await scalar('select finish_lgpd_deletion_request($1, $2)', [first.id, first.processing_token]), false, 'cannot complete before anonymization');

  await db.exec('reset role');
  await db.exec(`create function private.fail_consents_delete() returns trigger language plpgsql as
    'begin raise exception ''SYNTHETIC_FAILURE''; end';
    create trigger fail_consents_delete before delete on consents for each row execute function private.fail_consents_delete();`);
  await db.exec('set role service_role');
  await assert.rejects(db.query('select * from prepare_lgpd_student_anonymization($1, $2)', [first.id, first.processing_token]), /SYNTHETIC_FAILURE/);
  assert.equal(await scalar(`select name from students where id = 's1'`), 'Synthetic Athlete', 'later failure rolls back student changes');
  assert.equal(await scalar(`select address from students where id = 's1'`), 'synthetic address');
  assert.equal(await scalar(`select count(*)::integer from athlete_intakes where id='intake-1'`), 1, 'late failure restores the intake');
  assert.equal(await scalar(`select athlete_name from scouting_actions where id='action-1'`), 'Synthetic Athlete');
  assert.equal(await scalar(`select contacts->0->>'athleteName' from scouting_rallies where id='rally1'`), 'Synthetic Athlete');
  assert.equal(await scalar(`select revision from scouting_sessions where id='game1'`), 5, 'late failure rolls back revisions');
  assert.equal(await scalar(`select revision from scouting_video_documents where fingerprint='video-s1'`), 1);
  assert.equal(await scalar(`select count(*)::integer from scouting_video_document_mutations where mutation_id='mutation-target'`), 1, 'rollback restores video replay receipt');
  assert.equal(await scalar('select anonymized_at from data_subject_requests where id = $1', [first.id]), null);
  await db.exec('reset role');
  await db.exec('drop trigger fail_consents_delete on consents');
  await db.exec('set role service_role');
  assert.equal(await scalar('select photo_object_path from prepare_lgpd_student_anonymization($1, $2)', [first.id, first.processing_token]), `${org}/s1/avatar`);
  assert.equal(await scalar(`select name from students where id = 's1'`), 'Aluno anonimizado');
  assert.equal(await scalar(`select health_issue_notes from students where id = 's1'`), null);
  assert.equal(await scalar(`select address is null and gender_identity is null and college_course is null from students where id='s1'`), true);
  assert.equal(await scalar(`select count(*)::integer from athlete_intakes where student_id='s1' and organization_id=$1`, [org]), 0);
  assert.equal(await scalar(`select count(*)::integer from athlete_intakes`), 3, 'other athlete, foreign org and orphan intakes survive');
  assert.equal(await scalar(`select athlete_name from scouting_actions where id='action-1'`), 'Aluno anonimizado');
  assert.equal(await scalar(`select result_level from scouting_actions where id='action-1'`), 3, 'numeric statistics survive');
  assert.deepEqual(await scalar(`select contacts from scouting_rallies where id='rally1'`), [
    { studentId: 's1', athleteName: 'Aluno anonimizado', zone: 4 }, { studentId: 's2', athleteName: 'Other Athlete', zone: 2 },
  ]);
  assert.equal(await scalar(`select match_state->'recoveredDraft'->0->>'athleteName' from scouting_sessions where id='game1'`), 'Aluno anonimizado');
  assert.equal(await scalar(`select match_state->>'scoreUs' from scouting_sessions where id='game1'`), '7', 'scores survive');
  assert.equal(await scalar(`select revision from scouting_sessions where id='game1'`), 6);
  assert.equal(await scalar(`select revision from scouting_sessions where id='game-other'`), 3, 'untouched sessions do not conflict');
  const changedVideo = await scalar(`select document from scouting_video_documents where fingerprint='video-s1'`);
  assert.deepEqual(changedVideo.contacts[0], { ...originalVideo.contacts[0], athlete: 'Aluno anonimizado', studentId: null });
  assert.deepEqual(changedVideo.contacts[1], originalVideo.contacts[1]);
  assert.deepEqual(changedVideo.media, originalVideo.media, 'the video and its analysis are not erased');
  assert.equal(await scalar(`select revision from scouting_video_documents where fingerprint='video-s1'`), 2);
  assert.match(await scalar(`select mutation_id from scouting_video_documents where fingerprint='video-s1'`), /^lgpd_/);
  assert.equal(await scalar(`select count(*)::integer from scouting_video_document_mutations where mutation_id='mutation-target'`), 0);
  await db.exec('set role authenticated');
  await assert.rejects(db.query(saveVideoSql, [org, 'game1', 'video-s1', JSON.stringify(originalVideo), 0, 'mutation-target']), /VIDEO_DOCUMENT_CONFLICT/, 'old receipt cannot restore its identifying payload');
  await db.exec('set role service_role');
  assert.equal(await scalar(`select count(*)::integer from scouting_video_document_mutations where mutation_id in ('mutation-other','foreign-mutation')`), 2);
  assert.equal(await scalar(`select revision from scouting_video_documents where fingerprint='video-s2'`), 1);
  assert.equal(await scalar(`select document->'contacts'->0->>'athlete' from scouting_video_documents where fingerprint='video-foreign'`), 'Synthetic Athlete', 'foreign documents remain untouched even with the same linked ID');
  assert.equal(await scalar(`select address from students where id='s2'`), 'other address');
  assert.equal(await scalar(`select address from students where id='s3'`), 'foreign address');
  assert.equal(await scalar(`select athlete_name from scouting_actions where id='action-2'`), 'Other Athlete');
  assert.equal(await scalar(`select athlete_name from scouting_actions where id='action-foreign'`), 'Foreign copy');
  assert.equal(await scalar(`select contacts->0->>'athleteName' from scouting_rallies where id='rally-foreign'`), 'Foreign copy');
  assert.equal(await scalar('select count(*)::integer from consents'), 0);
  assert.equal(await scalar('select status from student_relationships'), 'revoked');
  assert.equal(await scalar('select revoked_at is not null from student_relationship_invites'), true);
  assert.equal(await scalar('select revoked and revoked_at is not null from student_invites'), true, 'legacy athlete token cannot restore access');
  assert.equal(await scalar('select finish_lgpd_deletion_request($1, $2, $3)', [first.id, first.processing_token, 'PHOTO_CLEANUP_FAILED']), true);
  assert.equal((await db.query('select * from claim_lgpd_deletion_requests()')).rows.length, 0, 'backoff prevents immediate loop');
  await db.query(`update data_subject_requests set next_attempt_at = now() - interval '1 minute' where id = $1`, [first.id]);
  const retry = (await db.query('select * from claim_lgpd_deletion_requests()')).rows[0];
  assert.notEqual(retry.processing_token, first.processing_token);
  await assert.rejects(db.query('select * from prepare_lgpd_student_anonymization($1, $2)', [first.id, first.processing_token]), /STALE_PROCESSING_LEASE/);
  assert.equal(await scalar('select photo_object_path from prepare_lgpd_student_anonymization($1, $2)', [retry.id, retry.processing_token]), `${org}/s1/avatar`, 'checkpoint preserves cleanup after photo_url cleared');
  assert.equal(await scalar(`select revision from scouting_sessions where id='game1'`), 6, 'retry does not repeatedly invalidate session revisions');
  assert.equal(await scalar(`select revision from scouting_video_documents where fingerprint='video-s1'`), 2, 'retry does not rewrite already-sanitized documents');
  assert.equal(await scalar('select finish_lgpd_deletion_request($1, $2)', [first.id, first.processing_token]), false, 'old worker cannot finish new lease');
  assert.equal(await scalar('select finish_lgpd_deletion_request($1, $2)', [retry.id, retry.processing_token]), true);
  assert.equal(await scalar('select status from data_subject_requests where id = $1', [retry.id]), 'completed');
  assert.equal(await scalar('select reason from data_subject_requests where id = $1', [retry.id]),
    'Saneamento dos dados estruturados concluído e consentimentos removidos', 'completion describes its structured-data scope');
  assert.equal((await db.query('select * from claim_lgpd_deletion_requests()')).rows.length, 0, 'completed jobs never replay');

  await db.query(`insert into data_subject_requests (user_id, student_id, request_type, status, updated_at)
    values ($1, 's1', 'deletion', 'processing', now() - interval '1 hour')`, [user]);
  const recovered = (await db.query('select * from claim_lgpd_deletion_requests()')).rows[0];
  assert.ok(recovered, 'pre-migration stuck processing is recoverable');
  await db.query(`update data_subject_requests set processing_started_at = now() - interval '1 hour', processing_attempts = 5 where id = $1`, [recovered.id]);
  assert.equal((await db.query('select * from claim_lgpd_deletion_requests()')).rows.length, 0);
  assert.equal(await scalar('select processing_error_code from data_subject_requests where id = $1', [recovered.id]), 'RETRY_LIMIT_REACHED');

  // A failed Storage job from before this migration already has anonymized_at.
  // It must still remove the newly covered copies, without deriving a new target
  // from photo_url/current profile or invalidating revisions on each retry.
  await db.exec(`
    insert into students(id,owner_id,organization_id,classid,name,address,gender_identity,photo_url)
      values ('s4','${user}','${org}','c1','Aluno anonimizado','legacy address','legacy gender',null);
    insert into athlete_intakes(id,organization_id,student_id,full_name,notes)
      values ('intake-legacy','${org}','s4','Legacy Athlete','legacy medical note');
    insert into scouting_actions(id,session_id,organization_id,classid,student_id,athlete_name,fundamental,phase,result_key,result_label,result_level)
      values ('action-legacy','game1','${org}','c1','s4','Legacy Athlete','saque','saque','ace','Ace',3);
    insert into data_subject_requests(user_id,student_id,request_type,status,anonymized_at,cleanup_photo_path)
      values ('${user}','s4','deletion','failed',now()-interval '1 day','retained-checkpoint/s4/avatar');
  `);
  const legacy = (await db.query('select * from claim_lgpd_deletion_requests()')).rows[0];
  assert.equal(await scalar('select photo_object_path from prepare_lgpd_student_anonymization($1,$2)', [legacy.id, legacy.processing_token]), 'retained-checkpoint/s4/avatar', 'older server-owned cleanup targets must not be recomputed');
  assert.equal(await scalar(`select address is null and gender_identity is null from students where id='s4'`), true);
  assert.equal(await scalar(`select count(*)::integer from athlete_intakes where id='intake-legacy'`), 0);
  assert.equal(await scalar(`select athlete_name from scouting_actions where id='action-legacy'`), 'Aluno anonimizado');
  assert.equal(await scalar(`select revision from scouting_sessions where id='game1'`), 7);
  assert.equal(await scalar('select photo_object_path from prepare_lgpd_student_anonymization($1,$2)', [legacy.id, legacy.processing_token]), 'retained-checkpoint/s4/avatar');
  assert.equal(await scalar(`select revision from scouting_sessions where id='game1'`), 7, 'same-lease retries are also idempotent');
  assert.equal(await scalar('select finish_lgpd_deletion_request($1,$2)', [legacy.id, legacy.processing_token]), true);
  assert.equal((await db.query('select * from claim_lgpd_deletion_requests()')).rows.length, 0);
  console.log('[lgpd-sql] PASS: current profile/intake copies, scoped scouting/video redaction, replay conflicts, atomic rollback, leases and legacy retry checkpoints');
} finally {
  await db.close();
}
