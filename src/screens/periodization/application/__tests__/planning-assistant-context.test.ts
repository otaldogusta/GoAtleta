import { buildPlanningAssistantContext, planningConversationKey } from "../planning-assistant-context";
test("captures actual selection and only provisional pedagogical fields", () => {
  const selection = { month: "2026-09", weekId: "w", weekNumber: 39, lessonDate: "2026-09-30", cycleId: "cycle" };
  const context = buildPlanningAssistantContext({ classId: "class", selection, surface: "editor", step: "Agenda", draft: { daysOfWeek: [1, 3], durationMinutes: 60, studentNames: ["Private"], painScore: 5 } });
  selection.month = "2026-10";
  expect(context.selection.month).toBe("2026-09");
  expect(context.draft).toEqual({ daysOfWeek: [1, 3], durationMinutes: 60 });
});
test("conversation scopes distinguish user, organization and class without delimiter collisions", () => {
  const original = planningConversationKey("u", "o", "c");
  expect(new Set([original, planningConversationKey("v", "o", "c"), planningConversationKey("u", "p", "c"), planningConversationKey("u", "o", "d")]).size).toBe(4);
  expect(planningConversationKey("u:o", "p", "c")).not.toBe(planningConversationKey("u", "o:p", "c"));
});
