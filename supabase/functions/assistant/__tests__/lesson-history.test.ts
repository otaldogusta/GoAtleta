import { summarizePreviousPlans, loadPreviousLessonPlans } from "../lesson-history";
const row = { id: "plan", organization_id: "org", classid: "class", title: "Manchetão", main: ["Consolidação"], applydate: "2026-09-03" };
test("previous plans never become proof of execution and never cross workspace, class or date", () => {
  const result = summarizePreviousPlans([row, { ...row, id: "older-version" }, { ...row, organization_id: "other" }, { ...row, classid: "other" }, { ...row, applydate: "2026-09-07" }, { ...row, applydate: null }], "class", "org", "2026-09-06");
  expect(result).toEqual([{ date: "2026-09-03", state: "planned_only", source: "training_plans/plan", title: "Manchetão", activities: ["Consolidação"] }]);
});
test("query is explicitly scoped and bounded; an error means unavailable, not no history", async () => {
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), or: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), lt: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue({ error: { message: "RLS" } }) };
  const result = await loadPreviousLessonPlans({ from: () => query } as never, "class", "org", "2026-09-06");
  expect(query.eq).toHaveBeenCalledWith("organization_id", "org");
  expect(query.eq).toHaveBeenCalledWith("classid", "class");
  expect(query.lt).toHaveBeenCalledWith("applydate", "2026-09-06");
  expect(result).toContain("indisponível");
});
