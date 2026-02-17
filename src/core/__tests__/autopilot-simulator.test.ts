import type { ClassGroup, SessionLog } from "../models";
import { buildWeeklyAutopilotProposal } from "../autopilot/weekly-autopilot";
import { simulateClassEvolution } from "../simulator/evolution-simulator";

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
  toBeGreaterThan: (expected: number) => void;
};

const classGroup: ClassGroup = {
  id: "class_1",
  name: "Sub-17",
  organizationId: "org_1",
  unit: "Quadra A",
  unitId: "unit_1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "15-17",
  gender: "misto",
  startTime: "18:00",
  endTime: "19:00",
  durationMinutes: 60,
  daysOfWeek: [2, 4],
  daysPerWeek: 2,
  goal: "técnica",
  equipment: "quadra",
  level: 2,
  mvLevel: "intermediário",
  cycleStartDate: "2026-01-01",
  cycleLengthWeeks: 8,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const logs: SessionLog[] = [
  {
    id: "s1",
    clientId: "coach_1",
    classId: "class_1",
    PSE: 6,
    technique: "ok",
    attendance: 0.9,
    activity: "Treino",
    conclusion: "Bom",
    participantsCount: 12,
    photos: "",
    painScore: 0,
    createdAt: "2026-02-01T10:00:00.000Z",
  },
  {
    id: "s2",
    clientId: "coach_1",
    classId: "class_1",
    PSE: 6,
    technique: "boa",
    attendance: 1,
    activity: "Treino",
    conclusion: "Ótimo",
    participantsCount: 13,
    photos: "",
    painScore: 0,
    createdAt: "2026-02-03T10:00:00.000Z",
  },
];

describe("autopilot-simulator", () => {
  it("creates weekly autopilot proposal in proposed status", () => {
    const proposal = buildWeeklyAutopilotProposal({
      classGroup,
      logs,
      organizationId: "org_1",
      createdBy: "coach_1",
    });

    expect(proposal.classId).toBe("class_1");
    expect(proposal.status).toBe("proposed");
    expect(proposal.actions.length).toBeGreaterThan(0);
  });

  it("simulates deterministic evolution for selected horizon", () => {
    const result = simulateClassEvolution({
      classId: "class_1",
      logs,
      horizonWeeks: 6,
      interventionIntensity: "balanced",
    });

    expect(result.horizonWeeks).toBe(6);
    expect(result.points.length).toBe(6);
    expect(result.requiresHumanApproval).toBe(true);
  });
});
