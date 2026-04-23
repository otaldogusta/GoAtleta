import type { ResistanceTrainingGoal, ResistanceTrainingProfile } from "../../models";
import { resolveResistanceTemplate } from "../resistance-templates";

const GOALS: ResistanceTrainingGoal[] = [
  "forca_base",
  "hipertrofia",
  "potencia_atletica",
  "resistencia_muscular",
  "prevencao_lesao",
  "ativacao_funcional",
];

const PROFILES: ResistanceTrainingProfile[] = ["iniciante", "intermediario", "avancado"];

describe("resolveResistanceTemplate", () => {
  it.each(GOALS)("produces a valid plan for goal '%s'", (goal) => {
    const plan = resolveResistanceTemplate(goal, "intermediario");
    expect(plan.id).toBeTruthy();
    expect(plan.primaryGoal).toBe(goal);
    expect(plan.exercises.length).toBeGreaterThan(0);
    expect(plan.estimatedDurationMin).toBeGreaterThan(0);
    expect(plan.transferTarget).toBeTruthy();
  });

  it.each(PROFILES)("produces valid exercises for profile '%s'", (profile) => {
    const plan = resolveResistanceTemplate("forca_base", profile);
    for (const ex of plan.exercises) {
      expect(ex.name).toBeTruthy();
      expect(ex.sets).toBeGreaterThan(0);
      expect(ex.reps).toBeTruthy();
      expect(ex.rest).toBeTruthy();
    }
  });

  it("avancado has more volume than iniciante for forca_base", () => {
    const i = resolveResistanceTemplate("forca_base", "iniciante");
    const a = resolveResistanceTemplate("forca_base", "avancado");
    const iSets = i.exercises.reduce((acc, e) => acc + e.sets, 0);
    const aSets = a.exercises.reduce((acc, e) => acc + e.sets, 0);
    expect(aSets).toBeGreaterThanOrEqual(iSets);
  });

  it("returns id with goal and profile encoded", () => {
    const plan = resolveResistanceTemplate("potencia_atletica", "avancado");
    expect(plan.id).toBe("tpl_potencia_atletica_avancado");
  });
});
