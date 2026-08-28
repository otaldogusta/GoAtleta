import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  decideNotificationDelivery,
  type NotificationDeliveryDecision,
  type NotificationPrincipal,
} from "./notification-authorization-policy.ts";

type MembershipRow = { role_level?: number | null };
type StudentLinkRow = { id: string; classid?: string | null };
type ClassIdRow = { class_id: string };
type PermissionRow = { permission_key: string; is_allowed: boolean };

export type NotificationDeliveryAuthorization = NotificationDeliveryDecision & {
  sender: NotificationPrincipal;
  recipient: NotificationPrincipal;
};

const uniqueClassIds = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)),
  );

const requireRows = <T>(
  result: { data: T | null; error: { message: string } | null },
): T => {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Notification authorization query failed.");
  return result.data;
};

async function loadPrincipal(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<NotificationPrincipal> {
  const [membershipResult, studentLinksResult, staffRowsResult, permissionsResult] =
    await Promise.all([
      supabase
        .from("organization_members")
        .select("role_level")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .maybeSingle<MembershipRow>(),
      supabase
        .from("students")
        .select("id,classid")
        .eq("organization_id", organizationId)
        .eq("student_user_id", userId)
        .returns<StudentLinkRow[]>(),
      supabase
        .from("class_staff")
        .select("class_id")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .returns<ClassIdRow[]>(),
      supabase
        .from("organization_member_permissions")
        .select("permission_key,is_allowed")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .returns<PermissionRow[]>(),
    ]);

  if (membershipResult.error) throw new Error(membershipResult.error.message);
  const studentLinks = requireRows(studentLinksResult);
  const staffRows = requireRows(staffRowsResult);
  const permissionRows = requireRows(permissionsResult);
  const directStudentClassIds = uniqueClassIds(
    studentLinks.map((student) => student.classid),
  );

  let enrolledClassIds: string[] = [];
  if (studentLinks.length) {
    const enrollmentsResult = await supabase
      .from("student_class_enrollments")
      .select("class_id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .in(
        "student_id",
        studentLinks.map((student) => student.id),
      )
      .returns<ClassIdRow[]>();
    enrolledClassIds = uniqueClassIds(
      requireRows(enrollmentsResult).map((row) => row.class_id),
    );
  }

  const roleLevel = Number(membershipResult.data?.role_level ?? 0);
  return {
    isMember: Boolean(membershipResult.data),
    roleLevel: Number.isFinite(roleLevel) ? roleLevel : 0,
    isLinkedStudent: studentLinks.length > 0,
    staffClassIds: uniqueClassIds(staffRows.map((row) => row.class_id)),
    studentClassIds: uniqueClassIds([
      ...directStudentClassIds,
      ...enrolledClassIds,
    ]),
    permissionOverrides: Object.fromEntries(
      permissionRows.map((row) => [row.permission_key, Boolean(row.is_allowed)]),
    ),
  };
}

export async function authorizeNotificationDelivery(params: {
  supabase: SupabaseClient;
  organizationId: string;
  senderUserId: string;
  recipientUserId: string;
  notificationType: string;
  sourceType: string;
}): Promise<NotificationDeliveryAuthorization> {
  const [sender, recipient] = await Promise.all([
    loadPrincipal(params.supabase, params.organizationId, params.senderUserId),
    loadPrincipal(
      params.supabase,
      params.organizationId,
      params.recipientUserId,
    ),
  ]);

  const decision = decideNotificationDelivery({
    senderUserId: params.senderUserId,
    recipientUserId: params.recipientUserId,
    notificationType: params.notificationType,
    sourceType: params.sourceType,
    sender,
    recipient,
  });
  return { ...decision, sender, recipient };
}
