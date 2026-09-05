import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const migration = (name) => readFile(resolve(root, "supabase/migrations", name), "utf8");
const org = "11111111-1111-4111-8111-111111111111";
const otherOrg = "22222222-2222-4222-8222-222222222222";
const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const athlete = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const payer = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function extractFunction(source, name) {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `Missing real function ${name}`);
  const end = source.indexOf("\n$$;", start);
  assert.ok(end > start);
  return source.slice(start, end + 4);
}

export async function runFinanceAuditSql() {
  const db = new PGlite();
  const checks = [];
  const query = (sql, params = []) => db.query(sql, params);
  const scalar = async (sql, params = []) => (await query(sql, params)).rows[0].value;
  try {
    // Only pre-existing cross-domain dependencies are fixtures. Relationships,
    // financial tables, constraints, RPCs and the changes under test are real SQL.
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema private;
      grant usage on schema private, auth to authenticated, service_role;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('app.user_id',true),'')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create table public.organizations(id uuid primary key, name text not null);
      create table public.students(id text primary key, organization_id uuid not null references public.organizations,
        name text, student_user_id uuid references auth.users, login_email text, createdat text,
        guardian_name text, membership_status text default 'active', unique(id,organization_id));
      create function public.has_org_member_permission(p_org_id uuid,p_permission text) returns boolean language sql stable
        as $$ select p_org_id::text = current_setting('app.allowed_org',true) and auth.uid() is not null $$;
      create function public.can_manage_student_invites(p_student_id text,p_org_id uuid) returns boolean language sql stable
        as $$ select public.has_org_member_permission(p_org_id,'students') $$;
      select set_config('app.user_id','${actor}',false), set_config('app.allowed_org','${org}',false);
      insert into auth.users(id,email) values('${actor}','staff@example.test'),('${athlete}','athlete@example.test'),('${payer}','payer@example.test');
      insert into public.organizations values('${org}','Test'),('${otherOrg}','Other');
      insert into public.students(id,organization_id,name) values('student-1','${org}','Atleta');
    `);
    const family = await migration("20260831005113_family_access_foundation.sql");
    await db.exec(family.slice(0, family.indexOf("create or replace function public.get_my_student_contexts_v1")));
    await db.exec(extractFunction(family, "create_student_relationship_invite_v1"));
    await db.exec(extractFunction(family, "claim_student_relationship_invite_v1"));
    await db.exec(await migration("20260831005127_finance_foundation.sql"));
    await db.exec(await migration("20260901000346_pause_tuition_agreements_on_payer_revocation.sql"));
    await db.exec(await migration("20260901160250_add_asaas_receivables_connector.sql"));
    await db.exec(await migration("20260902110857_rotate_asaas_receivables_key.sql"));
    await db.exec(await migration("20260903174500_update_student_family_relationship.sql"));

    const connect = (environment, account) => query(
      "select public.connect_asaas_receivables_v1($1,$2,$3,'APPROVED','fake',repeat('x',48),repeat('i',16),$4,$5)",
      [org, environment, account, "a".repeat(64), actor],
    );
    await connect("sandbox", "sandbox-wallet");
    await query(`insert into public.provider_receivables(organization_id,provider,external_payment_id,external_customer_id,provider_status,billing_type,amount_cents,due_date)
      values($1,'asaas','legacy-payment','customer-1','RECEIVED','PIX',50000,'2026-09-01')`, [org]);
    await query("insert into public.finance_provider_sync_runs(organization_id,provider,environment,started_by) values($1,'asaas','sandbox',$2)", [org,athlete]);
    const legacyReceipt = await scalar("select row_to_json(r) as value from public.provider_receivables r where external_payment_id='legacy-payment'");
    await db.exec(await migration("20260905173743_finance_provider_atomic_scope.sql"));
    await db.exec(await migration("20260905173752_family_identity_and_payer_lifecycle.sql"));
    assert.equal(await scalar("select count(*)::integer as value from public.provider_receivables where connection_id is null"), 1);
    checks.push("legacy import preserved in quarantine without invented provenance");

    const currentScope = () => scalar("select connection_id as value from public.merchant_accounts where organization_id=$1", [org]);
    const sandboxScope = await currentScope();
    const legacyInserts = [
      "insert into public.provider_customers(organization_id,provider,external_customer_id,display_name) values($1,'asaas','old-customer','Old customer')",
      "insert into public.provider_receivables(organization_id,provider,external_payment_id,external_customer_id,provider_status,billing_type,amount_cents) values($1,'asaas','old-payment','customer-1','RECEIVED','PIX',100)",
      "insert into public.provider_subscriptions(organization_id,provider,external_subscription_id,external_customer_id,provider_status,billing_type,billing_cycle,amount_cents) values($1,'asaas','old-subscription','customer-1','ACTIVE','PIX','MONTHLY',100)",
      "insert into public.provider_events(organization_id,provider,external_event_id,event_type,payload_hash) values($1,'asaas','old-event','PAYMENT_RECEIVED',repeat('e',64))",
      "insert into public.finance_provider_sync_runs(organization_id,provider,environment) values($1,'asaas','sandbox')",
    ];
    for (const statement of legacyInserts) {
      await assert.rejects(() => query(statement,[org]), {code: "23514", message: "ASAAS_CONNECTION_SCOPE_REQUIRED"});
    }
    assert.equal(await scalar("select count(*)::integer as value from public.provider_events"), 0);
    checks.push("old handlers cannot insert unscoped customers, receipts, subscriptions, events or sync runs");
    await assert.rejects(() => query("update public.provider_receivables set amount_cents=999 where external_payment_id='legacy-payment'"), /ASAAS_CONNECTION_SCOPE_REQUIRED/);
    await assert.rejects(() => query("update public.finance_provider_sync_runs set error_code='legacy_writer' where connection_id is null"), /ASAAS_CONNECTION_SCOPE_REQUIRED/);
    assert.deepEqual(await scalar("select row_to_json(r)::jsonb - 'connection_id' as value from public.provider_receivables r where external_payment_id='legacy-payment'"), legacyReceipt);
    checks.push("legacy updates without scope fail and leave all historical receipt fields unchanged");
    await assert.rejects(() => query("insert into public.provider_events(organization_id,provider,connection_id,external_event_id,event_type,payload_hash) values($1,'asaas',$2,'wrong-org','PAYMENT_RECEIVED',repeat('e',64))",[otherOrg,sandboxScope]), {code: "23503"});
    assert.equal(await scalar("select count(*)::integer as value from public.provider_events where external_event_id='wrong-org'"), 0);
    checks.push("a non-null connection cannot bypass the composite organization foreign key");
    await query("insert into public.provider_events(organization_id,provider,external_event_id,event_type,payload_hash) values($1,'mock','mock-event','PAYMENT_RECEIVED',repeat('e',64))",[org]);
    await assert.rejects(() => query("insert into public.provider_events(organization_id,provider,external_event_id,event_type,payload_hash) values($1,'mock','mock-event','PAYMENT_RECEIVED',repeat('e',64))",[org]), {code: "23505"});
    checks.push("non-Asaas foundation event deduplication remains intact");
    const payment = (id, amount = 10000) => ({
      external_payment_id: id, external_customer_id: "customer-1", provider_status: "RECEIVED",
      billing_type: "PIX", amount_cents: amount, net_amount_cents: amount - 100,
      due_date: "2026-09-01", paid_at: "2026-09-01T12:00:00Z", match_status: "unmatched",
    });
    const process = (eventId, value, scope = sandboxScope) => scalar(
      "select public.process_asaas_event_v2($1,$2,$3,'PAYMENT_RECEIVED',$4,'2026-09-01T12:00:00Z',$5::jsonb,null) as value",
      [org, scope, eventId, "b".repeat(64), JSON.stringify(value)],
    );
    await assert.rejects(() => process("retry-event", payment("payment-retry", -100)));
    assert.equal(await scalar("select count(*)::integer as value from public.provider_events where external_event_id='retry-event'"), 0);
    assert.equal((await process("retry-event", payment("payment-retry"))).duplicate, false);
    assert.equal((await process("retry-event", payment("payment-retry"))).duplicate, true);
    assert.equal(await scalar("select count(*)::integer as value from public.provider_receivables where external_payment_id='payment-retry'"), 1);
    checks.push("projection failure rolls back receipt; retry commits once; replay is idempotent");

    const concurrent = await Promise.all([
      process("concurrent-event", payment("payment-concurrent")),
      process("concurrent-event", payment("payment-concurrent")),
    ]);
    assert.deepEqual(concurrent.map((result) => result.duplicate).sort(), [false, true]);
    assert.equal(await scalar("select count(*)::integer as value from public.provider_events where external_event_id='concurrent-event'"), 1);
    // PGlite serializes submitted transactions on its one connection. This runs
    // real SQL constraints + replay, not a multi-connection PostgreSQL load test.
    checks.push("concurrent submissions produce one event and one projection (PGlite serialized connection)");

    await query("insert into public.provider_events(organization_id,provider,connection_id,external_event_id,event_type,payload_hash,processing_status) values($1,'asaas',$2,'failed-existing','PAYMENT_RECEIVED',$3,'failed')", [org,sandboxScope,"b".repeat(64)]);
    assert.equal((await process("failed-existing", payment("payment-failed-existing"))).duplicate, false);
    checks.push("already persisted failed event is retried instead of acknowledged as delivered");

    await query("select public.disconnect_asaas_receivables_v1($1,$2)", [org, actor]);
    await connect("production", "production-wallet");
    const productionScope = await currentScope();
    assert.notEqual(sandboxScope, productionScope);
    await assert.rejects(() => process("old-credential-event", payment("blocked"), sandboxScope), /ASAAS_ACCOUNT_SCOPE_MISMATCH/);
    await process("retry-event", payment("payment-retry", 20000), productionScope);
    assert.equal(await scalar("select count(*)::integer as value from public.provider_receivables where external_payment_id='payment-retry'"), 2);
    checks.push("reconnect separates accounts/environments and permits the same external IDs without overwriting history");

    const page = (offset = 0, pageOrg = org, month = "2026-09-01") => scalar(
      "select public.get_organization_provider_receivables_v2($1,$2,250,$3) as value", [pageOrg,month,offset]);
    await query(`insert into public.provider_receivables(organization_id,provider,connection_id,external_payment_id,external_customer_id,provider_status,billing_type,amount_cents,net_amount_cents,due_date,paid_at)
      select $1,'asaas',$2,'bulk-'||n,'customer-1','RECEIVED','PIX',10000,9900,'2026-09-02','2026-09-02T12:00:00Z' from generate_series(1,300) n`, [org,productionScope]);
    const first = await page();
    const second = await page(250);
    assert.equal(first.items.length, 250);
    assert.equal(second.items.length, 51);
    assert.equal(first.summary.total_count, 301);
    assert.equal(first.summary.received_gross_cents, 3020000);
    assert.deepEqual(first.summary, second.summary);
    assert.equal(new Set([...first.items,...second.items].map((item) => item.receivable_id)).size, 301);
    assert.equal(first.quarantined_count, 1);
    await assert.rejects(() => page(0,otherOrg), /NOT_AUTHORIZED/);
    await db.exec("set role authenticated");
    assert.equal((await page()).summary.total_count, 301);
    await assert.rejects(() => process("client-must-not-write", payment("blocked-client"), productionScope), /permission denied/);
    await assert.rejects(() => query("select * from public.finance_provider_connections"), /permission denied/);
    await db.exec("reset role");
    checks.push("all 301 receipts aggregated independently from 250-row pages; cross-org reads rejected");
    checks.push("authenticated client can read its projection but cannot invoke service-only processing or read connection identities");

    await query(`insert into public.provider_receivables(organization_id,provider,connection_id,external_payment_id,external_customer_id,provider_status,billing_type,amount_cents,due_date)
      values($1,'asaas',$2,'august','customer-1','PENDING','PIX',10000,'2026-08-05')`, [org,productionScope]);
    assert.deepEqual((await page()).months, ["2026-09", "2026-08"]);
    checks.push("month navigation includes provider-only history");

    // A pending invite predating the new guard must also be rejected at claim.
    const token = "c".repeat(64);
    const invite = await scalar("select invite_id as value from public.create_student_relationship_invite_v1($1,'student-1',$2,'athlete@example.test','guardian','Responsável','link')", [org,token]);
    assert.ok(invite);
    const athleteRelationship = await scalar(`insert into public.student_relationships(organization_id,student_id,user_id,contact_email,relationship_kind,status,can_view_financial,can_pay)
      values($1,'student-1',$2,'athlete@example.test','athlete','active',true,true) returning id as value`, [org,athlete]);
    await query("update public.students set student_user_id=$1,login_email='athlete@example.test' where id='student-1'", [athlete]);
    await assert.rejects(() => query("select public.claim_student_relationship_invite_v1($1,$2,'athlete@example.test')", [token,athlete]), /ATHLETE_RELATIONSHIP_IMMUTABLE/);
    await assert.rejects(() => query("select public.create_student_relationship_invite_v1($1,'student-1',$2,'athlete@example.test','guardian','Responsável','link')", [org,"d".repeat(64)]), /ATHLETE_RELATIONSHIP_IMMUTABLE/);
    await assert.rejects(() => query("select public.update_student_relationship_v1($1,'guardian','Responsável',true,true,true,true,false,false,true,true)", [athleteRelationship]), /ATHLETE_RELATIONSHIP_IMMUTABLE/);
    assert.equal(await scalar("select relationship_kind as value from public.student_relationships where id=$1", [athleteRelationship]), "athlete");
    checks.push("create and claim reject conversion of athlete identity, including pre-existing invitations");

    const payerRelationship = await scalar(`insert into public.student_relationships(organization_id,student_id,user_id,contact_email,relationship_kind,status,can_view_financial,can_pay)
      values($1,'student-1',$2,'payer@example.test','guardian','active',true,true) returning id as value`, [org,payer]);
    const plan = await scalar("select public.create_tuition_plan_v1($1,'Mensal',10000,10,'plan-key',null) as value", [org]);
    const agreement = await scalar("select public.create_tuition_agreement_v1($1,'student-1',$2,$3,'2026-09-01','agreement-key') as value", [org,plan,payerRelationship]);
    await query("select public.update_student_relationship_v1($1,'guardian','Responsável',true,true,true,true,false,false,true,false)", [payerRelationship]);
    assert.equal(await scalar("select status as value from public.tuition_agreements where id=$1", [agreement]), "paused");
    assert.equal(await scalar("select count(*)::integer as value from public.finance_audit_events where entity_id=$1 and action='paused_payer_ineligible'", [agreement]), 1);
    await query("select public.update_student_relationship_v1($1,'guardian','Responsável',true,true,true,true,false,false,true,false)", [payerRelationship]);
    assert.equal(await scalar("select count(*)::integer as value from public.finance_audit_events where entity_id=$1 and action='paused_payer_ineligible'", [agreement]), 1);
    checks.push("payer permission removal pauses the real agreement and audits once across retries");
    await query("select public.update_student_relationship_v1($1,'guardian','Responsável',true,true,true,true,false,false,true,true)", [payerRelationship]);
    await query("update public.tuition_agreements set status='active' where id=$1", [agreement]);
    await query("select public.revoke_student_relationship_v1($1,'Access removed',false)", [payerRelationship]);
    assert.equal(await scalar("select status as value from public.tuition_agreements where id=$1", [agreement]), "paused");
    assert.equal(await scalar("select count(*)::integer as value from public.finance_audit_events where entity_id=$1 and action='paused_payer_ineligible'", [agreement]), 2);
    checks.push("full revocation uses the same audited payer eligibility transition as permission edits");
    await query("select public.revoke_student_relationship_v1($1,'Requested by institution',true)", [athleteRelationship]);
    assert.equal(await scalar("select student_user_id as value from public.students where id='student-1'"), null);
    checks.push("explicit athlete revocation clears legacy self-access");
    await query("delete from auth.users where id=$1", [athlete]);
    assert.equal(await scalar("select user_id as value from public.student_relationships where id=$1", [athleteRelationship]), null);
    checks.push("identity guard preserves ON DELETE SET NULL for account deletion and retained finance history");
    assert.equal(await scalar("select count(*)::integer as value from public.finance_provider_sync_runs where connection_id is null and started_by is null"), 1);
    checks.push("account deletion detaches the legacy sync author without changing or deleting its history");
    return checks;
  } finally {
    await db.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runFinanceAuditSql().then((checks) => {
    for (const check of checks) console.log(`PASS ${check}`);
    console.log(`${checks.length} finance SQL scenarios passed`);
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
