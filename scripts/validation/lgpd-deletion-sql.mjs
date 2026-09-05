import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Isolated PostgreSQL, synthetic identities only. This never opens a remote DB.
const db = new PGlite();
const migration = async (name) => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const user = '10000000-0000-0000-0000-000000000001';
const org = '20000000-0000-0000-0000-000000000001';
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema private;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${user}');
    create table public.students (
      id text primary key, owner_id uuid, organization_id uuid, name text not null,
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
    create table public.student_class_enrollments (student_id text, class_id text);
    create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    create function private.set_lgpd_updated_at() returns trigger language plpgsql as
      'begin new.updated_at := now(); return new; end';
  `);
  // Use the actual DSR schema, policies and timestamp trigger, not a simplified job table.
  await db.exec(await migration('20260708142000_create_data_subject_requests.sql'));
  await db.exec(await migration('20260905173939_recover_lgpd_deletion_processing.sql'));
  await db.exec(`
    grant usage on schema public, private, auth to authenticated, service_role;
    grant all on all tables in schema public to authenticated, service_role;
    insert into students (id, owner_id, organization_id, name, photo_url, health_issue_notes)
      values ('s1', '${user}', '${org}', 'Synthetic Athlete', 'untrusted/object/url', 'synthetic health');
    insert into consents (student_id) values ('s1');
    insert into student_relationships (student_id, organization_id, status) values ('s1', '${org}', 'active');
    insert into student_relationship_invites (student_id, organization_id) values ('s1', '${org}');
    insert into student_invites (student_id, organization_id) values ('s1', '${org}');
    select set_config('request.jwt.claim.sub', '${user}', false);
    set role authenticated;
  `);
  await assert.rejects(db.query('select * from claim_lgpd_deletion_requests()'), /permission denied/);
  await assert.rejects(db.query(`insert into data_subject_requests (user_id, student_id, request_type, anonymized_at, cleanup_photo_path)
    values ($1, 's1', 'deletion', now(), 'other-org/private/avatar')`, [user]), /SERVER_OWNED_PROCESSING_STATE/);
  await db.query(`insert into data_subject_requests (user_id, student_id, request_type) values ($1, 's1', 'deletion')`, [user]);
  await db.exec('set role service_role');
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
  assert.equal(await scalar('select anonymized_at from data_subject_requests where id = $1', [first.id]), null);
  await db.exec('reset role');
  await db.exec('drop trigger fail_consents_delete on consents');
  await db.exec('set role service_role');
  assert.equal(await scalar('select photo_object_path from prepare_lgpd_student_anonymization($1, $2)', [first.id, first.processing_token]), `${org}/s1/avatar`);
  assert.equal(await scalar(`select name from students where id = 's1'`), 'Aluno anonimizado');
  assert.equal(await scalar(`select health_issue_notes from students where id = 's1'`), null);
  assert.equal(await scalar('select count(*)::integer from consents'), 0);
  assert.equal(await scalar('select status from student_relationships'), 'revoked');
  assert.equal(await scalar('select revoked_at is not null from student_relationship_invites'), true);
  assert.equal(await scalar('select revoked and revoked_at is not null from student_invites'), true, 'legacy athlete token cannot restore access');
  assert.equal(await scalar('select finish_lgpd_deletion_request($1, $2, $3)', [first.id, first.processing_token, 'PHOTO_CLEANUP_FAILED']), true);
  assert.equal((await db.query('select * from claim_lgpd_deletion_requests()')).rows.length, 0, 'backoff prevents immediate loop');
  await db.query(`update data_subject_requests set next_attempt_at = now() - interval '1 minute' where id = $1`, [first.id]);
  const retry = (await db.query('select * from claim_lgpd_deletion_requests()')).rows[0];
  assert.notEqual(retry.processing_token, first.processing_token);
  assert.equal(await scalar('select photo_object_path from prepare_lgpd_student_anonymization($1, $2)', [retry.id, retry.processing_token]), `${org}/s1/avatar`, 'checkpoint preserves cleanup after photo_url cleared');
  assert.equal(await scalar('select finish_lgpd_deletion_request($1, $2)', [first.id, first.processing_token]), false, 'old worker cannot finish new lease');
  assert.equal(await scalar('select finish_lgpd_deletion_request($1, $2)', [retry.id, retry.processing_token]), true);
  assert.equal(await scalar('select status from data_subject_requests where id = $1', [retry.id]), 'completed');
  assert.equal((await db.query('select * from claim_lgpd_deletion_requests()')).rows.length, 0, 'completed jobs never replay');

  await db.query(`insert into data_subject_requests (user_id, student_id, request_type, status, updated_at)
    values ($1, 's1', 'deletion', 'processing', now() - interval '1 hour')`, [user]);
  const recovered = (await db.query('select * from claim_lgpd_deletion_requests()')).rows[0];
  assert.ok(recovered, 'pre-migration stuck processing is recoverable');
  await db.query(`update data_subject_requests set processing_started_at = now() - interval '1 hour', processing_attempts = 5 where id = $1`, [recovered.id]);
  assert.equal((await db.query('select * from claim_lgpd_deletion_requests()')).rows.length, 0);
  assert.equal(await scalar('select processing_error_code from data_subject_requests where id = $1', [recovered.id]), 'RETRY_LIMIT_REACHED');
  console.log('[lgpd-sql] PASS: ownership, leases, atomic rollback, retry checkpoint, backoff and retry limit');
} finally {
  await db.close();
}
