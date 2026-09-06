import * as members from "../../../../api/members";
import { adminListOrgAccessRequests } from "../../../../api/organization-access-requests";
import * as reports from "../../../../api/reports";
import { listTrainerInvites } from "../../../../api/trainer-invite";
import { getSignals } from "../../../../ai/signal-engine";
import type { ClassGroup } from "../../../../core/models";
import { getClasses } from "../../../../db/classes";
import { getPendingWritesDiagnostics, listPendingWriteFailures } from "../../../../db/nfc-sync";
import { getSessionLogsByRange } from "../../../../db/session";
import { loadCoordinationDashboard } from "../load-coordination-dashboard";
import { loadCoordinationInsights } from "../load-coordination-insights";

jest.mock("../../../../api/members", () => ({
  adminListOrgMembers: jest.fn(), adminListOrgMemberClassAssignments: jest.fn(),
  adminListOrgMemberClassHeads: jest.fn(), adminListOrgClasses: jest.fn(),
}));
jest.mock("../../../../api/organization-access-requests", () => ({ adminListOrgAccessRequests: jest.fn() }));
jest.mock("../../../../api/reports", () => ({
  listAdminPendingAttendance: jest.fn(), listAdminPendingSessionLogs: jest.fn(), listAdminRecentActivity: jest.fn(),
}));
jest.mock("../../../../api/trainer-invite", () => ({ listTrainerInvites: jest.fn() }));
jest.mock("../../../../db/classes", () => ({ getClasses: jest.fn() }));
jest.mock("../../../../db/nfc-sync", () => ({ getPendingWritesDiagnostics: jest.fn(), listPendingWriteFailures: jest.fn() }));
jest.mock("../../../../db/session", () => ({ getSessionLogsByRange: jest.fn() }));
jest.mock("../../../../ai/signal-engine", () => ({ getSignals: jest.fn() }));

beforeEach(() => {
  jest.resetAllMocks();
  for (const load of [
    members.adminListOrgMembers, members.adminListOrgMemberClassAssignments,
    members.adminListOrgMemberClassHeads, members.adminListOrgClasses,
    adminListOrgAccessRequests, reports.listAdminPendingAttendance,
    reports.listAdminPendingSessionLogs, reports.listAdminRecentActivity,
    getClasses, listPendingWriteFailures, getSessionLogsByRange, getSignals,
  ]) jest.mocked(load).mockResolvedValue([]);
  jest.mocked(getPendingWritesDiagnostics).mockResolvedValue({
    total: 0, highRetry: 0, maxRetry: 0, deadLetterCandidates: 0, deadLetterStored: 0,
  });
  jest.mocked(listTrainerInvites).mockResolvedValue({ invites: [] });
});

it("uses the explicit organization for every critical remote read and joins schedules by ID", async () => {
  jest.mocked(getClasses).mockResolvedValue([
    { id: "a", daysOfWeek: [1, 3], startTime: "18:00", endTime: "19:00" } as ClassGroup,
  ]);
  jest.mocked(members.adminListOrgClasses).mockResolvedValue([
    { id: "b", name: "Another class", unit: "B" }, { id: "a", name: "Class A", unit: "A" },
  ]);
  const data = await loadCoordinationDashboard("org-a");
  for (const load of [reports.listAdminPendingAttendance, reports.listAdminPendingSessionLogs, getClasses]) {
    expect(load).toHaveBeenCalledWith({ organizationId: "org-a" });
  }
  for (const load of [members.adminListOrgMembers, members.adminListOrgMemberClassAssignments,
    members.adminListOrgClasses, listTrainerInvites, adminListOrgAccessRequests]) {
    expect(load).toHaveBeenCalledWith("org-a");
  }
  expect(data.organizationClasses).toEqual([
    { id: "b", name: "Another class", unit: "B", daysOfWeek: [], startTime: "", endTime: "" },
    { id: "a", name: "Class A", unit: "A", daysOfWeek: [1, 3], startTime: "18:00", endTime: "19:00" },
  ]);
  expect(members.adminListOrgMemberClassHeads).not.toHaveBeenCalled();
});

it.each([
  ["members", members.adminListOrgMembers], ["invites", listTrainerInvites],
  ["attendance", reports.listAdminPendingAttendance], ["requests", adminListOrgAccessRequests],
])("propagates a critical %s failure instead of publishing an empty result", async (_label, load) => {
  const error = new Error("Row level security");
  jest.mocked(load).mockRejectedValue(error);
  await expect(loadCoordinationDashboard("org-a")).rejects.toBe(error);
});

it("preserves the legacy assignment fallback within the requested organization", async () => {
  jest.mocked(members.adminListOrgMemberClassAssignments).mockRejectedValue(new Error("legacy schema"));
  const heads = [{ userId: "teacher", classId: "a", className: "Class A", unit: "A" }];
  jest.mocked(members.adminListOrgMemberClassHeads).mockResolvedValue(heads);
  expect((await loadCoordinationDashboard("org-a")).memberClassHeads).toEqual(heads);
  expect(members.adminListOrgMemberClassHeads).toHaveBeenCalledWith("org-a");
  jest.mocked(members.adminListOrgMemberClassHeads).mockRejectedValue(new Error("denied"));
  await expect(loadCoordinationDashboard("org-a")).rejects.toThrow("denied");
});

it("loads optional intelligence within the same organization and seven-day interval", async () => {
  const data = await loadCoordinationInsights("org-a", [], new Date("2026-09-05T12:00:00Z"));
  expect(getSessionLogsByRange).toHaveBeenCalledWith(
    "2026-08-29T12:00:00.000Z", "2026-09-05T12:00:00.000Z", { organizationId: "org-a" },
  );
  expect(reports.listAdminRecentActivity).toHaveBeenCalledWith({ organizationId: "org-a", limit: 12 });
  expect(getSignals).toHaveBeenCalledWith({ organizationId: "org-a" });
  expect(data).toEqual({ recentActivity: [], signals: [], classRadarItems: [] });
});

it("rejects an absent organization before any read starts", async () => {
  await expect(loadCoordinationDashboard(" ")).rejects.toThrow("Organização");
  await expect(loadCoordinationInsights("", [])).rejects.toThrow("Organização");
  expect(getClasses).not.toHaveBeenCalled();
  expect(getSignals).not.toHaveBeenCalled();
});
