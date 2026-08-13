import type { ClassPlan, DailyLessonPlan, TrainingPlan } from "../../models";
import {
  isTrainingPlanAlignedWithClassPlan,
  resolveClassPlanSkills,
  shouldRegenerateInconsistentAutomaticPlan,
} from "../volleyball-skill-signals";

const classPlan = {
  technicalFocus: "Passe e levantamento em tarefa cooperativa",
  theme: "Desenvolvimento",
} as ClassPlan;

const plan = {
  origin: "auto",
  status: "generated",
  title: "Ohaÿo · Bloqueio",
  pedagogy: {
    decisionTrace: {
      decision: { primarySkill: "bloqueio" },
    },
  },
} as TrainingPlan;

describe("volleyball skill consistency", () => {
  it("uses the explicit technical focus as the periodization source of truth", () => {
    expect(resolveClassPlanSkills(classPlan)).toEqual(["passe", "levantamento"]);
  });

  it("uses a skill-specific weekly theme before a conflicting technical complement", () => {
    expect(
      resolveClassPlanSkills({
        ...classPlan,
        theme: "Passe e levantamento em tarefa cooperativa",
        technicalFocus: "Aplicação de escolha de solução e leitura do bloqueio",
      })
    ).toEqual(["passe", "levantamento"]);
  });

  it("uses the technical complement when the theme and focus describe the same skill", () => {
    expect(
      resolveClassPlanSkills({
        ...classPlan,
        theme: "Recepção sob pressão",
        technicalFocus: "Passe",
      })
    ).toEqual(["passe"]);
  });

  it("keeps a single-skill technical focus when the broad theme is ambiguous", () => {
    expect(
      resolveClassPlanSkills({
        ...classPlan,
        theme: "Recepção sob pressão",
        technicalFocus: "Bloqueio",
      })
    ).toEqual(["bloqueio"]);
  });

  it("detects an automatic plan that contradicts the weekly focus", () => {
    expect(isTrainingPlanAlignedWithClassPlan({ plan, classPlan })).toBe(false);
    expect(shouldRegenerateInconsistentAutomaticPlan({ plan, classPlan })).toBe(true);
  });

  it("does not mistake copied periodization metadata for the generated content", () => {
    const legacyPlan = {
      ...plan,
      title: "Ohayō · Bloqueio",
      pedagogy: {
        periodization: {
          technicalFocus: "Passe e levantamento em tarefa cooperativa",
          theme: "Desenvolvimento",
        },
      },
    } as TrainingPlan;

    expect(isTrainingPlanAlignedWithClassPlan({ plan: legacyPlan, classPlan })).toBe(false);
    expect(shouldRegenerateInconsistentAutomaticPlan({ plan: legacyPlan, classPlan })).toBe(true);
  });

  it.each(["manual", "manual_apply", "edited_auto", "imported", "assistant"] as const)(
    "never replaces a %s plan automatically",
    (origin) => {
      expect(
        shouldRegenerateInconsistentAutomaticPlan({
          plan: { ...plan, origin },
          classPlan,
        })
      ).toBe(false);
    }
  );

  it("repairs a finalized automatic plan when it contradicts the periodization", () => {
    expect(
      shouldRegenerateInconsistentAutomaticPlan({
        plan: { ...plan, status: "final" },
        classPlan,
      })
    ).toBe(true);
  });

  it("repairs a legacy automatic plan when its origin column was not persisted", () => {
    expect(
      shouldRegenerateInconsistentAutomaticPlan({
        plan: { ...plan, origin: undefined, generatedAt: "2026-08-12T10:00:00.000Z" },
        classPlan,
      })
    ).toBe(true);
  });

  it("does not replace an unclassified legacy plan without automatic-generation evidence", () => {
    expect(
      shouldRegenerateInconsistentAutomaticPlan({
        plan: {
          ...plan,
          origin: undefined,
          generatedAt: undefined,
          inputHash: undefined,
          pedagogy: undefined,
        },
        classPlan,
      })
    ).toBe(false);
  });

  it("preserves the plan when the teacher explicitly overrode the daily lesson", () => {
    expect(
      shouldRegenerateInconsistentAutomaticPlan({
        plan,
        classPlan,
        dailyLessonPlan: { syncStatus: "overridden" } as DailyLessonPlan,
      })
    ).toBe(false);
  });
});
