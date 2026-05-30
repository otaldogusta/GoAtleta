import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { useSessionData, type SessionDataStatus } from "../useSessionData";
import {
  getAttendanceByDate,
  getClassById,
  getScoutingLogByDate,
  getSessionLogByDate,
  getStudentsByClass,
  getTrainingPlans,
} from "../../../../db/seed";
import type { ClassGroup, TrainingPlan } from "../../../../core/models";

jest.mock("../../../../db/seed", () => ({
  getAttendanceByDate: jest.fn(),
  getClassById: jest.fn(),
  getClassPlansByClass: jest.fn(() => Promise.resolve([])),
  getDailyLessonPlanByWeekAndDate: jest.fn(() => Promise.resolve(null)),
  getKnowledgeRuleCitations: jest.fn(() => Promise.resolve([])),
  getKnowledgeSources: jest.fn(() => Promise.resolve([])),
  getScoutingLogByDate: jest.fn(),
  getSessionLogByDate: jest.fn(),
  getStudentsByClass: jest.fn(),
  getTrainingPlans: jest.fn(),
}));

type HookSnapshot = {
  cls: ClassGroup | null;
  attendancePercent: number | null;
  isLoadingSession: boolean;
  isLoadingSessionExtras: boolean;
  sessionDataStatus: SessionDataStatus;
  sessionDataError: string | null;
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
    (getStudentsByClass as jest.Mock).mockResolvedValue([]);
    (getTrainingPlans as jest.Mock).mockResolvedValue([]);
    (getAttendanceByDate as jest.Mock).mockResolvedValue([]);
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
});
