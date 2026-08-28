import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const createNotificationSource = readFileSync(
  resolve(__dirname, "../../create-notification/index.ts"),
  "utf8"
);
const sendPushSource = readFileSync(
  resolve(__dirname, "../../send-push/index.ts"),
  "utf8"
);
const authorizationSource = readFileSync(
  resolve(__dirname, "../notification-authorization.ts"),
  "utf8"
);

describe("notification recipient organization access contract", () => {
  test("routes notification creation through relationship authorization", () => {
    expect(createNotificationSource).toContain(
      'import { authorizeNotificationDelivery }'
    );
    expect(createNotificationSource).toContain(
      "authorization = await authorizeNotificationDelivery({"
    );
    expect(createNotificationSource).toContain("senderUserId: user.id");
    expect(createNotificationSource).toContain(
      "notificationType: typeValidation.data"
    );
  });

  test("applies the same relationship authorization before push delivery", () => {
    expect(sendPushSource).toContain(
      'import { authorizeNotificationDelivery }'
    );
    expect(sendPushSource).toContain(
      "authorization = await authorizeNotificationDelivery({"
    );
    expect(sendPushSource).toContain("recipientUserId: targetUserId");
    expect(sendPushSource).toContain("notificationType");
  });

  test("loads membership, linked student and class responsibility in the requested organization", () => {
    expect(authorizationSource).toContain('.from("organization_members")');
    expect(authorizationSource).toContain('.from("students")');
    expect(authorizationSource).toContain('.from("class_staff")');
    expect(authorizationSource).toContain(
      '.from("student_class_enrollments")'
    );
    expect(authorizationSource.match(/\.eq\("organization_id", organizationId\)/g)?.length)
      .toBeGreaterThanOrEqual(4);
    expect(authorizationSource).toContain('.eq("student_user_id", userId)');
    expect(authorizationSource).toContain('.eq("user_id", userId)');
  });

  test("rejects denied relationships before service-role writes or token reads", () => {
    expect(createNotificationSource.indexOf("if (!authorization.allowed)"))
      .toBeLessThan(createNotificationSource.indexOf('.from("notifications")'));
    expect(sendPushSource.indexOf("if (!authorization.allowed)"))
      .toBeLessThan(sendPushSource.indexOf('.from("push_tokens")'));
    expect(createNotificationSource).toContain(
      'authorization.reason === "recipient_not_linked"'
    );
    expect(sendPushSource).toContain(
      'authorization.reason === "recipient_not_linked"'
    );
  });

  test("requires a matching stored notification for non-admin push delivery", () => {
    expect(sendPushSource).toContain(
      'if (authorization.mode === "admin")'
    );
    expect(sendPushSource).toContain("if (!notificationId)");
    expect(sendPushSource).toContain('.from("notifications")');
    expect(sendPushSource).toContain('.eq("id", notificationId)');
    expect(sendPushSource).toContain(
      '.eq("organization_id", organizationId)'
    );
    expect(sendPushSource).toContain(
      "storedNotification.organization_id === organizationId"
    );
    expect(sendPushSource).toContain(
      "storedNotification.actor_user_id === user.id"
    );
    expect(sendPushSource).toContain(
      "storedNotification.recipient_user_id === targetUserId"
    );
    expect(sendPushSource).toContain(
      "storedNotification.type === notificationType"
    );
    expect(sendPushSource).toContain("storedSourceType === sourceType");
    expect(sendPushSource.indexOf('.from("notifications")'))
      .toBeLessThan(sendPushSource.indexOf('.from("push_tokens")'));
  });

  test("uses canonical stored content instead of non-admin client content", () => {
    expect(sendPushSource.indexOf("validateStringField(payload.title"))
      .toBeGreaterThan(sendPushSource.indexOf('authorization.mode === "admin"'));
    expect(sendPushSource).toContain(
      "deliveryTitle = storedTitleValidation.data"
    );
    expect(sendPushSource).toContain(
      "deliveryBody = storedBodyValidation.data"
    );
    expect(sendPushSource).toContain(
      "deliveryData = canonicalDataValidation.data"
    );
    expect(sendPushSource).toContain(
      'route: storedNotification.action_url ?? "/communications"'
    );
    expect(sendPushSource).toContain(
      "notificationId: storedNotification.id"
    );
    expect(sendPushSource).toContain("...storedMetadataValidation.data");
  });
});
