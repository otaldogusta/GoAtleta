import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const authorizationSource = readFileSync(
  resolve(__dirname, "../notification-authorization.ts"),
  "utf8",
);
const contentSource = readFileSync(
  resolve(__dirname, "../notification-content.ts"),
  "utf8",
);

describe("canonical notification content contract", () => {
  test("returns the principals used by the delivery decision", () => {
    expect(authorizationSource).toContain(
      "export type NotificationDeliveryAuthorization",
    );
    expect(authorizationSource).toContain("sender: NotificationPrincipal");
    expect(authorizationSource).toContain("recipient: NotificationPrincipal");
    expect(authorizationSource).toContain(
      "Promise<NotificationDeliveryAuthorization>",
    );
    expect(authorizationSource).toContain(
      "return { ...decision, sender, recipient }",
    );
  });

  test("canonicalizes source-bound types before privileged passthrough", () => {
    const resolverSource = contentSource.slice(
      contentSource.indexOf(
        "export async function resolveAuthorizedNotificationContent",
      ),
    );
    const consultationBranch = resolverSource.indexOf(
      'if (params.type === "consultation_event")',
    );
    const absenceBranch = resolverSource.indexOf(
      'params.type === "absence_notice_created"',
    );
    const genericBranch = resolverSource.indexOf(
      'if (params.type === "generic")',
    );
    const passthroughBranch = resolverSource.indexOf(
      'if (params.mode === "self" || params.mode === "admin")',
    );

    expect(consultationBranch).toBeGreaterThan(-1);
    expect(absenceBranch).toBeGreaterThan(consultationBranch);
    expect(genericBranch).toBeGreaterThan(absenceBranch);
    expect(passthroughBranch).toBeGreaterThan(genericBranch);
    expect(resolverSource).toContain(
      'params.sourceType === "consultation"',
    );
    expect(resolverSource).toContain(
      'params.sourceType === "absence_notice"',
    );
    expect(resolverSource).toContain(
      'params.sourceType === "student_context_event"',
    );
    expect(resolverSource).toContain("if (params.sourceType) return null");
    expect(resolverSource).toContain(
      'params.mode !== "self" && params.mode !== "admin"',
    );
  });

  test("binds canonical sources to real organization, student and class rows", () => {
    expect(contentSource).toContain('.from("prescribed_workouts")');
    expect(contentSource).toContain('.from("workout_execution_logs")');
    expect(contentSource).toContain('.from("absence_notices")');
    expect(contentSource).toContain('.from("student_context_events")');
    expect(contentSource).toContain('.from("student_class_enrollments")');
    expect(contentSource).toContain('.from("class_staff")');
    expect(
      contentSource.match(/\.eq\("organization_id", params\.organizationId\)/g)
        ?.length,
    ).toBeGreaterThanOrEqual(6);
    expect(contentSource).toContain(
      "if (!studentClassIds.includes(notice.class_id)) return null",
    );
    expect(contentSource).toContain(
      '.eq("created_by", params.senderUserId)',
    );
    expect(contentSource).toContain(
      'const selfMember = params.mode === "self" && params.recipientRoleLevel > 0',
    );
  });

  test("derives consultation identifiers and visible content from stored rows", () => {
    expect(contentSource).toContain(
      "canonicalWorkoutId = executionLog.workout_id",
    );
    expect(contentSource).toContain(
      "canonicalExecutionLogId = executionLog.id",
    );
    expect(contentSource).toContain(
      "Number(executionLog.pain_level ?? 0) < 7",
    );
    expect(contentSource).toContain("title: event.title");
    expect(contentSource).toContain("body: event.summary");
  });
});
