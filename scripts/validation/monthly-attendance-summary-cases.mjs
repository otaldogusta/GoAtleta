import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Reuses the canonical role/staff/substitution/RLS fixture of
// attendance-read-scopes-sql.mjs. Never opens a network connection.
export async function validateMonthlyAttendanceSummary(db, { actors, org, otherOrg, orphanOrg, asUser }) {
  const migration = await readFile(new URL('../../supabase/migrations/20261024210000_monthly_attendance_summary.sql', import.meta.url), 'utf8');
  let checks = 0;
  const call = async (organizationId = org, start = '2026-10-01', end = '2026-11-01') =>
    (await db.query('select public.get_monthly_attendance_summary_v1($1::uuid,$2::date,$3::date) as result', [organizationId, start, end])).rows[0].result;
  const rejects = async (load, code) => {
    await db.exec('savepoint rejected_summary');
    try { await assert.rejects(load, error => error.code === code); }
    finally { await db.exec('rollback to savepoint rejected_summary;release savepoint rejected_summary'); }
  };
  const expected = async organizationId => {
    const records = (await db.query(`select classid,date::text,status from public.attendance_logs
      where organization_id=$1 and date>='2026-10-01' and date<'2026-11-01' order by date,classid`, [organizationId])).rows;
    const groups = new Map();
    for (const record of records) {
      const key = JSON.stringify([record.classid, record.date]);
      const group = groups.get(key) ?? { classId: record.classid, date: record.date, total: 0, present: 0 };
      group.total += 1;
      group.present += record.status === 'faltou' ? 0 : 1;
      groups.set(key, group);
    }
    return { days: [...groups.values()] };
  };
  await db.exec('reset role;begin');
  try {
    const before = (await db.query(`select json_build_object(
      'tables',(select json_agg(x order by relname)from(select relname,relacl::text,relrowsecurity,relforcerowsecurity from pg_class where oid in('public.attendance_logs'::regclass,'public.students'::regclass,'public.classes'::regclass))x),
      'policies',(select json_agg(x order by tablename,policyname)from(select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public')x)
    )as value`)).rows[0].value;
    await db.exec(migration);
    await rejects(() => db.exec(migration), '42723');checks += 1;
    const properties = (await db.query(`select prosecdef,provolatile,proconfig,
      has_function_privilege('authenticated',oid,'execute') as auth,
      has_function_privilege('anon',oid,'execute') as anon,
      exists(select 1 from aclexplode(proacl)where grantee=0)as public
      from pg_proc where oid='public.get_monthly_attendance_summary_v1(uuid,date,date)'::regprocedure`)).rows[0];
    assert.equal(properties.prosecdef, false);assert.equal(properties.provolatile, 's');
    assert.equal(properties.auth, true);assert.equal(properties.anon, false);assert.equal(properties.public, false);
    assert.ok(properties.proconfig.includes('search_path=""'));checks += 6;
    for (const [name, actor] of Object.entries(actors)) {
      await asUser(actor);
      for (const id of [org, otherOrg, orphanOrg]) assert.deepEqual(await call(id), await expected(id), `${name}/${id}`);
      checks += 3;
    }
    await asUser('');assert.deepEqual(await call(), { days: [] });checks += 1;
    await asUser('', 'anon');await rejects(() => call(), '42501');checks += 1;
    // Invalid arguments must reject, never broaden a query or manufacture zero.
    await asUser(actors.admin);
    for (const args of [[null,'2026-10-01','2026-11-01'],[org,null,'2026-11-01'],[org,'2026-10-01',null],
      [org,'2026-10-02','2026-11-01'],[org,'2026-10-01','2026-10-31'],[org,'2026-10-01','2026-12-01'],
      [org,'infinity','infinity'],[org,'-infinity','2026-11-01']]) {
      await rejects(() => call(...args), '22023');checks += 1;
    }
    await db.exec('reset role');
    await db.query(`insert into public.attendance_logs(id,organization_id,classid,studentid,date,status)
      select 'summary-'||value,$1,'historical-'||value,'missing','2026-10-31',
        case when value%3=0 then 'faltou' when value%3=1 then 'legacy-value' else null end
      from generate_series(1,5001)value`, [org]);
    await db.query(`insert into public.attendance_logs(id,organization_id,classid,studentid,date,status)values
      ('before-summary',$1,'main','s-a','2026-09-30','presente'),('after-summary',$1,'main','s-a','2026-11-01','presente'),
      ('empty-class-summary',$1,'','missing','2026-10-31','presente'),('proto-class-summary',$1,'__proto__','missing','2026-10-31','presente'),
      ('constructor-class-summary',$1,'constructor','missing','2026-10-31','faltou')`, [org]);
    await asUser(actors.admin);
    const large = await call();
    assert.deepEqual(large, await expected(org));assert.ok(large.days.length > 5000);
    assert.equal(large.days.filter(row => row.classId.startsWith('historical-')).reduce((sum,row) => sum + row.present,0),3334);
    assert.ok(!large.days.some(row => row.date === '2026-09-30' || row.date === '2026-11-01'));checks += 4;
    await db.exec('reset role');
    const after = (await db.query(`select json_build_object(
      'tables',(select json_agg(x order by relname)from(select relname,relacl::text,relrowsecurity,relforcerowsecurity from pg_class where oid in('public.attendance_logs'::regclass,'public.students'::regclass,'public.classes'::regclass))x),
      'policies',(select json_agg(x order by tablename,policyname)from(select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public')x)
    )as value`)).rows[0].value;
    assert.deepEqual(after,before);checks += 1;
    await db.query('delete from public.organization_members where organization_id=$1 and user_id=$2',[org,actors.admin]);
    await asUser(actors.admin);assert.deepEqual(await call(),await expected(org));assert.deepEqual(await call(),{days:[]});checks += 2;
    console.log(JSON.stringify({suite:'monthly-attendance-summary',checks,roleActors:Object.keys(actors).length,largeGroups:large.days.length,network:false}));
  } finally {
    await db.exec('reset role;rollback');
  }
}
