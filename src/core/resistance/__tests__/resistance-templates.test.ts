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

  it("applies a reactive power variant when weekly emphasis is velocidade_reatividade", () => {
    const plan = resolveResistanceTemplate("potencia_atletica", "intermediario", {
      weeklyPhysicalEmphasis: "velocidade_reatividade",
    });

    expect(plan.id).toBe(
      "tpl_potencia_atletica_intermediario_velocidade_reatividade"
    );
    expect(plan.label).toBe("Potência Reativa e Velocidade");
    expect(plan.transferTarget).toContain("deslocamento lateral");
    expect(plan.exercises[0]?.name).toContain("Drop jump");
  });

  it("specializes force-base wording when court-gym relationship is integrated direct transfer", () => {
    const plan = resolveResistanceTemplate("forca_base", "intermediario", {
      courtGymRelationship: "integrado_transferencia_direta",
    });

    expect(plan.id).toBe(
      "tpl_forca_base_intermediario_integrado_transferencia_direta"
    );
    expect(plan.label).toBe("Força Base com Transferência Direta");
    expect(plan.transferTarget).toContain("ação seguinte");
  });

  it("applies an integrated endurance variant when weekly emphasis is resistencia_especifica", () => {
    const plan = resolveResistanceTemplate("resistencia_muscular", "intermediario", {
      weeklyPhysicalEmphasis: "resistencia_especifica",
    });

    expect(plan.label).toBe("Resistência Específica Integrada");
    expect(plan.transferTarget).toContain("fadiga");
    expect(plan.exercises.some((exercise) => exercise.category === "membros_inferiores")).toBe(
      true
    );
    expect(plan.exercises.some((exercise) => exercise.category === "core")).toBe(true);
  });

  it("applies a recovery variant when weekly emphasis is prevencao_recuperacao", () => {
    const plan = resolveResistanceTemplate("prevencao_lesao", "intermediario", {
      weeklyPhysicalEmphasis: "prevencao_recuperacao",
    });

    expect(plan.id).toBe(
      "tpl_prevencao_lesao_intermediario_prevencao_recuperacao"
    );
    expect(plan.label).toBe("Recuperação e Prevenção");
    expect(plan.transferTarget).toContain("fadiga residual");
    expect(plan.exercises.every((exercise) => exercise.rest === "45s")).toBe(true);
  });

  it("extends power sessions when gym is the weekly priority", () => {
    const regular = resolveResistanceTemplate("potencia_atletica", "intermediario");
    const prioritized = resolveResistanceTemplate("potencia_atletica", "intermediario", {
      courtGymRelationship: "academia_prioritaria",
    });

    expect(prioritized.label).toBe("Potência Atlética Prioritária");
    expect(prioritized.transferTarget).toContain("ações explosivas repetidas");
    expect(prioritized.estimatedDurationMin).toBeGreaterThan(
      regular.estimatedDurationMin
    );
  });
});
