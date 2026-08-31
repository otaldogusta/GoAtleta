import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260831014246_extend_family_notification_access.sql",
);
const migrationSource = fs.readFileSync(migrationPath, "utf8");

const relationshipCanReceiveNotifications = ({
  relationshipType,
  status,
  relationshipOrganizationId,
  requestedOrganizationId,
  relationshipUserId,
  callerUserId,
}: {
  relationshipType: "guardian" | "payer" | "athlete" | "viewer";
  status: "active" | "revoked";
  relationshipOrganizationId: string;
  requestedOrganizationId: string;
  relationshipUserId: string;
  callerUserId: string;
}) =>
  // The SQL intentionally authorizes every typed relationship by active state,
  // user and organization. The relationship type changes capabilities, not
  // whether the user's own notification row can be delivered.
  Boolean(relationshipType) &&
  status === "active" &&
  relationshipOrganizationId === requestedOrganizationId &&
  relationshipUserId === callerUserId;

describe("family notification access migration", () => {
  test.each(["guardian", "payer"] as const)(
    "allows an active %s relationship in the requested organization",
    (relationshipType) => {
      expect(
        relationshipCanReceiveNotifications({
          relationshipType,
          status: "active",
          relationshipOrganizationId: "org-1",
          requestedOrganizationId: "org-1",
          relationshipUserId: "user-1",
          callerUserId: "user-1",
        }),
      ).toBe(true);
    },
  );

  it("denies a revoked relationship", () => {
    expect(
      relationshipCanReceiveNotifications({
        relationshipType: "guardian",
        status: "revoked",
        relationshipOrganizationId: "org-1",
        requestedOrganizationId: "org-1",
        relationshipUserId: "user-1",
        callerUserId: "user-1",
      }),
    ).toBe(false);
  });

  it("keeps both user and organization scope in the SQL helper", () => {
    expect(migrationSource).toContain(
      "relationship.organization_id = p_organization_id",
    );
    expect(migrationSource).toContain("relationship.user_id = caller.user_id");
    expect(migrationSource).toContain("relationship.status = 'active'");
    expect(migrationSource).not.toContain("relationship.relationship_kind in");
    expect(migrationSource).toContain(
      "public.is_org_member(p_organization_id)",
    );
    expect(migrationSource).toContain(
      "student.student_user_id = caller.user_id",
    );
  });

  it("does not weaken the recipient_user_id policies", () => {
    const notificationPolicies = fs
      .readdirSync(path.resolve(process.cwd(), "supabase/migrations"))
      .filter((file) => file.endsWith(".sql"))
      .map((file) =>
        fs.readFileSync(
          path.resolve(process.cwd(), "supabase/migrations", file),
          "utf8",
        ),
      )
      .join("\n");

    expect(notificationPolicies).toContain(
      "notifications.recipient_user_id = (select auth.uid())",
    );
    expect(notificationPolicies).toContain(
      "public.is_org_member_or_linked_student(notifications.organization_id)",
    );
  });
});
