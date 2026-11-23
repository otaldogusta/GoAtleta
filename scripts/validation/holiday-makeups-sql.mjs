import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const org = "70000000-0000-4000-8000-000000000001";
const other = "70000000-0000-4000-8000-000000000002";
const admin = "50000000-0000-4000-8000-000000000001";
const staff = "50000000-0000-4000-8000-000000000002";
const outsider = "50000000-0000-4000-8000-000000000003";
const migration = async name => db.exec(await readFile(new URL("../../supabase/migrations/" + name, import.meta.url), "utf8"));
async function asUser(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec("set role authenticated");
}
const schedule = (cls = "a", origin = "2026-11-20", date = "2026-11-23", time = "14:00", scope = org) =>
  db.query("select public.schedule_holiday_makeup($1,$2,$3,$4,$5)", [scope, cls, origin, date, time]);
const visible = async () => (await db.query("select class_id from public.class_holiday_makeups order by class_id")).rows.map(r => r.class_id);

try {
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${admin}'),('${staff}'),('${outsider}');
    create function auth.uid() returns uuid language sql as
      'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create table organizations(id uuid primary key);
    insert into organizations values ('${org}'),('${other}');
    create table classes(id text primary key,organization_id uuid,days jsonb);
    insert into classes values ('a','${org}','[5]'),('b','${org}','[5]'),('c','${org}','[5]'),('foreign','${other}','[5]');
    create function public.is_org_admin(id uuid) returns boolean language sql as
      $$ select (auth.uid() = '${admin}' and id = '${org}') or (auth.uid() = '${outsider}' and id = '${other}') $$;
    create function public.is_org_member(id uuid) returns boolean language sql as
      $$ select public.is_org_admin(id) or (auth.uid() = '${staff}' and id = '${org}') $$;
    create function public.is_class_staff(id text) returns boolean language sql as
      $$ select auth.uid() = '${staff}' and id = 'a' $$;
    create table attendance_logs(organization_id uuid,classid text,date date);
    create table attendance_checkins(organization_id uuid,class_id text,checked_in_at timestamptz);
    create table session_logs(organization_id uuid,classid text,createdat timestamptz);
    create table training_sessions(id text primary key,organization_id uuid,start_at timestamptz,status text);
    create table training_session_classes(organization_id uuid,class_id text,session_id text);
    create table organization_activity_reviews(organization_id uuid,class_ids text[],reason text,resolution text,new_date date,start_date date,end_date date);
    grant usage on schema auth to authenticated;
  `);
  await migration("202603101540_create_class_calendar_exceptions.sql");
  await migration("20260907214642_organization_holiday_decisions.sql");
  await migration("20261123200000_class_holiday_makeups.sql");
  await migration("20261123201000_guard_holiday_makeup_reviews.sql");
  await migration("20261123202000_fix_makeup_session_log_dates.sql");

  for (const reportType of ["timestamptz", "text"]) {
    await db.exec("begin");
    if (reportType === "text") {
      await db.exec("alter table session_logs alter column createdat type text using createdat::text");
      await migration("20261123202000_fix_makeup_session_log_dates.sql");
    }
    await db.exec("set local timezone = 'America/Sao_Paulo'");
    for (const instant of ["2026-11-20T00:00:00.000Z", "2026-11-23T23:59:59.999Z"]) {
      await db.query("insert into session_logs values ($1,'a',$2)", [org, instant]);
      await asUser(admin);
      await db.exec("savepoint before_conflict");
      await assert.rejects(schedule(), /Já existe chamada ou aula registrada/);
      await db.exec("rollback to savepoint before_conflict");
      await db.exec("reset role");
      await db.exec("delete from session_logs");
    }
    await db.query("insert into session_logs values ($1,'a',$2),($1,'a',$3)",
      [org, "2026-11-19T23:59:59.999Z", "2026-11-24T00:00:00.000Z"]);
    await asUser(admin);
    await schedule("a", "2026-11-20", "2026-11-23", "18:00");
    assert.deepEqual(await visible(), ["a"]);
    await db.exec("rollback");
  }

  await db.exec("set role anon");
  await assert.rejects(schedule(), /permission denied/);
  await asUser("");
  await assert.rejects(schedule(), /coordenação/);
  await asUser(admin);
  await assert.rejects(schedule("foreign"), /Turma indisponível/);
  await assert.rejects(schedule("foreign", undefined, undefined, undefined, other), /coordenação/);
  await assert.rejects(schedule("a","2026-11-20","2026-11-20"), /Confira/);
  await assert.rejects(schedule("a",undefined,undefined,"24:00"), /Confira/);
  await assert.rejects(schedule("a","2026-11-19"), /dia de aula/);
  await assert.rejects(schedule("a","2026-11-13"), /feriado reconhecido/);
  await assert.rejects(schedule("a",undefined,"2026-11-27"), /dia livre/);

  // Friday initially has no pause. A single RPC confirms that pause and schedules Monday.
  await schedule();
  await schedule();
  await assert.rejects(schedule("a", undefined, undefined, "15:30"), /já tem reposição/);
  await assert.rejects(schedule("a", undefined, "2026-11-24"), /já tem reposição/);
  assert.deepEqual(await visible(), ["a"]);
  assert.equal((await db.query("select reason from class_calendar_exceptions where class_id='a'")).rows[0].reason, "Feriado");
  await assert.rejects(db.exec("delete from class_calendar_exceptions where class_id='a'"), /foreign key/);
  await assert.rejects(db.exec("delete from class_holiday_makeups"), /permission denied/);
  await asUser(staff);
  await assert.rejects(schedule("b"), /coordenação/);
  assert.deepEqual(await visible(), ["a"]);
  await asUser(outsider);
  assert.deepEqual(await visible(), []);
  await db.exec("reset role");
  await assert.rejects(db.exec(`insert into organization_activity_reviews values ('${org}',array['a'],'tournament','rescheduled','2026-11-23','2026-11-13','2026-11-13')`), /conflito/);
  await assert.rejects(db.exec(`insert into organization_activity_reviews values ('${org}',array['a'],'held',null,null,'2026-11-20','2026-11-20')`), /conflito/);
  await assert.rejects(db.exec(`insert into organization_holiday_decisions(organization_id,date,suspended_class_ids,decided_by) values ('${org}','2026-11-20','{}','${admin}')`), /reposição agendada/);
  await db.exec(`
    insert into class_calendar_exceptions(id,organization_id,class_id,date,kind,reason)
      values ('local','${org}','b','2026-11-13','no_training','Feriado: municipal');
    insert into attendance_logs values ('${org}','a','2026-11-23');
  `);
  await assert.rejects(db.exec(`insert into attendance_logs values ('${org}','a','2026-11-20')`), /data da reposição/);
  await assert.rejects(db.exec(`insert into attendance_checkins values ('${org}','a','2026-11-21T01:00Z')`), /data da reposição/);
  await assert.rejects(db.exec(`insert into class_calendar_exceptions(id,organization_id,class_id,date,kind) values ('later','${org}','a','2026-11-23','no_training')`), /existe uma reposição/);
  await asUser(admin);
  await schedule("b","2026-11-13");
  await assert.rejects(schedule("b","2026-11-20"), /dia livre/);
  assert.equal((await db.query("select reason from class_calendar_exceptions where id='local'")).rows[0].reason, "Feriado: municipal");
  assert.deepEqual(await visible(), ["a", "b"]);
  await asUser(staff);
  assert.deepEqual(await visible(), ["a"]);
  await db.exec("reset role");
  await db.exec(`insert into attendance_logs values ('${org}','c','2026-11-20')`);
  await asUser(admin);
  await assert.rejects(schedule("c"), /Já existe chamada/);
  assert.equal((await db.query("select id from class_calendar_exceptions where class_id='c'")).rows.length, 0);
  await db.exec("reset role");
  await db.exec(`delete from attendance_logs where classid='c';
    insert into organization_holiday_decisions(organization_id,date,suspended_class_ids,decided_by)
      values ('${org}','2026-11-20',array['a','b'],'${admin}');`);
  await asUser(admin);
  await assert.rejects(schedule("c"), /confirmada com aula/);
  console.log("Holiday makeup SQL passed: retroactive scheduling, preserved pauses, conflicts, attendance guards, retries and scoped access.");
} finally {
  await db.close();
}
