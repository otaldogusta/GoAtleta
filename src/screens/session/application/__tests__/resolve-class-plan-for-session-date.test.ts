import type { ClassPlan } from "../../../../core/models";
import { resolveClassPlanForSessionDate } from "../resolve-class-plan-for-session-date";

const plan = (id: string, startDate: string, weekNumber: number): ClassPlan => ({
  id,
  classId: "class_1",
  startDate,
  weekNumber,
  phase: "base",
  theme: `Semana ${weekNumber}`,
  technicalFocus: "Passe",
  physicalFocus: "Coordenação",
  constraints: "",
  mvFormat: "3x3",
  warmupProfile: "lúdico",
  jumpTarget: "baixo",
  rpeTarget: "PSE 4",
  source: "AUTO",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("resolveClassPlanForSessionDate", () => {
  const plans = [
    plan("week_1", "2026-07-06", 1),
    plan("week_2", "2026-07-13", 2),
    plan("week_3", "2026-07-20", 3),
  ];

  it("uses the latest periodization week that has already started", () => {
    expect(resolveClassPlanForSessionDate(plans, "2026-07-16")?.id).toBe("week_2");
  });

  it("does not leak a future periodization week into an earlier lesson", () => {
    expect(resolveClassPlanForSessionDate(plans, "2026-07-01")).toBeNull();
  });
});
