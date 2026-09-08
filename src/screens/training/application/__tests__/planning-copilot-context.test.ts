import { buildPlanningCopilotContext } from "../planning-copilot-context";
import type { TrainingPlan } from "../../../../core/models";

test("identifies planning even without a selected plan", () => {
  expect(buildPlanningCopilotContext(null)).toMatchObject({ screen: "planning", title: "Planejamento" });
  expect(buildPlanningCopilotContext(null).operationalFacts).toHaveLength(1);
});

test("uses the selected plan and date instead of another screen's operational summary", () => {
  const plan = { title: "Transição", warmup: ["Mobilidade"], main: ["Jogo"], cooldown: [], warmupTime: "10", mainTime: "45", cooldownTime: "5" } as unknown as TrainingPlan;
  const context = buildPlanningCopilotContext(plan, "Ohayō", "07/09/2026");
  expect(context.operationalFacts).toEqual(expect.arrayContaining([
    expect.objectContaining({ value: "Ohayō" }),
    expect.objectContaining({ value: "07/09/2026" }),
    expect.objectContaining({ label: "Parte principal", details: ["Jogo"] }),
  ]));
});
