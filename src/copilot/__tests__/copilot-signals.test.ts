import {
  getRecommendedSignalActions,
  sortCopilotSignals,
} from "../signal-utils";
import type { Signal } from "../../ai/signal-engine";

describe("copilot signals", () => {
  test("sortCopilotSignals prioritizes severity then detectedAt", () => {
    const signals: Signal[] = [
      {
        id: "s1",
        type: "attendance_drop",
        severity: "medium",
        scope: "class",
        organizationId: "org_1",
        title: "A",
        summary: "A",
        evidence: {},
        recommendedActionIds: [],
        detectedAt: "2026-02-19T10:00:00.000Z",
      },
      {
        id: "s2",
        type: "engagement_risk",
        severity: "critical",
        scope: "organization",
        organizationId: "org_1",
        title: "B",
        summary: "B",
        evidence: {},
        recommendedActionIds: [],
        detectedAt: "2026-02-19T08:00:00.000Z",
      },
      {
        id: "s3",
        type: "report_delay",
        severity: "high",
        scope: "class",
        organizationId: "org_1",
        title: "C",
        summary: "C",
        evidence: {},
        recommendedActionIds: [],
        detectedAt: "2026-02-19T11:00:00.000Z",
      },
    ];

    const sorted = sortCopilotSignals(signals);
    expect(sorted.map((item) => item.id)).toEqual(["s2", "s3", "s1"]);
  });

  test("getRecommendedSignalActions returns mapped actions in signal order", () => {
    const signal: Signal = {
      id: "s1",
      type: "attendance_drop",
      severity: "high",
      scope: "class",
      organizationId: "org_1",
      classId: "c_1",
      title: "A",
      summary: "A",
      evidence: {},
      recommendedActionIds: ["a2", "a1", "missing"],
      detectedAt: "2026-02-19T10:00:00.000Z",
    };
    const actions = [
      { id: "a1", title: "Action 1" },
      { id: "a2", title: "Action 2" },
      { id: "a3", title: "Action 3" },
    ];

    const result = getRecommendedSignalActions(signal, actions);
    expect(result.map((item) => item.id)).toEqual(["a2", "a1"]);
  });
});
