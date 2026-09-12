import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const registerSource = readFileSync(resolve(__dirname, "../../register-web-push/index.ts"), "utf8");
const sendSource = readFileSync(resolve(__dirname, "../../send-push/index.ts"), "utf8");
const serviceWorkerSource = readFileSync(resolve(__dirname, "../../../../public/push-sw.js"), "utf8");
const migration = readFileSync(
  resolve(__dirname, "../../../migrations/20260912005606_add_web_push_subscriptions.sql"),
  "utf8",
);

describe("web push security contract", () => {
  test("keeps capability URLs private and unique", () => {
    expect(migration).toContain("alter table public.web_push_subscriptions enable row level security");
    expect(migration).toContain("web_push_subscriptions_endpoint_unique unique (endpoint)");
    expect(migration).toContain("revoke all on table public.web_push_subscriptions from public, anon, authenticated");
    expect(migration).toContain("grant select, insert, update, delete on table public.web_push_subscriptions to service_role");
  });

  test("authenticates and checks organization access before registration", () => {
    expect(registerSource).toContain("client.auth.getUser(token)");
    expect(registerSource).toContain('.from("organization_members")');
    expect(registerSource).toContain('.from("students")');
    expect(registerSource.indexOf("if (!linked)"))
      .toBeLessThan(registerSource.indexOf('.from("web_push_subscriptions").upsert'));
  });

  test("delivers through VAPID and prunes expired browser endpoints", () => {
    expect(sendSource).toContain('from("web_push_subscriptions")');
    expect(sendSource).toContain("WEB_PUSH_VAPID_PRIVATE_KEY");
    expect(sendSource).toContain("webpush.sendNotification");
    expect(sendSource).toContain("code === 404 || code === 410");
    expect(sendSource).toContain("invalidWebSubscriptions");
  });

  test("opens only same-origin routes and resolves route parameters", () => {
    expect(serviceWorkerSource).toContain('route.startsWith("/")');
    expect(serviceWorkerSource).toContain("self.location.origin");
    expect(serviceWorkerSource).toContain("route.replace(placeholder");
    expect(serviceWorkerSource).toContain("URLSearchParams");
  });
});
