import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
try {
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
 create table public.user_profiles(user_id uuid primary key, birth_date date, cpf_masked text, cpf_encrypted bytea, cpf_encryption_version smallint, rg text, address text, gender_identity text, updated_at timestamptz);`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20261009230000_optional_professional_profile_birth_date.sql', import.meta.url),'utf8'));
 await assert.rejects(db.query('select public.save_my_professional_profile(null)'), /AUTH_REQUIRED/);
 await db.exec(`set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001'; set role authenticated;`);
 await db.query("select public.save_my_professional_profile(null, '', 'RG teste', '', '')");
 await assert.rejects(db.query("select public.save_my_professional_profile(current_date + 1)"), /INVALID_BIRTH_DATE/);
 await assert.rejects(db.query("select public.save_my_professional_profile(null, '123')"), /INVALID_CPF_FORMAT/);
 await db.exec('reset role');
 const rows = (await db.query('select birth_date, rg from public.user_profiles')).rows;
 assert.equal(rows.length,1); assert.equal(rows[0].birth_date,null); assert.equal(rows[0].rg,'RG teste');
 await db.exec(`update public.user_profiles set cpf_masked = '***.***.***-00'; set role authenticated;`);
 await db.query("select public.save_my_professional_profile('1990-01-01', null)");
 await db.query('select public.save_my_professional_profile(null, null)');
 await db.exec('reset role');
 const saved=(await db.query('select birth_date, cpf_masked from public.user_profiles')).rows[0];
 assert.equal(saved.birth_date,null); assert.equal(saved.cpf_masked,'***.***.***-00');
 console.log('Optional professional profile SQL passed (isolated).');
} finally { await db.close(); }
