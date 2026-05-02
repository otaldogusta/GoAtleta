import type { ClassGroup, ClassPlan } from "../../../../core/models";
import {
  buildPlanSessions,
  filterPlansWithSessionsInMonth,
  filterSessionsInMonth,
  planHasSessionInMonth,
} from "../monthly-session-filter";

const makePlan = (overrides: Partial<ClassPlan>): ClassPlan =>
  ({
    id: "plan-1",
    classId: "class-1",
    startDate: "2026-04-27",
    weekNumber: 18,
    phase: "base",
    theme: "Recepção",
    technicalFocus: "Manchete",
    physicalFocus: "Coordenação",
    constraints: "",
    mvFormat: "Mini jogo",
    warmupProfile: "ativo",
    jumpTarget: "baixo",
    rpeTarget: "4",
    source: "AUTO",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    ...overrides,
  }) as ClassPlan;

const makeClass = (overrides: Partial<ClassGroup>): ClassGroup =>
  ({
    id: "class-1",
    name: "Turma 07-09",
    organizationId: "org-1",
    unit: "Rede Esportes Pinhais",
    modality: "voleibol",
    daysOfWeek: [6],
    daysPerWeek: 1,
    ...overrides,
  }) as ClassGroup;

describe("monthly session filter", () => {
  it("keeps a week that starts in April when its real session is on May 2", () => {
    const plan = makePlan({ startDate: "2026-04-27", weekNumber: 18 });
    const classGroup = makeClass({ daysOfWeek: [6], daysPerWeek: 1 });

    expect(buildPlanSessions(plan, classGroup).map((session) => session.date)).toEqual(["2026-05-02"]);
    expect(planHasSessionInMonth(plan, classGroup, "2026-05")).toBe(true);
  });

  it("does not include a cross-month week in the previous month when no class session happens there", () => {
    const plan = makePlan({ startDate: "2026-04-27", weekNumber: 18 });
    const classGroup = makeClass({ daysOfWeek: [6], daysPerWeek: 1 });

    expect(planHasSessionInMonth(plan, classGroup, "2026-04")).toBe(false);
  });

  it("keeps a May week when one of its sessions crosses into June", () => {
    const plan = makePlan({ id: "plan-2", startDate: "2026-05-28", weekNumber: 22 });
    const classGroup = makeClass({ daysOfWeek: [6], daysPerWeek: 1 });

    expect(buildPlanSessions(plan, classGroup).map((session) => session.date)).toEqual(["2026-05-30"]);
    expect(planHasSessionInMonth(plan, classGroup, "2026-05")).toBe(true);
    expect(planHasSessionInMonth(plan, classGroup, "2026-06")).toBe(false);
  });

  it("filters sessions shown inside the month to the selected month only", () => {
    const plan = makePlan({ startDate: "2026-04-27", weekNumber: 18 });
    const classGroup = makeClass({ daysOfWeek: [4, 6], daysPerWeek: 2 });
    const sessions = buildPlanSessions(plan, classGroup);

    expect(sessions.map((session) => session.date)).toEqual(["2026-04-30", "2026-05-02"]);
    expect(filterSessionsInMonth(sessions, "2026-05").map((session) => session.date)).toEqual(["2026-05-02"]);
  });

  it("filters a plan list by real class sessions instead of only by week start date", () => {
    const aprilStartMaySession = makePlan({ id: "plan-apr", startDate: "2026-04-27", weekNumber: 18 });
    const mayStartMaySession = makePlan({ id: "plan-may", startDate: "2026-05-04", weekNumber: 19 });
    const classGroup = makeClass({ daysOfWeek: [6], daysPerWeek: 1 });

    expect(filterPlansWithSessionsInMonth([aprilStartMaySession, mayStartMaySession], classGroup, "2026-05").map((plan) => plan.id)).toEqual([
      "plan-apr",
      "plan-may",
    ]);
  });

  it("falls back to the plan start month when the class has no schedulable weekdays", () => {
    const plan = makePlan({ startDate: "2026-05-04", weekNumber: 19 });
    const classGroup = makeClass({ daysOfWeek: [], daysPerWeek: 0 });

    expect(buildPlanSessions(plan, classGroup)).toEqual([]);
    expect(planHasSessionInMonth(plan, classGroup, "2026-05")).toBe(true);
  });
});
