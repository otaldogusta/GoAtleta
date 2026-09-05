import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { getTrainingPlansForSession, useSessionData, type SessionDataStatus } from "../useSessionData";
import {
  getAttendanceByDate,
  getClassById,
  getLatestScoutingSessionDetailForPlanning,
  getScoutingLogByDate,
  getSessionLogByDate,
  getStudentsByClass,
  getTrainingPlans,
} from "../../../../db/seed";
import type { ClassGroup, ScoutingAction, TrainingPlan } from "../../../../core/models";
import type { ScoutingPlanningSignal } from "../../../../core/scouting";

jest.mock("../../../../db/seed", () => ({
  getAttendanceByDate: jest.fn(),
  getClassById: jest.fn(),
  getClassCalendarExceptions: jest.fn(() => Promise.resolve([])),
  getClassPlansByClass: jest.fn(() => Promise.resolve([])),
  getDailyLessonPlanByWeekAndDate: jest.fn(() => Promise.resolve(null)),
  getKnowledgeRuleCitations: jest.fn(() => Promise.resolve([])),
  getKnowledgeSources: jest.fn(() => Promise.resolve([])),
  getLatestScoutingSessionDetailForPlanning: jest.fn(),
  getScoutingLogByDate: jest.fn(),
  getSessionLogByDate: jest.fn(),
  getStudentsByClass: jest.fn(),
  getTrainingPlans: jest.fn(),
}));

jest.mock("../../../../api/events", () => ({
  listEvents: jest.fn(() => Promise.resolve([])),
}));

type HookSnapshot = {
  cls: ClassGroup | null;
  attendancePercent: number | null;
  isLoadingSession: boolean;
  isLoadingSessionExtras: boolean;
  sessionDataStatus: SessionDataStatus;
  sessionDataError: string | null;
  scoutingSignal: ScoutingPlanningSignal | null;
};

const compactTrainingPlans = (plans: TrainingPlan[]) => plans;

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

function renderUseSessionData(classId: string, onSnapshot: (snapshot: HookSnapshot) => void) {
  function Harness() {
    const snapshot = useSessionData({
      classId,
      sessionDate: "2026-05-30",
      weekdayId: 6,
      scoutingMode: "treino",
      compactTrainingPlans,
    });
    onSnapshot({
      cls: snapshot.cls,
      attendancePercent: snapshot.attendancePercent,
      isLoadingSession: snapshot.isLoadingSession,
      isLoadingSessionExtras: snapshot.isLoadingSessionExtras,
      sessionDataStatus: snapshot.sessionDataStatus,
      sessionDataError: snapshot.sessionDataError,
      scoutingSignal: snapshot.scoutingSignal,
    });
    return null;
  }

  return TestRenderer.create(React.createElement(Harness));
}

describe("useSessionData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSessionLogByDate as jest.Mock).mockResolvedValue(null);
    (getScoutingLogByDate as jest.Mock).mockResolvedValue(null);
    (getLatestScoutingSessionDetailForPlanning as jest.Mock).mockResolvedValue(null);
    (getStudentsByClass as jest.Mock).mockResolvedValue([]);
    (getTrainingPlans as jest.Mock).mockResolvedValue([]);
    (getAttendanceByDate as jest.Mock).mockResolvedValue([]);
  });

  it("loads the candidate catalog once and keeps date-specific plans out of the recurring fallback", async () => {
    const plans = [
      { id: "dated", classId: "class-1", applyDate: "2026-08-31", applyDays: [1], version: 8, createdAt: "2026-09-01T12:00:00Z", status: "final" },
      { id: "weekly", classId: "class-1", applyDate: "", applyDays: [1], version: 1, createdAt: "2026-08-01T12:00:00Z", status: "final" },
    ] as TrainingPlan[];
    (getTrainingPlans as jest.Mock).mockResolvedValue(plans);
    const result = await getTrainingPlansForSession("org-1", "class-1", "2026-09-07", 1);
    expect(result.currentPlan?.id).toBe("weekly");
    expect(result.savedPlans.map((plan) => plan.id)).toEqual(["dated", "weekly"]);
    expect(getTrainingPlans).toHaveBeenCalledTimes(1);
    expect(getTrainingPlans).toHaveBeenCalledWith({ organizationId: "org-1", classId: "class-1", status: "final", orderBy: "version_desc" });
  });

  it("returns not_found when the class does not exist instead of loading forever", async () => {
    (getClassById as jest.Mock).mockResolvedValue(null);
    let latest: HookSnapshot | null = null;

    await act(async () => {
      renderUseSessionData("missing-class", (snapshot) => {
        latest = snapshot;
      });
    });
    await flushPromises();

    expect(latest).toMatchObject({
      cls: null,
      isLoadingSession: false,
      sessionDataStatus: "not_found",
      sessionDataError: null,
    });
  });

  it("keeps the main session ready when attendance extras fail", async () => {
    const cls = {
      id: "class-1",
      name: "Turma Teste",
      organizationId: "org-1",
    } as ClassGroup;
    (getClassById as jest.Mock).mockResolvedValue(cls);
    (getAttendanceByDate as jest.Mock).mockRejectedValue(new Error("attendance failed"));
    let latest: HookSnapshot | null = null;

    await act(async () => {
      renderUseSessionData("class-1", (snapshot) => {
        latest = snapshot;
      });
    });
    await flushPromises();

    expect(latest).toMatchObject({
      cls,
      attendancePercent: null,
      isLoadingSession: false,
      isLoadingSessionExtras: false,
      sessionDataStatus: "ready",
      sessionDataError: null,
    });
  });

  it("returns a rich scouting signal from the latest scouting session before the class date", async () => {
    const cls = {
      id: "class-1",
      name: "Turma Teste",
      organizationId: "org-1",
    } as ClassGroup;
    const action = (id: string, overrides: Partial<ScoutingAction>): ScoutingAction => ({
      id,
      sessionId: "ss-1",
      organizationId: "org-1",
      classId: "class-1",
      studentId: null,
      athleteName: null,
      fundamental: "cobertura",
      phase: "transicao",
      resultKey: "falhou",
      resultLabel: "Falhou",
      resultLevel: 0,
      createdAt: `2026-05-29T10:00:0${id}.000Z`,
      ...overrides,
    });
    (getClassById as jest.Mock).mockResolvedValue(cls);
    (getLatestScoutingSessionDetailForPlanning as jest.Mock).mockResolvedValue({
      session: {
        id: "ss-1",
        organizationId: "org-1",
        classId: "class-1",
        type: "treino",
        date: "2026-05-29",
        title: "Treino técnico",
        status: "em_andamento",
        createdAt: "2026-05-29T10:00:00.000Z",
        updatedAt: "2026-05-29T10:00:00.000Z",
      },
      actions: [
        action("1", { fundamental: "cobertura", phase: "transicao", resultLevel: 0 }),
        action("2", { fundamental: "cobertura", phase: "transicao", resultLevel: 1 }),
        action("3", { fundamental: "cobertura", phase: "transicao", resultLevel: 1 }),
        action("4", { fundamental: "transicao", phase: "transicao", resultLevel: 2 }),
        action("5", { fundamental: "transicao", phase: "transicao", resultLevel: 2 }),
        action("6", { fundamental: "comunicacao", phase: "side_out", resultLevel: 2 }),
        action("7", { fundamental: "comunicacao", phase: "side_out", resultLevel: 2 }),
        action("8", { fundamental: "recepcao", phase: "side_out", resultLevel: 3 }),
      ],
    });
    let latest: HookSnapshot | null = null;

    await act(async () => {
      renderUseSessionData("class-1", (snapshot) => {
        latest = snapshot;
      });
    });
    await flushPromises();

    expect(getLatestScoutingSessionDetailForPlanning).toHaveBeenCalledWith(
      "class-1",
      "2026-05-30",
      { organizationId: "org-1" }
    );
    expect(latest?.scoutingSignal).toMatchObject({
      dominantWeakSkill: "defesa",
      dominantWeakFundamental: "cobertura",
      dominantWeakPhase: "transicao",
      dominantGapType: "organizacao",
      sampleSize: 8,
      confidence: "medium",
    });
  });

  it("keeps the session ready when rich scouting lookup fails", async () => {
    const cls = {
      id: "class-1",
      name: "Turma Teste",
      organizationId: "org-1",
    } as ClassGroup;
    (getClassById as jest.Mock).mockResolvedValue(cls);
    (getLatestScoutingSessionDetailForPlanning as jest.Mock).mockRejectedValue(
      new Error("scouting unavailable")
    );
    let latest: HookSnapshot | null = null;

    await act(async () => {
      renderUseSessionData("class-1", (snapshot) => {
        latest = snapshot;
      });
    });
    await flushPromises();

    expect(latest).toMatchObject({
      cls,
      scoutingSignal: null,
      isLoadingSession: false,
      sessionDataStatus: "ready",
      sessionDataError: null,
    });
  });
});
