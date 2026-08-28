export type NotificationPrincipal = {
  isMember: boolean;
  roleLevel: number;
  isLinkedStudent: boolean;
  staffClassIds: string[];
  studentClassIds: string[];
  permissionOverrides: Record<string, boolean>;
};

export type NotificationDeliveryDecision = {
  allowed: boolean;
  reason:
    | "allowed"
    | "sender_not_linked"
    | "recipient_not_linked"
    | "student_event_not_allowed"
    | "permission_denied"
    | "relationship_denied";
  mode: "self" | "admin" | "staff" | "student" | null;
};

const STUDENT_ORIGINATED_NOTIFICATION_TYPES = new Set([
  "consultation_event",
  "absence_notice_created",
]);

const hasClassIntersection = (left: string[], right: string[]) => {
  if (!left.length || !right.length) return false;
  const rightSet = new Set(right);
  return left.some((classId) => rightSet.has(classId));
};

const requiredPermission = (notificationType: string, sourceType: string) => {
  if (notificationType === "consultation_event") return "students";
  if (notificationType.startsWith("absence_notice_")) {
    return "absence_notices";
  }
  if (notificationType === "generic" && sourceType === "student_context_event") {
    return "classes";
  }
  return null;
};

export function decideNotificationDelivery(params: {
  senderUserId: string;
  recipientUserId: string;
  notificationType: string;
  sourceType: string;
  sender: NotificationPrincipal;
  recipient: NotificationPrincipal;
}): NotificationDeliveryDecision {
  const senderExists = params.sender.isMember || params.sender.isLinkedStudent;
  const recipientExists =
    params.recipient.isMember || params.recipient.isLinkedStudent;

  if (!senderExists) {
    return { allowed: false, reason: "sender_not_linked", mode: null };
  }
  if (!recipientExists) {
    return { allowed: false, reason: "recipient_not_linked", mode: null };
  }

  if (params.senderUserId === params.recipientUserId) {
    return { allowed: true, reason: "allowed", mode: "self" };
  }

  if (params.sender.isMember && params.sender.roleLevel >= 50) {
    return { allowed: true, reason: "allowed", mode: "admin" };
  }

  if (params.sender.isMember) {
    const permissionKey = requiredPermission(
      params.notificationType,
      params.sourceType,
    );
    if (
      permissionKey &&
      params.sender.permissionOverrides[permissionKey] === false
    ) {
      return { allowed: false, reason: "permission_denied", mode: null };
    }

    const canReachStudent =
      params.recipient.isLinkedStudent &&
      hasClassIntersection(
        params.sender.staffClassIds,
        params.recipient.studentClassIds,
      );
    const canReachMember =
      params.recipient.isMember &&
      (params.recipient.roleLevel >= 50 ||
        hasClassIntersection(
          params.sender.staffClassIds,
          params.recipient.staffClassIds,
        ));

    if (canReachStudent || canReachMember) {
      return { allowed: true, reason: "allowed", mode: "staff" };
    }
  }

  if (params.sender.isLinkedStudent) {
    if (!STUDENT_ORIGINATED_NOTIFICATION_TYPES.has(params.notificationType)) {
      return {
        allowed: false,
        reason: "student_event_not_allowed",
        mode: null,
      };
    }

    const canReachResponsible =
      params.recipient.isMember &&
      (params.recipient.roleLevel >= 50 ||
        hasClassIntersection(
          params.sender.studentClassIds,
          params.recipient.staffClassIds,
        ));
    if (canReachResponsible) {
      return { allowed: true, reason: "allowed", mode: "student" };
    }
  }

  return { allowed: false, reason: "relationship_denied", mode: null };
}
