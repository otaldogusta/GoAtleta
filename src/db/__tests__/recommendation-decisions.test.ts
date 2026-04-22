jest.mock("../sqlite", () => ({
  db: {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
  },
}));

import {
    getRecommendationDecisionForPlanAndCode,
    listRecommendationDecisionsByClass,
    listRecommendationDecisionsByPlan,
    upsertRecommendationDecision,
} from "../recommendation-decisions";
import { db } from "../sqlite";

const mockedDb = db as jest.Mocked<typeof db>;

const buildRow = () => ({
  id: "decision-1",
  classId: "class-1",
  cycleId: "cycle-1",
  planId: "plan-1",
  weekNumber: 3,
  recommendationCode: "restore_weekly_role_alignment",
  status: "accepted",
  priority: "high",
  title: "Restaurar alinhamento entre semana e sessao",
  message: "Uma ou mais sessoes estao escapando do papel semanal.",
  rationale: "A autoridade semanal foi quebrada em multiplas semanas.",
  sourceSignalsJson: '["authority_break_recurrence","weekly_authority_violation"]',
  reasonType: "teacher_judgment",
  reasonNote: "Ajustar no proximo bloco.",
  createdAt: "2026-05-01T10:00:00.000Z",
  updatedAt: "2026-05-01T10:00:00.000Z",
});

describe("recommendation-decisions db", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("inserts decision when plan+code does not exist", async () => {
    mockedDb.getFirstAsync.mockResolvedValueOnce(null as never);
    mockedDb.runAsync.mockResolvedValueOnce({ lastInsertRowId: 1, changes: 1 } as never);

    await upsertRecommendationDecision({
      id: "decision-1",
      classId: "class-1",
      cycleId: "cycle-1",
      planId: "plan-1",
      weekNumber: 3,
      recommendationCode: "restore_weekly_role_alignment",
      status: "accepted",
      priority: "high",
      title: "Restaurar alinhamento entre semana e sessao",
      message: "Uma ou mais sessoes estao escapando do papel semanal.",
      rationale: "A autoridade semanal foi quebrada em multiplas semanas.",
      sourceSignals: ["authority_break_recurrence", "weekly_authority_violation"],
      reasonType: "teacher_judgment",
      reasonNote: "Ajustar no proximo bloco.",
      createdAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-01T10:00:00.000Z",
    });

    expect(mockedDb.getFirstAsync).toHaveBeenCalledTimes(1);
    expect(mockedDb.runAsync).toHaveBeenCalledTimes(1);
    expect(mockedDb.runAsync.mock.calls[0]?.[0]).toContain("INSERT INTO recommendation_decisions");
    expect(mockedDb.runAsync.mock.calls[0]?.[1]).toContain("restore_weekly_role_alignment");
  });

  it("updates same plan+code while preserving original trail identity", async () => {
    mockedDb.getFirstAsync.mockResolvedValueOnce(buildRow() as never);
    mockedDb.runAsync.mockResolvedValueOnce({ lastInsertRowId: 0, changes: 1 } as never);

    await upsertRecommendationDecision({
      id: "plan-1:restore_weekly_role_alignment",
      classId: "class-1",
      cycleId: "cycle-1",
      planId: "plan-1",
      weekNumber: 3,
      recommendationCode: "restore_weekly_role_alignment",
      status: "rejected",
      priority: "high",
      title: "Restaurar alinhamento entre semana e sessao",
      message: "Uma ou mais sessoes estao escapando do papel semanal.",
      rationale: "A autoridade semanal foi quebrada em multiplas semanas.",
      sourceSignals: ["authority_break_recurrence", "weekly_authority_violation"],
      reasonType: "not_relevant",
      reasonNote: null,
      createdAt: "2026-05-02T10:00:00.000Z",
      updatedAt: "2026-05-02T10:00:00.000Z",
    });

    expect(mockedDb.getFirstAsync).toHaveBeenCalledTimes(1);
    expect(mockedDb.runAsync).toHaveBeenCalledTimes(1);
    expect(mockedDb.runAsync.mock.calls[0]?.[0]).toContain("UPDATE recommendation_decisions");
    expect(mockedDb.runAsync.mock.calls[0]?.[1]?.slice(-1)[0]).toBe("decision-1");
  });

  it("lists recommendation decisions by class", async () => {
    mockedDb.getAllAsync.mockResolvedValueOnce([buildRow()] as never);

    const result = await listRecommendationDecisionsByClass("class-1");

    expect(result).toHaveLength(1);
    expect(result[0]?.recommendationCode).toBe("restore_weekly_role_alignment");
    expect(result[0]?.sourceSignals).toEqual([
      "authority_break_recurrence",
      "weekly_authority_violation",
    ]);
  });

  it("lists recommendation decisions by plan", async () => {
    mockedDb.getAllAsync.mockResolvedValueOnce([buildRow()] as never);

    const result = await listRecommendationDecisionsByPlan("plan-1");

    expect(result).toHaveLength(1);
    expect(mockedDb.getAllAsync.mock.calls[0]?.[0]).toContain("WHERE planId = ?");
  });

  it("gets the latest decision for a plan and recommendation code", async () => {
    mockedDb.getFirstAsync.mockResolvedValueOnce(buildRow() as never);

    const result = await getRecommendationDecisionForPlanAndCode(
      "plan-1",
      "restore_weekly_role_alignment"
    );

    expect(result?.status).toBe("accepted");
    expect(result?.reasonType).toBe("teacher_judgment");
  });
});
