import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sendPushSource = readFileSync(
  resolve(__dirname, "../../send-push/index.ts"),
  "utf8",
);
const hardeningMigration = readFileSync(
  resolve(
    __dirname,
    "../../../migrations/20260828163724_harden_push_replay_and_token_limits.sql",
  ),
  "utf8",
);

describe("push delivery abuse hardening contract", () => {
  test("claims a persisted notification before reading tokens and rejects replay", () => {
    const claimIndex = sendPushSource.indexOf(
      '.rpc("claim_push_delivery"',
    );
    const tokenReadIndex = sendPushSource.indexOf('.from("push_tokens")');

    expect(sendPushSource).toContain(
      "const replayGuardNotificationId = notificationId || null",
    );
    expect(sendPushSource).toContain(
      "p_notification_id: replayGuardNotificationId",
    );
    expect(sendPushSource).toContain(
      'deliveryClaim.claim_status === "duplicate"',
    );
    expect(sendPushSource).toContain(
      'error: "Notification push delivery was already attempted."',
    );
    expect(claimIndex).toBeGreaterThan(-1);
    expect(claimIndex).toBeLessThan(tokenReadIndex);
    expect(sendPushSource).not.toMatch(
      /\.from\("push_deliveries"\)\s*\.insert/,
    );
  });

  test("enforces one delivery claim per persisted notification in the database", () => {
    expect(hardeningMigration).toContain(
      "add column if not exists notification_id uuid null",
    );
    expect(hardeningMigration).toContain(
      "create unique index if not exists push_deliveries_notification_once_idx",
    );
    expect(hardeningMigration).toContain("where notification_id is not null");
    expect(hardeningMigration).toContain(
      "notification.organization_id = p_organization_id",
    );
    expect(hardeningMigration).toContain(
      "notification.actor_user_id = p_from_user_id",
    );
    expect(hardeningMigration).toContain(
      "notification.recipient_user_id = p_to_user_id",
    );
  });

  test("rate limits every sender transactionally, including legacy admin sends", () => {
    expect(hardeningMigration).toContain(
      "create or replace function public.claim_push_delivery(",
    );
    expect(hardeningMigration).toContain("security definer");
    expect(hardeningMigration).toContain("pg_advisory_xact_lock");
    expect(hardeningMigration).toContain("v_recent_deliveries >= 30");
    expect(hardeningMigration).toContain("'rate_limited'::text");
    expect(hardeningMigration).toContain("to service_role");
    expect(sendPushSource).toContain(
      'deliveryClaim.claim_status === "rate_limited"',
    );
    expect(sendPushSource).toContain("{ status: 429");
  });

  test("keeps multiple devices but caps and validates Expo tokens", () => {
    expect(sendPushSource).toContain("const MAX_PUSH_TOKENS_PER_USER = 8");
    expect(sendPushSource).toContain(".limit(MAX_PUSH_TOKENS_PER_USER)");
    expect(sendPushSource).toContain(".filter(isValidExpoPushToken)");
    expect(hardeningMigration).toContain(
      "create trigger trg_push_tokens_registration_limit",
    );
    expect(hardeningMigration).toContain("v_registered_tokens >= 8");
    expect(hardeningMigration).toContain("pg_advisory_xact_lock");
    expect(hardeningMigration).toContain(
      "token.expo_push_token = new.expo_push_token",
    );
    expect(hardeningMigration).toContain(
      "Push token registration limit reached.",
    );
    expect(hardeningMigration).toContain(
      "^(ExponentPushToken|ExpoPushToken)",
    );
  });
});
