import {
  adminListOrgClasses,
  adminListOrgMemberClassAssignments,
  adminListOrgMemberClassHeads,
  adminListOrgMembers,
} from "../../../api/members";
import { adminListOrgAccessRequests } from "../../../api/organization-access-requests";
import {
  listAdminPendingAttendance,
  listAdminPendingSessionLogs,
} from "../../../api/reports";
import { listTrainerInvites } from "../../../api/trainer-invite";
import type { ClassGroup } from "../../../core/models";
import { getClasses } from "../../../db/classes";
import { getPendingWritesDiagnostics, listPendingWriteFailures } from "../../../db/nfc-sync";

// Critical reads form one snapshot: a failed permission/member query must never
// be presented as an empty, successfully loaded organization.
export async function loadCoordinationDashboard(organizationId: string) {
  if (!organizationId.trim()) throw new Error("Organização não informada.");
  const [
    pendingAttendance, pendingReports, classes, pendingWritesDiagnostics,
    failedWrites, organizationMembers, memberClassHeads, classRows,
    invites, pendingAccessRequests,
  ] = await Promise.all([
    listAdminPendingAttendance({ organizationId }),
    listAdminPendingSessionLogs({ organizationId }),
    getClasses({ organizationId }),
    getPendingWritesDiagnostics(10),
    listPendingWriteFailures(12),
    adminListOrgMembers(organizationId),
    adminListOrgMemberClassAssignments(organizationId)
      .catch(() => adminListOrgMemberClassHeads(organizationId)),
    adminListOrgClasses(organizationId),
    listTrainerInvites(organizationId),
    adminListOrgAccessRequests(organizationId),
  ]);

  const scheduleByClassId = new Map(classes.map((classGroup) => [classGroup.id, classGroup]));
  const organizationClasses = classRows.map((classGroup) => {
    const schedule = scheduleByClassId.get(classGroup.id);
    return {
      ...classGroup,
      daysOfWeek: schedule?.daysOfWeek ?? [],
      startTime: schedule?.startTime ?? "",
      endTime: schedule?.endTime ?? "",
    };
  });

  return {
    classes, pendingAttendance, pendingReports, pendingWritesDiagnostics,
    failedWrites, organizationMembers, memberClassHeads, organizationClasses,
    pendingTrainerInvites: invites.invites, pendingAccessRequests,
  };
}

// Keep the intelligence engine outside the initial workspace bundle.
export async function loadCoordinationInsights(
  organizationId: string,
  classes: readonly ClassGroup[],
  now = new Date(),
) {
  if (!organizationId.trim()) throw new Error("Organização não informada.");
  const module = await import("./load-coordination-insights");
  return module.loadCoordinationInsights(organizationId, classes, now);
}

export type CoordinationDashboardData = Awaited<ReturnType<typeof loadCoordinationDashboard>>;
export type { CoordinationInsights } from "./load-coordination-insights";
