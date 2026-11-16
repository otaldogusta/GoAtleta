import { listEvents, type EventListItem } from "../../../api/events";
import { getSessionIdentity, isSessionIdentityCurrent } from "../../../auth/session";
import { getActiveOrganizationId, getReadCacheGeneration } from "../../../db/client";
import { getClassStudentRecords } from "../../../db/students";
import { getTrainingPlanSummaries } from "../../../db/training";
import { loadHomeSearchRecords } from "../home-search-records";

jest.mock("../../../api/events", () => ({ listEvents: jest.fn() }));
jest.mock("../../../auth/session", () => ({ getSessionIdentity: jest.fn(), isSessionIdentityCurrent: jest.fn() }));
jest.mock("../../../db/client", () => ({ getActiveOrganizationId: jest.fn(), getReadCacheGeneration: jest.fn() }));
jest.mock("../../../db/students", () => ({ getClassStudentRecords: jest.fn() }));
jest.mock("../../../db/training", () => ({ getTrainingPlanSummaries: jest.fn() }));

const student = { id: "one", organizationId: "org-a", name: "Atleta fictício", classId: "class-a" };
const plan = { id: "one", classId: "class-a", title: "Plano fictício", tags: ["manchete"], applyDays: [], applyDate: "2026-11-16", createdAt: "2026-11-16" };
const event: EventListItem = {
  id: "one", organizationId: "org-a", ruleSetId: null, title: "Evento fictício", description: "",
  eventType: "torneio", sport: "geral", startsAt: "2026-11-16T12:00:00Z", endsAt: "2026-11-16T14:00:00Z",
  allDay: false, unitId: null, locationLabel: "Ginásio fictício", createdBy: "user-a", createdAt: "", updatedAt: "",
  classIds: [], hasMyClass: false,
};
const options = () => ({
  organizationId: "org-a",
  userId: "user-a",
  canReadStudents: true,
  canReadPlans: true,
  canReadEvents: true,
  signal: new AbortController().signal,
  now: new Date("2026-11-16T12:00:00Z"),
});

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getSessionIdentity).mockReturnValue({ userId: "user-a", generation: 1 });
  jest.mocked(isSessionIdentityCurrent).mockReturnValue(true);
  jest.mocked(getReadCacheGeneration).mockReturnValue(1);
  jest.mocked(getActiveOrganizationId).mockResolvedValue("org-a");
  jest.mocked(getClassStudentRecords).mockResolvedValue([student]);
  jest.mocked(getTrainingPlanSummaries).mockResolvedValue([plan]);
  jest.mocked(listEvents).mockResolvedValue([event]);
});

it("returns typed destinations and ignores students and events from another organization", async () => {
  jest.mocked(getClassStudentRecords).mockResolvedValue([student, { ...student, id: "foreign", organizationId: "org-b" }]);
  jest.mocked(listEvents).mockResolvedValue([event, { ...event, id: "foreign", organizationId: "org-b" }]);
  const input = options();
  const result = await loadHomeSearchRecords(input);
  expect(result.partialFailure).toBe(false);
  expect(result.entries.map(({ id, section, href }) => ({ id, section, href }))).toEqual([
    { id: "student:one", section: "Atletas", href: { pathname: "/coord/students", params: { studentProfile: "one" } } },
    { id: "plan:one", section: "Planos de aula", href: { pathname: "/coord/planning", params: { viewPlanId: "one" } } },
    { id: "event:one", section: "Eventos da agenda", href: { pathname: "/events/[id]", params: { id: "one" } } },
  ]);
  expect(getTrainingPlanSummaries).toHaveBeenCalledWith({ organizationId: "org-a", signal: input.signal });
  expect(listEvents).toHaveBeenCalledWith({
    organizationId: "org-a", fromIso: "2025-11-16T12:00:00.000Z", toIso: "2027-11-16T12:00:00.000Z", overlap: true,
  });
});

it("only requests sources the active role can read", async () => {
  const result = await loadHomeSearchRecords({ ...options(), canReadStudents: false, canReadEvents: false });
  expect(getClassStudentRecords).not.toHaveBeenCalled();
  expect(listEvents).not.toHaveBeenCalled();
  expect(result.entries.map(entry => entry.id)).toEqual(["plan:one"]);
});

it("opens records inside the professor workspace", async () => {
  const result = await loadHomeSearchRecords({ ...options(), profile: "prof", canReadEvents: false });
  expect(result.entries.map(entry => entry.href)).toEqual([
    { pathname: "/prof/students", params: { studentProfile: "one" } },
    { pathname: "/prof/planning", params: { viewPlanId: "one" } },
  ]);
  expect(listEvents).not.toHaveBeenCalled();
});

it("rejects an organization outside the active context before querying sources", async () => {
  const result = await loadHomeSearchRecords({ ...options(), organizationId: "org-b" });
  expect(getClassStudentRecords).not.toHaveBeenCalled();
  expect(getTrainingPlanSummaries).not.toHaveBeenCalled();
  expect(listEvents).not.toHaveBeenCalled();
  expect(result).toEqual({ entries: [], partialFailure: false });
});

it("discards results when the organization changes while a source is pending", async () => {
  const reader = jest.mocked(getClassStudentRecords);
  reader.mockImplementation(async () => {
    jest.mocked(getActiveOrganizationId).mockResolvedValue("org-b");
    return [student];
  });
  const result = await loadHomeSearchRecords(options());
  expect(reader).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ entries: [], partialFailure: false });
});

it("preserves results from successful sources after a partial failure", async () => {
  jest.mocked(getTrainingPlanSummaries).mockRejectedValue(new Error("Offline"));
  const result = await loadHomeSearchRecords(options());
  expect(result.partialFailure).toBe(true);
  expect(result.entries.map(entry => entry.id)).toEqual(["student:one", "event:one"]);
});
