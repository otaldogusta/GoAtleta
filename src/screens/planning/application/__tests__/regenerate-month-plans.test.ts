import type {
  ClassGroup,
  ClassPlan,
  DailyLessonPlan,
  PlanningCycle,
  RecentSessionSummary,
} from "../../../../core/models";
import {
  listDailyLessonPlansByWeekIds,
  saveClassPlans,
  updateClassPlan,
  upsertDailyLessonPlan,
} from "../../../../db/seed";
import {
  getMonthlyPlanningBlueprint,
  upsertMonthlyPlanningBlueprint,
} from "../../../../db/monthly-planning-blueprints";
import { generateMonthlyBlueprint } from "../generate-monthly-blueprint";
import {
  buildInitialMonthPlans,
  regenerateMonthPlans,
  regenerateWeeklyPlanFromBlueprint,
} from "../regenerate-month-plans";
import { buildPlanSessionCalendar } from "../monthly-plan-calendar";

jest.mock("../../../../db/seed", () => ({
  listDailyLessonPlansByWeekIds: jest.fn(),
  saveClassPlans: jest.fn(),
  updateClassPlan: jest.fn(),
  upsertDailyLessonPlan: jest.fn(),
}));

jest.mock("../../../../db/monthly-planning-blueprints", () => ({
  getMonthlyPlanningBlueprint: jest.fn(),
  upsertMonthlyPlanningBlueprint: jest.fn(),
}));

const classGroup: ClassGroup = {
  id: "class-1",
  name: "Turma QA",
  organizationId: "org-1",
  unit: "Unidade",
  unitId: "unit-1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "09-11",
  gender: "misto",
  startTime: "18:00",
  endTime: "19:00",
  durationMinutes: 60,
  daysOfWeek: [2, 4],
  daysPerWeek: 2,
  goal: "formacao",
  equipment: "quadra",
  level: 1,
  mvLevel: "2x2",
  cycleStartDate: "2026-07-06",
  cycleLengthWeeks: 8,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-07-01T00:00:00.000Z",
};

const activeCycle: PlanningCycle = {
  id: "cycle-1",
  organizationId: classGroup.organizationId,
  classId: classGroup.id,
  year: 2026,
  title: "Ciclo 2026",
  startDate: "2026-07-06",
  endDate: "2026-08-30",
  status: "active",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

const buildWeeklyPlan = (overrides: Partial<ClassPlan> = {}): ClassPlan => ({
  ...buildInitialMonthPlans({
    classGroup,
    monthKey: "2026-08",
    classPlans: [],
    activeCycleId: activeCycle.id,
    activeCycleStartDate: activeCycle.startDate,
  })[0],
  cycleId: activeCycle.id,
  ...overrides,
});

const buildDailyPlan = (params: {
  weeklyPlan: ClassPlan;
  date: string;
  overrides?: Partial<DailyLessonPlan>;
}): DailyLessonPlan => ({
  id: `daily-${params.date}`,
  classId: classGroup.id,
  weeklyPlanId: params.weeklyPlan.id,
  date: params.date,
  dayOfWeek: new Date(`${params.date}T00:00:00`).getDay(),
  title: "Plano existente",
  warmup: "Aquecimento existente",
  mainPart: "Parte principal existente",
  cooldown: "Volta à calma existente",
  observations: "Observações existentes",
  generationVersion: 1,
  manualOverrideMaskJson: "[]",
  createdAt: `${params.date}T12:00:00.000Z`,
  updatedAt: `${params.date}T12:00:00.000Z`,
  ...params.overrides,
});

describe("buildInitialMonthPlans", () => {
  it("creates only missing weeks with sessions in an empty requested month", () => {
    const plans = buildInitialMonthPlans({
      classGroup,
      monthKey: "2026-08",
      classPlans: [],
      activeCycleId: "cycle-1",
    });

    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((plan) => plan.cycleId === "cycle-1")).toBe(true);
    expect(plans.every((plan) => plan.classId === classGroup.id)).toBe(true);
  });

  it("does not duplicate an existing week", () => {
    const initial = buildInitialMonthPlans({
      classGroup,
      monthKey: "2026-08",
      classPlans: [],
    });
    const plans = buildInitialMonthPlans({
      classGroup,
      monthKey: "2026-08",
      classPlans: [initial[0]],
    });

    expect(plans).toHaveLength(initial.length - 1);
    expect(plans.some((plan) => plan.id === initial[0].id)).toBe(false);
  });

  it("persists one operational role per real session when regenerating the month", () => {
    const existing = buildInitialMonthPlans({
      classGroup,
      monthKey: "2026-08",
      classPlans: [],
    })[0];
    expect(existing).toBeTruthy();

    const blueprint = generateMonthlyBlueprint({
      classGroup,
      monthKey: "2026-08",
    });
    const regenerated = regenerateWeeklyPlanFromBlueprint({
      existing,
      blueprint,
      cycleLength: classGroup.cycleLengthWeeks,
      classGroup,
      weeklySessions: 2,
    });
    const snapshot = JSON.parse(regenerated.generationContextSnapshotJson ?? "{}") as {
      weeklyOperationalStrategy?: {
        decisions?: Array<{ sessionIndexInWeek: number; sessionRole: string }>;
      };
    };

    expect(snapshot.weeklyOperationalStrategy?.decisions).toHaveLength(2);
    expect(snapshot.weeklyOperationalStrategy?.decisions?.map((item) => item.sessionIndexInWeek)).toEqual([1, 2]);
    expect(new Set(snapshot.weeklyOperationalStrategy?.decisions?.map((item) => item.sessionRole)).size).toBe(2);
  });
});

describe("regenerateMonthPlans safety", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMonthlyPlanningBlueprint as jest.Mock).mockResolvedValue(null);
    (upsertMonthlyPlanningBlueprint as jest.Mock).mockResolvedValue(undefined);
    (saveClassPlans as jest.Mock).mockResolvedValue(undefined);
    (updateClassPlan as jest.Mock).mockResolvedValue(undefined);
    (upsertDailyLessonPlan as jest.Mock).mockResolvedValue(undefined);
  });

  it("keeps realized dailies immutable and merges manual daily overrides", async () => {
    const weeklyPlan = buildWeeklyPlan();
    const sessions = buildPlanSessionCalendar({
      plan: weeklyPlan,
      classGroup,
      exceptions: [],
      monthKey: "2026-08",
    }).sessions;
    expect(sessions).toHaveLength(2);

    const realizedDaily = buildDailyPlan({
      weeklyPlan,
      date: sessions[0].date,
      overrides: { title: "Aula que já aconteceu" },
    });
    const overriddenDaily = buildDailyPlan({
      weeklyPlan,
      date: sessions[1].date,
      overrides: {
        title: "Título definido pelo professor",
        observations: "Observação definida pelo professor",
        syncStatus: "overridden",
        manualOverrideMaskJson: JSON.stringify(["title", "observations"]),
      },
    });
    (listDailyLessonPlansByWeekIds as jest.Mock).mockResolvedValue([
      realizedDaily,
      overriddenDaily,
    ]);
    const recentSessionSummaries: RecentSessionSummary[] = [
      {
        sessionDate: sessions[0].date,
        wasPlanned: true,
        wasApplied: true,
        wasEditedByTeacher: false,
        wasConfirmedExecuted: true,
        executionState: "confirmed_executed",
      },
    ];

    await regenerateMonthPlans({
      classGroup,
      monthKey: "2026-08",
      classPlans: [weeklyPlan],
      activeCycle,
      recentSessionSummaries,
    });

    expect(updateClassPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        id: weeklyPlan.id,
        cycleId: activeCycle.id,
      }),
      { organizationId: classGroup.organizationId },
    );
    expect(upsertDailyLessonPlan).toHaveBeenCalledTimes(1);
    expect(upsertDailyLessonPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        id: overriddenDaily.id,
        date: overriddenDaily.date,
        title: overriddenDaily.title,
        observations: overriddenDaily.observations,
        syncStatus: "overridden",
      }),
    );
    expect(upsertDailyLessonPlan).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: realizedDaily.id }),
    );
  });

  it("treats a persisted class report as completed-session evidence", async () => {
    const weeklyPlan = buildWeeklyPlan();
    const [session] = buildPlanSessionCalendar({
      plan: weeklyPlan,
      classGroup,
      exceptions: [],
      monthKey: "2026-08",
    }).sessions;
    const realizedDaily = buildDailyPlan({ weeklyPlan, date: session.date });
    (listDailyLessonPlansByWeekIds as jest.Mock).mockResolvedValue([realizedDaily]);

    await regenerateMonthPlans({
      classGroup,
      monthKey: "2026-08",
      classPlans: [weeklyPlan],
      activeCycle,
      recentSessionLogs: [
        {
          classId: classGroup.id,
          PSE: 5,
          technique: "ok",
          attendance: 10,
          activity: "Aula aplicada",
          conclusion: "Concluída",
          photos: "[]",
          createdAt: `${session.date}T20:00:00.000Z`,
        },
      ],
    });

    expect(upsertDailyLessonPlan).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: realizedDaily.id }),
    );
  });

  it("does not regenerate a manually authored weekly plan", async () => {
    const weeklyPlan = buildWeeklyPlan({
      source: "MANUAL",
      theme: "Tema personalizado",
      technicalFocus: "Foco personalizado",
    });
    (listDailyLessonPlansByWeekIds as jest.Mock).mockResolvedValue([]);

    const result = await regenerateMonthPlans({
      classGroup,
      monthKey: "2026-08",
      classPlans: [weeklyPlan],
      activeCycle,
    });

    expect(result).toEqual({ status: "regenerated", weeklyPlanCount: 1 });
    expect(updateClassPlan).not.toHaveBeenCalled();
    expect(upsertDailyLessonPlan).toHaveBeenCalled();
  });

  it("rejects a cycle from another organization before writing", async () => {
    await expect(
      regenerateMonthPlans({
        classGroup,
        monthKey: "2026-08",
        classPlans: [buildWeeklyPlan()],
        activeCycle: { ...activeCycle, organizationId: "org-2" },
      }),
    ).rejects.toThrow("O ciclo ativo pertence a outra organização.");

    expect(updateClassPlan).not.toHaveBeenCalled();
    expect(upsertDailyLessonPlan).not.toHaveBeenCalled();
  });
});
