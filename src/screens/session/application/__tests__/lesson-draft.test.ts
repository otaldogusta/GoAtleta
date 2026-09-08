import { parseLessonDraft } from "../lesson-draft";
import { applyLessonDraft } from "../apply-lesson-draft";
import { getTrainingPlans, saveTrainingPlan } from "../../../../db/seed";
jest.mock("../../../../db/seed", () => ({ getTrainingPlans: jest.fn(), saveTrainingPlan: jest.fn() }));
export const draft = { title: "Consolidar manchete", tags: [], warmup: ["Controle em duplas"], main: ["Manchetão com alvos"], cooldown: ["Desafio cooperativo"], warmupTime: "10 min", mainTime: "35 min", cooldownTime: "5 min" };
const params = { draft, id: "request-1", classId: "class-1", organizationId: "org-1", date: "2026-09-06", expectedPlanId: null, isCurrent: () => true };
beforeEach(() => { jest.clearAllMocks(); (getTrainingPlans as jest.Mock).mockResolvedValue([]); (saveTrainingPlan as jest.Mock).mockResolvedValue(undefined); });
test("validates the structured lesson without trusting model identity or extra fields", () => {
  expect(parseLessonDraft({ ...draft, classId: "other", id: "remote" })).toEqual(draft);
});
test.each([{ main: [] }, { warmupTime: "10-20 min" }, { mainTime: "0" }, { cooldownTime: "NaN" }, { title: "" }, { main: [42] }])("rejects incomplete or ambiguous draft %j", patch => {
  expect(parseLessonDraft({ ...draft, ...patch })).toBeNull();
});
test("applies only to target date with explicit organization and preserves the previous plan", async () => {
  const old = { ...draft, id: "old", classId: "class-1", applyDate: params.date, version: 2, createdAt: "2026-09-01", status: "final" };
  (getTrainingPlans as jest.Mock).mockResolvedValue([old]);
  const next = await applyLessonDraft({ ...params, expectedPlanId: "old" });
  expect(next).toMatchObject({ id: "request-1", previousVersionId: "old", applyDate: params.date, applyDays: [], version: 3 });
  expect(saveTrainingPlan).toHaveBeenCalledWith(next, { organizationId: "org-1" });
  expect(old.version).toBe(2);
});
test("retry returns the existing result without creating a duplicate", async () => {
  (getTrainingPlans as jest.Mock).mockResolvedValue([{ ...draft, id: params.id }]);
  await applyLessonDraft(params);
  expect(saveTrainingPlan).not.toHaveBeenCalled();
});
test("rejects a changed context before saving", async () => {
  await expect(applyLessonDraft({ ...params, isCurrent: () => false })).rejects.toThrow("contexto");
  expect(saveTrainingPlan).not.toHaveBeenCalled();
});
test("requires review again if another version became current", async () => {
  (getTrainingPlans as jest.Mock).mockResolvedValue([{ ...draft, id: "changed", classId: params.classId, applyDate: params.date, createdAt: "2026-09-06" }]);
  await expect(applyLessonDraft(params)).rejects.toThrow("plano mudou");
  expect(saveTrainingPlan).not.toHaveBeenCalled();
});
