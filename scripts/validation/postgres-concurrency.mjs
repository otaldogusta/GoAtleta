import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { initializeFinanceAuditDatabase } from "./finance-audit-sql.mjs";
import { withDockerPostgres } from "./docker-postgres.mjs";

const migration = (name) => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;

await withDockerPostgres(async ({ connect }) => {
  const observer = await connect("audit_observer");
  const { org, actor } = await initializeFinanceAuditDatabase({ exec: (sql) => observer.run(sql) });
  await observer.run(await migration("20260905173743_finance_provider_atomic_scope.sql"));
  await observer.run(`select public.connect_asaas_receivables_v1('${org}', 'sandbox',
    'synthetic-wallet', 'APPROVED', 'fake', repeat('x',48), repeat('i',16), repeat('a',64), '${actor}');`);
  const scope = await observer.run("select connection_id from public.merchant_accounts;");
  const first = await connect("audit_first");
  const second = await connect("audit_second");
  await first.run("set role service_role;");
  await second.run("set role service_role;");
  const event = (id, hash = "b") => {
    const payment = { external_payment_id: `payment-${id}`, external_customer_id: "synthetic-customer",
      provider_status: "RECEIVED", billing_type: "PIX", amount_cents: 10000,
      net_amount_cents: 9900, due_date: "2026-09-01", match_status: "unmatched" };
    return `select public.process_asaas_event_v2('${org}', '${scope}', ${literal(id)},
      'PAYMENT_RECEIVED', repeat('${hash}',64), '2026-09-01T12:00:00Z', ${literal(JSON.stringify(payment))}::jsonb, null);`;
  };
  const count = (table, id) => observer.run(`select count(*) from public.${table}
    where ${table === "provider_events" ? "external_event_id" : "external_payment_id"} = ${literal(table === "provider_events" ? id : `payment-${id}`)};`);
  const waitForLock = async () => {
    const deadline = Date.now() + 8000;
    while (await observer.run("select count(*) from pg_stat_activity where application_name='audit_second' and wait_event_type='Lock';") !== "1") {
      assert.ok(Date.now() < deadline, "second connection must demonstrably wait for the first transaction");
      await delay(50);
    }
  };

  await first.run(`begin; ${event("commit")}`);
  const replay = second.run(event("commit"));
  await waitForLock();
  assert.equal(await count("provider_events", "commit"), "0", "uncommitted event must remain invisible");
  assert.equal(await count("provider_receivables", "commit"), "0", "uncommitted projection must remain invisible");
  const independent = await connect("audit_independent");
  await independent.run("set role service_role;");
  assert.equal(JSON.parse(await independent.run(event("independent"))).duplicate, false,
    "a different event can complete while the first event is locked");
  await first.run("commit;");
  assert.equal(JSON.parse(await replay).duplicate, true);
  assert.equal(await count("provider_events", "commit"), "1");
  assert.equal(await count("provider_receivables", "commit"), "1");
  console.log("PASS overlapping duplicate waits for commit and produces one atomic projection; unrelated event progresses");

  await first.run(`begin; ${event("rollback")}`);
  const retry = second.run(event("rollback"));
  await waitForLock();
  await first.run("rollback;");
  assert.equal(JSON.parse(await retry).duplicate, false, "waiting retry must take ownership after rollback");
  assert.equal(await count("provider_events", "rollback"), "1");
  assert.equal(await count("provider_receivables", "rollback"), "1");
  console.log("PASS rollback releases ownership and the waiting retry commits once");

  await first.run(`begin; ${event("mismatch")}`);
  // Attach the rejection handler before releasing the lock to avoid an unhandled rejection.
  const mismatch = assert.rejects(second.run(event("mismatch", "c")), /PROVIDER_EVENT_PAYLOAD_MISMATCH/);
  await waitForLock();
  await first.run("commit;");
  await mismatch;
  assert.equal(await count("provider_receivables", "mismatch"), "1");
  assert.equal(await observer.run("select payload_hash from public.provider_events where external_event_id='mismatch';"), "b".repeat(64));
  console.log("PASS concurrent payload mismatch is rejected without overwriting the committed event");

  const workers = await Promise.all(Array.from({ length: 12 }, (_, i) => connect(`audit_burst_${i}`)));
  await Promise.all(workers.map((worker) => worker.run("set role service_role;")));
  const results = await Promise.all(workers.map((worker) => worker.run(event("burst"))));
  assert.equal(results.filter((result) => !JSON.parse(result).duplicate).length, 1);
  assert.equal(await count("provider_events", "burst"), "1");
  assert.equal(await count("provider_receivables", "burst"), "1");
  console.log("PASS 12 independent connections replay the same event with exactly one writer");
});
