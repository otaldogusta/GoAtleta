import { buildNextVolleyballLessonPlan } from "../progression-engine";
import type { VolleyballSkill } from "../models";
import {
  buildHumanizedVolleyballLessonBlocks,
  validateHumanizedVolleyballBlocks,
} from "../volleyball/humanized-lesson-activities";

const buildPlan = ({
  ageBand,
  objective,
  focusSkills,
}: {
  ageBand: string;
  objective: string;
  focusSkills: VolleyballSkill[];
}) =>
  buildNextVolleyballLessonPlan({
    classId: `class-${ageBand}`,
    unitId: "unit-1",
    className: `Turma ${ageBand}`,
    objective,
    focusSkills,
    pedagogicalProfile: "fundamental",
    previousSnapshot: {
      consistencyScore: 0.44,
      successRate: 0.42,
      decisionQuality: 0.5,
      notes: [],
    },
    lastRpeGroup: 5,
    lastAttendanceCount: 10,
  });

const collectText = (blocks: ReturnType<typeof buildHumanizedVolleyballLessonBlocks>) =>
  [...blocks.warmup, ...blocks.main, ...blocks.cooldown]
    .map((activity) =>
      [
        activity.name,
        activity.description,
        activity.organization,
        activity.execution,
        activity.coachFocus,
        activity.successCriteria,
        activity.adaptation,
        activity.primarySkill,
      ].join(" ")
    )
    .join(" ");

const expectCompleteActivityFields = (
  blocks: ReturnType<typeof buildHumanizedVolleyballLessonBlocks>,
  primarySkill: VolleyballSkill
) => {
  [...blocks.warmup, ...blocks.main, ...blocks.cooldown].forEach((activity) => {
    expect(activity.organization).toBeTruthy();
    expect(activity.execution).toBeTruthy();
    expect(activity.coachFocus).toBeTruthy();
    expect(activity.successCriteria).toBeTruthy();
    expect(activity.adaptation).toBeTruthy();
    expect(activity.primarySkill).toBe(primarySkill);
  });
};

describe("humanized volleyball lesson activities", () => {
  it.each([
    {
      label: "Passe 07-09",
      ageBand: "07-09",
      objective: "Passe e manchete para recepção",
      focusSkills: ["passe"] as VolleyballSkill[],
      primarySkill: "passe" as VolleyballSkill,
      expected: ["Passe para alvo em duplas", "Manchete com ajuste de pés"],
    },
    {
      label: "Manchete 07-09",
      ageBand: "07-09",
      objective: "Manchete para recepção",
      focusSkills: ["passe"] as VolleyballSkill[],
      primarySkill: "passe" as VolleyballSkill,
      expected: ["manchete", "primeiro contato"],
    },
    {
      label: "Saque 10-12",
      ageBand: "10-12",
      objective: "Saque por baixo",
      focusSkills: ["saque"] as VolleyballSkill[],
      primarySkill: "saque" as VolleyballSkill,
      expected: ["Saque por baixo para zonas", "Saque com rotina curta"],
    },
    {
      label: "Levantamento 10-12",
      ageBand: "10-12",
      objective: "Levantamento",
      focusSkills: ["levantamento"] as VolleyballSkill[],
      primarySkill: "levantamento" as VolleyballSkill,
      expected: ["Levantamento para alvo alto", "Levantamento após passe lançado"],
    },
  ])("creates a deterministic coupled sample for $label", (sample) => {
    const blocks = buildHumanizedVolleyballLessonBlocks(
      buildPlan({
        ageBand: sample.ageBand,
        objective: sample.objective,
        focusSkills: sample.focusSkills,
      })
    );
    const fullText = collectText(blocks);

    expect(blocks.validationFlags).toEqual([]);
    expect(blocks.main.length).toBeGreaterThanOrEqual(3);
    expectCompleteActivityFields(blocks, sample.primarySkill);
    expect(fullText).toContain("Organização:");
    expect(fullText).toContain("Execução:");
    expect(fullText).toContain("Foco do professor:");
    expect(fullText).toContain("Critério de sucesso:");
    expect(fullText).toContain("Adaptação:");
    sample.expected.forEach((text) => expect(fullText).toContain(text));
    expect(fullText).not.toContain("vwv_");
    expect(fullText).not.toContain("Exploração guiada");
    expect(fullText).not.toContain("referência técnica");
    expect(fullText).not.toContain("saque com alvo");
    expect(fullText).not.toContain("segundo contato com alvo");
  });

  it("keeps passe as the dominant focus instead of drifting to levantamento", () => {
    const blocks = buildHumanizedVolleyballLessonBlocks(
      buildPlan({
        ageBand: "07-09",
        objective: "Passe e manchete para recepção",
        focusSkills: ["passe"],
      })
    );
    const mainText = blocks.main.map((activity) => `${activity.name} ${activity.description}`).join(" ");

    expect(mainText).toContain("Passe");
    expect(mainText).toContain("primeiro contato");
    expect(mainText.toLowerCase()).not.toContain("levantamento");
    expect(mainText.toLowerCase()).not.toContain("levantador");
  });

  it("flags repetition, missing fields, skill drift and artificial language", () => {
    const badActivity = {
      id: "bad",
      name: "vwv_skill_primary_01",
      description: "Exploração guiada com referência técnica de levantamento.",
      organization: "",
      execution: "",
      coachFocus: "",
      successCriteria: "",
      adaptation: "",
      primarySkill: "passe" as const,
    };

    const flags = validateHumanizedVolleyballBlocks(
      {
        warmup: [badActivity],
        main: [badActivity, badActivity],
        cooldown: [badActivity],
      },
      "passe"
    );

    expect(flags.some((flag) => flag.includes("Atividade repetida"))).toBe(true);
    expect(flags.some((flag) => flag.includes("Campo ausente"))).toBe(true);
    expect(flags.some((flag) => flag.includes("quadra pratica"))).toBe(true);
    expect(flags.some((flag) => flag.includes("Linguagem artificial"))).toBe(true);
    expect(flags.some((flag) => flag.includes("levantamento"))).toBe(true);
  });
});
