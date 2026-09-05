import type { ClassPlan } from "../../../core/models";
import { buildEditedWeekPlan, type WeekPlanEdits } from "../application/edit-week-plan";
import { saveWeekPlan } from "../application/save-week-plan";

jest.mock("../../../db/seed", () => ({
  createClassPlan: jest.fn(), updateClassPlan: jest.fn(),
  markDailyLessonPlansOutOfSyncByWeek: jest.fn(),
}));
jest.mock("../../../observability/breadcrumbs", () => ({ logAction: jest.fn() }));

const existing: ClassPlan = {
  id: "week-1", classId: "class-1", cycleId: "cycle-2026", weekNumber: 1,
  startDate: "2026-09-01", phase: "Base", theme: "Passe", pedagogicalRule: "Cooperar",
  technicalFocus: "Direção", physicalFocus: "Coordenação", constraints: "Duplas",
  mvFormat: "2x2", warmupProfile: "Mobilidade", jumpTarget: "20", rpeTarget: "4",
  source: "AUTO", createdAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z",
  generationContextSnapshotJson: '{"lineage":"cycle-2026"}',
  weeklyIntegratedContextJson: '{"court":true}',
  blueprintId: "blueprint-1",
};
const edits: WeekPlanEdits = { ...existing, pedagogicalRule: existing.pedagogicalRule! };
const scope = { classId: "class-1", cycleId: "cycle-2026" };
const now = "2026-09-05T12:00:00.000Z";
const operations = () => ({
  create: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
  markDailyPlans: jest.fn().mockResolvedValue(undefined),
});

describe("save week plan", () => {
  it("persists the preview with the active cycle and original identity/metadata", async () => {
    const plan = buildEditedWeekPlan({
      basePlan: { ...existing, generationContextSnapshotJson: "regenerated" },
      existing, cycleId: scope.cycleId, edits: { ...edits, theme: " Defesa " }, now,
    });
    const db = operations();
    await expect(saveWeekPlan({ scope, existing, plan }, db)).resolves.toEqual({
      status: "saved", plan, dailySyncFailed: false,
    });
    expect(plan).toMatchObject({
      id: existing.id, cycleId: scope.cycleId, source: "MANUAL", theme: "Defesa",
      createdAt: existing.createdAt, updatedAt: now,
      generationContextSnapshotJson: existing.generationContextSnapshotJson,
      weeklyIntegratedContextJson: existing.weeklyIntegratedContextJson,
      blueprintId: existing.blueprintId,
    });
    expect(db.update).toHaveBeenCalledWith(plan);
    expect(db.create).not.toHaveBeenCalled();
    expect(db.markDailyPlans).toHaveBeenCalledWith(existing.id);
  });

  it("does not save or invalidate daily plans when nothing changed", async () => {
    const plan = buildEditedWeekPlan({ basePlan: existing, existing, cycleId: scope.cycleId, edits, now });
    const db = operations();
    const result = await saveWeekPlan({ scope, existing, plan }, db);
    expect(result).toEqual({ status: "unchanged", plan: existing, dailySyncFailed: false });
    expect(plan.source).toBe("AUTO");
    expect(db.update).not.toHaveBeenCalled();
    expect(db.markDailyPlans).not.toHaveBeenCalled();
  });

  it("creates a new manual week with the active cycle", async () => {
    const plan = buildEditedWeekPlan({ basePlan: existing, existing: null, cycleId: scope.cycleId, edits, now });
    const db = operations();
    await saveWeekPlan({ scope, existing: null, plan }, db);
    expect(plan).toMatchObject({ cycleId: scope.cycleId, source: "MANUAL", createdAt: now });
    expect(plan.id).not.toBe(existing.id);
    expect(db.create).toHaveBeenCalledWith(plan);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("propagates primary save errors and never marks the daily plans", async () => {
    const db = operations();
    db.update.mockRejectedValue(new Error("offline"));
    await expect(saveWeekPlan({ scope, existing, plan: { ...existing, theme: "Defesa" } }, db))
      .rejects.toThrow("offline");
    expect(db.markDailyPlans).not.toHaveBeenCalled();
  });

  it("reports partial daily sync failure after the week is already saved", async () => {
    const db = operations();
    db.markDailyPlans.mockRejectedValue(new Error("local storage unavailable"));
    await expect(saveWeekPlan({ scope, existing, plan: { ...existing, theme: "Defesa" } }, db))
      .resolves.toMatchObject({ status: "saved", dailySyncFailed: true });
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it.each([
    { scope: { ...scope, cycleId: "" }, existing, plan: existing },
    { scope, existing, plan: { ...existing, cycleId: "cycle-old" } },
    { scope, existing: { ...existing, cycleId: "cycle-old" }, plan: existing },
    { scope, existing, plan: { ...existing, classId: "other-class" } },
  ])("rejects saving without the same active class/cycle: %#", async (command) => {
    const db = operations();
    await expect(saveWeekPlan(command, db)).rejects.toThrow();
    expect(db.create).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("attaches the active cycle to a legacy week even if the content is unchanged", async () => {
    const legacy = { ...existing, cycleId: undefined };
    const plan = buildEditedWeekPlan({ basePlan: existing, existing: legacy, cycleId: scope.cycleId, edits, now });
    const db = operations();
    await expect(saveWeekPlan({ scope, existing: legacy, plan }, db)).resolves.toMatchObject({ status: "saved" });
    expect(plan.source).toBe("AUTO");
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ cycleId: scope.cycleId }));
  });
});
