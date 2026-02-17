import { trackClassEvolution } from "../intelligence/evolution-tracker";
import { evaluateSessionSkillSnapshot } from "../intelligence/skill-evaluator";
import { buildNextClassSuggestion } from "../intelligence/suggestion-engine";
import type { SessionLog } from "../models";

const buildLog = (overrides: Partial<SessionLog>): SessionLog => ({
  id: overrides.id ?? "log_1",
  clientId: overrides.clientId ?? "coach_1",
  classId: overrides.classId ?? "class_1",
  PSE: overrides.PSE ?? 6,
  technique: overrides.technique ?? "ok",
  attendance: overrides.attendance ?? 1,
  activity: overrides.activity ?? "Treino",
  conclusion: overrides.conclusion ?? "Boa sessão",
  participantsCount: overrides.participantsCount ?? 12,
  photos: overrides.photos ?? "",
  painScore: overrides.painScore ?? 0,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
});

describe("coach-intelligence", () => {
  it("flags low attendance and high load", () => {
    const snapshot = evaluateSessionSkillSnapshot([
      buildLog({ attendance: 0.4, PSE: 8, technique: "ruim" }),
      buildLog({ id: "log_2", attendance: 0.5, PSE: 8, technique: "ok" }),
    ]);

    expect(snapshot.alerts.length).toBeGreaterThan(0);
    expect(snapshot.averageRpe).toBeGreaterThan(7);
  });

  it("detects upward trend when recent half improves", () => {
    const evolution = trackClassEvolution([
      buildLog({ id: "l1", createdAt: "2026-01-01T10:00:00.000Z", technique: "ruim", attendance: 0.5, PSE: 8 }),
      buildLog({ id: "l2", createdAt: "2026-01-02T10:00:00.000Z", technique: "ok", attendance: 0.7, PSE: 7 }),
      buildLog({ id: "l3", createdAt: "2026-01-03T10:00:00.000Z", technique: "boa", attendance: 1, PSE: 6 }),
      buildLog({ id: "l4", createdAt: "2026-01-04T10:00:00.000Z", technique: "boa", attendance: 1, PSE: 6 }),
    ]);

    expect(evolution.trend).toBe("up");
    expect(evolution.deltaOverall).toBeGreaterThan(0);
  });

  it("builds actionable next class suggestion with human approval guard", () => {
    const suggestion = buildNextClassSuggestion({
      className: "Sub-15",
      logs: [
        buildLog({ id: "s1", technique: "ok", attendance: 0.9, PSE: 6 }),
        buildLog({ id: "s2", technique: "boa", attendance: 1, PSE: 6 }),
      ],
    });

    expect(suggestion.headline).toContain("Sub-15");
    expect(suggestion.actions.length).toBeGreaterThan(1);
    expect(suggestion.requiresHumanApproval).toBe(true);
  });
});
