import {
  decideNotificationDelivery,
  type NotificationPrincipal,
} from "../notification-authorization-policy";

const principal = (
  overrides: Partial<NotificationPrincipal> = {},
): NotificationPrincipal => ({
  isMember: false,
  roleLevel: 0,
  isLinkedStudent: false,
  staffClassIds: [],
  studentClassIds: [],
  permissionOverrides: {},
  ...overrides,
});

const decide = (params: {
  sender?: NotificationPrincipal;
  recipient?: NotificationPrincipal;
  senderUserId?: string;
  recipientUserId?: string;
  notificationType?: string;
  sourceType?: string;
}) =>
  decideNotificationDelivery({
    senderUserId: params.senderUserId ?? "sender-1",
    recipientUserId: params.recipientUserId ?? "recipient-1",
    notificationType: params.notificationType ?? "generic",
    sourceType: params.sourceType ?? "",
    sender: params.sender ?? principal(),
    recipient: params.recipient ?? principal(),
  });

describe("notification delivery authorization policy", () => {
  test("rejects a sender outside the organization", () => {
    expect(
      decide({ recipient: principal({ isMember: true }) }),
    ).toEqual({ allowed: false, reason: "sender_not_linked", mode: null });
  });

  test("allows a linked principal to create a notification only for itself", () => {
    expect(
      decide({
        senderUserId: "same-user",
        recipientUserId: "same-user",
        sender: principal({ isLinkedStudent: true }),
        recipient: principal({ isLinkedStudent: true }),
      }),
    ).toEqual({ allowed: true, reason: "allowed", mode: "self" });
  });

  test("allows organization administrators to reach any linked recipient", () => {
    expect(
      decide({
        sender: principal({ isMember: true, roleLevel: 50 }),
        recipient: principal({ isLinkedStudent: true }),
      }),
    ).toEqual({ allowed: true, reason: "allowed", mode: "admin" });
  });

  test("allows class staff to reach only students in a shared class", () => {
    const sender = principal({
      isMember: true,
      roleLevel: 10,
      staffClassIds: ["class-a"],
    });

    expect(
      decide({
        sender,
        recipient: principal({
          isLinkedStudent: true,
          studentClassIds: ["class-a"],
        }),
      }),
    ).toEqual({ allowed: true, reason: "allowed", mode: "staff" });
    expect(
      decide({
        sender,
        recipient: principal({
          isLinkedStudent: true,
          studentClassIds: ["class-b"],
        }),
      }),
    ).toEqual({
      allowed: false,
      reason: "relationship_denied",
      mode: null,
    });
  });

  test.each([
    ["consultation_event", "consultation", "students"],
    ["absence_notice_created", "absence_notice", "absence_notices"],
    ["generic", "student_context_event", "classes"],
  ])(
    "denies %s from %s when %s has an explicit false override",
    (notificationType, sourceType, permissionKey) => {
      const sender = principal({
        isMember: true,
        roleLevel: 10,
        staffClassIds: ["class-a"],
        permissionOverrides: { [permissionKey]: false },
      });
      const recipient = principal({
        isLinkedStudent: true,
        studentClassIds: ["class-a"],
      });

      expect(
        decide({ sender, recipient, notificationType, sourceType }),
      ).toEqual({ allowed: false, reason: "permission_denied", mode: null });
    },
  );

  test("uses sourceType when resolving the permission required by a generic event", () => {
    const sender = principal({
      isMember: true,
      roleLevel: 10,
      staffClassIds: ["class-a"],
      permissionOverrides: { classes: false },
    });
    const recipient = principal({
      isLinkedStudent: true,
      studentClassIds: ["class-a"],
    });

    expect(decide({ sender, recipient, notificationType: "generic" })).toEqual({
      allowed: true,
      reason: "allowed",
      mode: "staff",
    });
    expect(
      decide({
        sender,
        recipient,
        notificationType: "generic",
        sourceType: "student_context_event",
      }),
    ).toEqual({ allowed: false, reason: "permission_denied", mode: null });
  });

  test("allows linked students to notify responsible staff only for approved events", () => {
    const sender = principal({
      isLinkedStudent: true,
      studentClassIds: ["class-a"],
    });
    const recipient = principal({
      isMember: true,
      roleLevel: 10,
      staffClassIds: ["class-a"],
    });

    expect(
      decide({
        sender,
        recipient,
        notificationType: "consultation_event",
      }),
    ).toEqual({ allowed: true, reason: "allowed", mode: "student" });
    expect(decide({ sender, recipient, notificationType: "generic" })).toEqual({
      allowed: false,
      reason: "student_event_not_allowed",
      mode: null,
    });
  });

  test("does not let a linked student notify unrelated staff", () => {
    expect(
      decide({
        sender: principal({
          isLinkedStudent: true,
          studentClassIds: ["class-a"],
        }),
        recipient: principal({
          isMember: true,
          roleLevel: 10,
          staffClassIds: ["class-b"],
        }),
        notificationType: "absence_notice_created",
      }),
    ).toEqual({
      allowed: false,
      reason: "relationship_denied",
      mode: null,
    });
  });
});
