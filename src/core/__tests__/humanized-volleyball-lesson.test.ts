import { buildNextVolleyballLessonPlan } from "../progression-engine";
import type { VolleyballSkill } from "../models";
import type { SessionPlanningContext } from "../session-planning-context";
import {
  buildHumanizedVolleyballLessonBlocks,
  resolveVolleyballLessonAgeProfile,
  validateHumanizedVolleyballBlocks,
} from "../volleyball/humanized-lesson-activities";
import { VOLLEYBALL_ACTIVITY_PATTERNS } from "../volleyball/activity-pattern-engine";
import {
  VOLLEYBALL_ACTIVITY_KNOWLEDGE_PATTERNS,
  type ActivityFocusVariant,
} from "../volleyball/activity-knowledge-patterns";

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
    ageBand,
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
        activity.presentation?.standardText,
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
    expect(activity.presentation?.standardText).toBeTruthy();
    expect(activity.presentation?.standardText).not.toContain("Foco do professor:");
    expect(activity.presentation?.standardText).not.toContain("Critério de sucesso:");
    expect(activity.presentation?.standardText).not.toContain("Adaptação:");
  });
};

const collectVisibleText = (blocks: ReturnType<typeof buildHumanizedVolleyballLessonBlocks>) =>
  [...blocks.warmup, ...blocks.main, ...blocks.cooldown]
    .map((activity) => `${activity.name} ${activity.presentation?.standardText ?? ""}`)
    .join(" ");

const expectOperationalTextQuality = (visibleText: string) => {
  [
    "O grupo um aluno",
    "lançamento do professor",
    "Professor chama",
    "Passe orientado",
    "atividade estruturada",
    "Exploração guiada",
    "referência técnica",
    "Foco do professor:",
    "Critério de sucesso:",
    "Adaptação:",
    "primarySkill",
    "vwv_",
    "volleyballxl",
    "fila longa",
    "Só continua se acertar",
  ].forEach((forbidden) => {
    expect(visibleText).not.toContain(forbidden);
  });
};

const collectActivities = (blocks: ReturnType<typeof buildHumanizedVolleyballLessonBlocks>) => [
  ...blocks.warmup,
  ...blocks.main,
  ...blocks.cooldown,
];

const expectRealityScores = (blocks: ReturnType<typeof buildHumanizedVolleyballLessonBlocks>) => {
  collectActivities(blocks).forEach((activity) => {
    expect(activity.validation?.realityScore?.score).toBeGreaterThanOrEqual(80);
    expect(activity.validation?.realityScore?.flags).toEqual([]);
    expect(activity.validation?.realityScore?.breakdown).toMatchObject({
      participation: expect.any(Number),
      waiting: expect.any(Number),
      clarity: expect.any(Number),
      progression: expect.any(Number),
      skillRelation: expect.any(Number),
      ageFit: expect.any(Number),
    });
  });
};

const buildSessionContext = (
  overrides: Partial<SessionPlanningContext> = {}
): SessionPlanningContext => ({
  schemaVersion: 1,
  classId: "class-10-12",
  sessionDate: "2026-06-13",
  ageBand: "10-12",
  sport: "volleyball",
  skillFocus: "passe",
  cycleGoal: "Recepção e continuidade",
  weekGoal: "Passe sob decisão simples",
  weekNumber: 5,
  sessionIndexInWeek: 2,
  periodizationPhase: "pre_competitivo",
  progressionDimension: "tomada_decisao",
  pedagogicalIntent: "decision_making",
  loadIntent: "alto",
  previousSessionSummary: "Passe em trios | alvo_zona",
  recentDifficulties: ["comunicacao"],
  recentActivityFamilies: ["alvo_zona", "jogo_aplicado"],
  upcomingEvents: [],
  availableDuration: 60,
  materials: ["bolas", "cones"],
  classProfile: { level: 2, daysPerWeek: 2, size: 12, heterogeneity: "contextualizada" },
  constraints: [],
  ...overrides,
});

describe("humanized volleyball lesson activities", () => {
  it("keeps a reusable activity-pattern catalog for every volleyball skill", () => {
    const skills: VolleyballSkill[] = [
      "passe",
      "levantamento",
      "ataque",
      "bloqueio",
      "defesa",
      "saque",
      "transicao",
    ];
    const stages = ["warmup", "drill", "game"] as const;

    skills.forEach((skill) => {
      stages.forEach((stage) => {
        expect(
          VOLLEYBALL_ACTIVITY_PATTERNS.some(
            (pattern) => pattern.stage === stage && pattern.skills.includes(skill)
          )
        ).toBe(true);
      });
    });
  });

  it("keeps a controlled knowledge seed by focus and activity stage", () => {
    const focusDefinitions: Array<{
      label: string;
      skill: VolleyballSkill;
      variant?: ActivityFocusVariant;
    }> = [
      { label: "passe", skill: "passe" },
      { label: "manchete", skill: "passe", variant: "manchete" },
      { label: "saque", skill: "saque" },
      { label: "levantamento", skill: "levantamento" },
      { label: "ataque", skill: "ataque" },
      { label: "defesa", skill: "defesa" },
      { label: "bloqueio", skill: "bloqueio" },
      { label: "transicao", skill: "transicao" },
    ];
    const expectedByStage = { warmup: 2, drill: 3, game: 2, cooldown: 1 };

    focusDefinitions.forEach((focus) => {
      Object.entries(expectedByStage).forEach(([stage, expectedCount]) => {
        const count = VOLLEYBALL_ACTIVITY_KNOWLEDGE_PATTERNS.filter(
          (pattern) =>
            pattern.skill === focus.skill &&
            pattern.variant === focus.variant &&
            pattern.stage === stage
        ).length;

        expect({ focus: focus.label, stage, count }).toMatchObject({
          focus: focus.label,
          stage,
        });
        expect(count).toBeGreaterThanOrEqual(expectedCount);
      });
    });
  });

  it.each([
    {
      label: "Passe 07-09",
      ageBand: "07-09",
      objective: "Passe e manchete para recepção",
      focusSkills: ["passe"] as VolleyballSkill[],
      primarySkill: "passe" as VolleyballSkill,
      expected: [
        "Caça da bola jogável",
        "Passe em duplas para voltar jogável",
        "Desafio dos 3 passes",
        "Conversa e feedbacks finais",
      ],
    },
    {
      label: "Manchete 07-09",
      ageBand: "07-09",
      objective: "Manchete para recepção",
      focusSkills: ["passe"] as VolleyballSkill[],
      primarySkill: "passe" as VolleyballSkill,
      expected: [
        "Corre e chama",
        "Manchete no alvo",
        "Miniquadra com primeiro contato combinado",
        "Conversa e feedbacks finais",
      ],
    },
    {
      label: "Saque 10-12",
      ageBand: "10-12",
      objective: "Saque por baixo",
      focusSkills: ["saque"] as VolleyballSkill[],
      primarySkill: "saque" as VolleyballSkill,
      expected: [
        "Pega-zona do saque",
        "Saque por baixo para zonas",
        "Mini jogo com saque em jogo",
        "Conversa e feedbacks finais",
      ],
    },
    {
      label: "Levantamento 10-12",
      ageBand: "10-12",
      objective: "Levantamento",
      focusSkills: ["levantamento"] as VolleyballSkill[],
      primarySkill: "levantamento" as VolleyballSkill,
      expected: [
        "Bola ao alto em circulação",
        "Troca contínua com bola auxiliar",
        "Recebe e levanta",
        "Conversa e feedbacks finais",
      ],
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
    expect(blocks.main.length).toBeGreaterThanOrEqual(2);
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
    expect(fullText).not.toContain("Passe orientado");
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

  it.each([
    ["06-08", "early", "Caça da bola jogável"],
    ["07-09", "early", "Caça da bola jogável"],
    ["08-10", "base", "Mini jogo da continuidade"],
    ["09-11", "base", "Mini jogo da continuidade"],
    ["10-12", "transition", "Recepção para organizar sideout"],
    ["11-12", "transition", "Recepção para organizar sideout"],
    ["12-14", "formation", "Recepção para organizar sideout"],
    ["13-15", "formation", "Recepção para organizar sideout"],
    ["16-18", "specialization", "Jogo aplicado com bônus de recepção"],
  ])("adapts passe activities for age band %s", (ageBand, expectedStage, expectedText) => {
    const plan = buildPlan({
      ageBand,
      objective: "Passe e manchete para recepção",
      focusSkills: ["passe"],
    });
    const profile = resolveVolleyballLessonAgeProfile(plan);
    const blocks = buildHumanizedVolleyballLessonBlocks(plan);
    const visibleText = collectVisibleText(blocks);

    expect(profile.stage).toBe(expectedStage);
    expect(blocks.validationFlags).toEqual([]);
    expectCompleteActivityFields(blocks, "passe");
    expect(visibleText).toContain(expectedText);
    expect(visibleText).not.toContain("Passe orientado");
    expect(visibleText).not.toContain("vwv_");
    expect(visibleText).not.toContain("Foco do professor:");
    expect(visibleText.toLowerCase()).not.toContain("levantamento");
  });

  it("does not reuse the same passe plan across development stages", () => {
    const visibleByAge = ["07-09", "10-12", "13-15", "16-18"].map((ageBand) =>
      collectVisibleText(
        buildHumanizedVolleyballLessonBlocks(
          buildPlan({
            ageBand,
            objective: "Passe e manchete para recepção",
            focusSkills: ["passe"],
          })
        )
      )
    );

    expect(visibleByAge[0]).not.toBe(visibleByAge[1]);
    expect(visibleByAge[1]).not.toBe(visibleByAge[2]);
    expect(visibleByAge[2]).not.toBe(visibleByAge[3]);
  });

  it("uses periodization and recent history to adjust the operational activity text", () => {
    const blocks = buildHumanizedVolleyballLessonBlocks(
      buildPlan({
        ageBand: "10-12",
        objective: "Passe e manchete para recepção",
        focusSkills: ["passe"],
      }),
      buildSessionContext()
    );
    const visibleText = collectVisibleText(blocks);
    const normalizedVisibleText = visibleText.toLowerCase();

    expect(blocks.validationFlags).toEqual([]);
    expect(visibleText).toContain("Quem recebe chama a bola antes do contato");
    expect(visibleText).toContain("equipe escolhe uma zona simples");
    expect(visibleText).toContain("Vale ponto extra");
    expect(visibleText).toContain("placar até 3 pontos");
    expect(visibleText).toContain("Na segunda rodada, o grupo muda a zona");
    expect(normalizedVisibleText).not.toContain("levantamento");
    expect(visibleText).not.toContain("Foco do professor:");
    expect(visibleText).not.toContain("Meta:");
    expect(visibleText).not.toContain("Adaptação:");
  });

  it("mentions upcoming events only when the planning context has a real event", () => {
    const blocksWithEvent = buildHumanizedVolleyballLessonBlocks(
      buildPlan({
        ageBand: "10-12",
        objective: "Passe e manchete para recepção",
        focusSkills: ["passe"],
      }),
      buildSessionContext({
        upcomingEvents: [{ title: "Festival da unidade", date: "2026-06-16", classScoped: true }],
      })
    );
    const blocksWithoutEvent = buildHumanizedVolleyballLessonBlocks(
      buildPlan({
        ageBand: "10-12",
        objective: "Passe e manchete para recepção",
        focusSkills: ["passe"],
      }),
      buildSessionContext({ upcomingEvents: [] })
    );

    expect(blocksWithEvent.validationFlags).toEqual([]);
    const eventText = collectVisibleText(blocksWithEvent);
    expect(eventText).toContain("Festival da unidade em 16/06");
    expect(eventText.match(/Festival da unidade em 16\/06/g) ?? []).toHaveLength(1);
    expect(collectVisibleText(blocksWithoutEvent)).not.toContain("Festival da unidade");
  });

  it("flags invented event reminders when no upcoming event exists", () => {
    const blocks = buildHumanizedVolleyballLessonBlocks(
      buildPlan({
        ageBand: "10-12",
        objective: "Passe e manchete para recepção",
        focusSkills: ["passe"],
      })
    );
    const cooldown = {
      ...blocks.cooldown[0],
      execution: "Cada grupo comenta uma coisa que ajudou a jogar melhor. Aviso rápido: festival no cronograma.",
      description:
        "Organização: Reunir a turma. Execução: Cada grupo comenta uma coisa que ajudou a jogar melhor. Aviso rápido: festival no cronograma.",
      presentation: {
        ...blocks.cooldown[0].presentation,
        standardText:
          "Reunir a turma na lateral da quadra. Cada grupo comenta uma coisa que ajudou a jogar melhor. Aviso rápido: festival no cronograma.",
      },
    };
    const flags = validateHumanizedVolleyballBlocks(
      { warmup: blocks.warmup, main: blocks.main, cooldown: [cooldown] },
      "passe"
    );

    expect(flags.some((flag) => flag.includes("Aviso de evento sem evento real"))).toBe(true);
  });

  it.each([
    ["manchete", "13-15", "Manchete para recepção", ["passe"] as VolleyballSkill[], "Mini 4x4 com cobertura da recepção"],
    ["saque", "06-08", "Saque por baixo", ["saque"] as VolleyballSkill[], "Boliche do saque por baixo"],
    ["saque", "13-15", "Saque por baixo", ["saque"] as VolleyballSkill[], "Mini sideout com bônus de construção"],
    ["levantamento", "06-08", "Levantamento", ["levantamento"] as VolleyballSkill[], "Cone pega-toque"],
    ["levantamento", "13-15", "Levantamento", ["levantamento"] as VolleyballSkill[], "Mini 4x4 com segundo contato obrigatório"],
    ["levantamento", "16-18", "Levantamento", ["levantamento"] as VolleyballSkill[], "Jogo aplicado com segundo contato definido"],
  ])("adapts %s output for age band %s", (_label, ageBand, objective, focusSkills, expectedText) => {
    const blocks = buildHumanizedVolleyballLessonBlocks(
      buildPlan({
        ageBand,
        objective,
        focusSkills,
      })
    );
    const visibleText = collectVisibleText(blocks);

    expect(blocks.validationFlags).toEqual([]);
    expect(visibleText).toContain(expectedText);
    expect(visibleText).not.toContain("Passe orientado");
    expect(visibleText).not.toContain("vwv_");
    expect(visibleText).not.toContain("Foco do professor:");
  });

  it.each([
    ["ataque", "13-15", "Ataque", ["ataque"] as VolleyballSkill[], "Mini jogo com finalização combinada"],
    ["bloqueio", "13-15", "Bloqueio", ["bloqueio"] as VolleyballSkill[], "Mini jogo com bloqueio e cobertura"],
    ["defesa", "10-12", "Defesa", ["defesa"] as VolleyballSkill[], "Mini jogo com defesa pontuada"],
    ["transicao", "16-18", "Transição", ["transicao"] as VolleyballSkill[], "Mini jogo de vira-jogo"],
  ])("uses pattern-backed operational output for %s", (_label, ageBand, objective, focusSkills, expectedText) => {
    const blocks = buildHumanizedVolleyballLessonBlocks(
      buildPlan({
        ageBand,
        objective,
        focusSkills,
      })
    );
    const visibleText = collectVisibleText(blocks);

    expect(blocks.validationFlags).toEqual([]);
    expectCompleteActivityFields(blocks, focusSkills[0]);
    expect(visibleText).toContain(expectedText);
    expect(visibleText).not.toContain("Aquecimento com");
    expect(visibleText).not.toContain("atividade estruturada");
    expect(visibleText).not.toContain("Foco do professor:");
  });

  it.each([
    ["Passe 07-09", "07-09", "Passe e manchete para recepção", ["passe"] as VolleyballSkill[], "Desafio dos 3 passes"],
    ["Passe 10-12", "10-12", "Passe e manchete para recepção", ["passe"] as VolleyballSkill[], "Recepção para organizar sideout"],
    ["Manchete 07-09", "07-09", "Manchete para recepção", ["passe"] as VolleyballSkill[], "Miniquadra com primeiro contato combinado"],
    ["Saque 10-12", "10-12", "Saque por baixo", ["saque"] as VolleyballSkill[], "Mini jogo com saque em jogo"],
    ["Levantamento 10-12", "10-12", "Levantamento", ["levantamento"] as VolleyballSkill[], "Recebe e levanta"],
    ["Ataque 10-12", "10-12", "Ataque", ["ataque"] as VolleyballSkill[], "Mini jogo com finalização combinada"],
    ["Defesa 10-12", "10-12", "Defesa", ["defesa"] as VolleyballSkill[], "Mini jogo com defesa pontuada"],
    ["Bloqueio 13-15", "13-15", "Bloqueio", ["bloqueio"] as VolleyballSkill[], "Mini jogo com bloqueio e cobertura"],
    ["Transição 13-15", "13-15", "Transição", ["transicao"] as VolleyballSkill[], "Mini jogo de vira-jogo"],
  ])("keeps quality-pass sample operational for %s", (_label, ageBand, objective, focusSkills, expectedText) => {
    const blocks = buildHumanizedVolleyballLessonBlocks(
      buildPlan({
        ageBand,
        objective,
        focusSkills,
      })
    );
    const visibleText = collectVisibleText(blocks);

    expect(blocks.validationFlags).toEqual([]);
    expectCompleteActivityFields(blocks, focusSkills[0]);
    expect(visibleText).toContain(expectedText);
    expect(visibleText).toMatch(/quadra|zona|cones|duplas|trios|equipes|rally|ponto|troca/i);
    expectOperationalTextQuality(visibleText);
    expectRealityScores(blocks);
  });

  it.each([
    ["Passe 07-09", "07-09", "Passe e manchete para recepção", ["passe"] as VolleyballSkill[]],
    ["Passe 10-12", "10-12", "Passe e manchete para recepção", ["passe"] as VolleyballSkill[]],
    ["Manchete 07-09", "07-09", "Manchete para recepção", ["passe"] as VolleyballSkill[]],
    ["Saque 10-12", "10-12", "Saque por baixo", ["saque"] as VolleyballSkill[]],
    ["Levantamento 10-12", "10-12", "Levantamento", ["levantamento"] as VolleyballSkill[]],
    ["Ataque 10-12", "10-12", "Ataque", ["ataque"] as VolleyballSkill[]],
    ["Defesa 10-12", "10-12", "Defesa", ["defesa"] as VolleyballSkill[]],
    ["Bloqueio 13-15", "13-15", "Bloqueio", ["bloqueio"] as VolleyballSkill[]],
    ["Transição 13-15", "13-15", "Transição", ["transicao"] as VolleyballSkill[]],
  ])("keeps realism score high for %s", (_label, ageBand, objective, focusSkills) => {
    const blocks = buildHumanizedVolleyballLessonBlocks(
      buildPlan({
        ageBand,
        objective,
        focusSkills,
      })
    );
    const visibleText = collectVisibleText(blocks);

    expect(blocks.validationFlags).toEqual([]);
    expectRealityScores(blocks);
    expectOperationalTextQuality(visibleText);
    expect(visibleText).toMatch(/A bola entra|começa|inicia|Ao sinal/i);
    expect(visibleText).toMatch(/troca|trocam|rodam|A cada|Depois de/i);
    expect(visibleText).toMatch(/quadra|meia quadra|zona|cones|rede/i);
  });

  it("keeps a batch quality matrix clean across age bands and skills", () => {
    const ageBands = ["06-08", "07-09", "10-12", "13-15", "16-18"];
    const skills: VolleyballSkill[] = [
      "passe",
      "levantamento",
      "ataque",
      "bloqueio",
      "defesa",
      "saque",
      "transicao",
    ];
    const results = ageBands.flatMap((ageBand) =>
      skills.map((skill) => {
        const blocks = buildHumanizedVolleyballLessonBlocks(
          buildPlan({
            ageBand,
            objective: skill === "passe" ? "Passe e manchete para recepção" : skill,
            focusSkills: [skill],
          }),
          buildSessionContext({
            ageBand,
            skillFocus: skill,
            recentActivityFamilies: ageBand === "10-12" ? ["alvo_zona"] : [],
            upcomingEvents:
              ageBand === "13-15"
                ? [{ title: "Festival da unidade", date: "2026-06-16", classScoped: true }]
                : [],
          })
        );
        return {
          ageBand,
          skill,
          flags: blocks.validationFlags,
          visibleText: collectVisibleText(blocks),
        };
      })
    );

    expect(results.filter((item) => item.flags.length > 0)).toEqual([]);
    expect(
      results.find((item) => item.ageBand === "07-09" && item.skill === "ataque")?.visibleText
    ).not.toBe(
      results.find((item) => item.ageBand === "16-18" && item.skill === "ataque")?.visibleText
    );
    results.forEach((item) => {
      expectOperationalTextQuality(item.visibleText);
    });
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
      stage: "drill" as const,
      participants: "",
      starter: "",
      action: "",
      rotation: "",
      simpleRule: "",
      materials: [],
      space: "",
      presentation: {
        standardText: "Foco do professor: texto interno.",
        advancedText: "",
      },
      validation: {
        flags: [],
        checklist: {},
      },
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
    expect(flags.some((flag) => flag.includes("Checklist incompleto"))).toBe(true);
    expect(flags.some((flag) => flag.includes("Linguagem artificial"))).toBe(true);
    expect(flags.some((flag) => flag.includes("levantamento"))).toBe(true);
  });

  it("flags teacher bottlenecks and target-dependent continuation rules", () => {
    const blocks = buildHumanizedVolleyballLessonBlocks(
      buildPlan({
        ageBand: "10-12",
        objective: "Ataque",
        focusSkills: ["ataque"],
      })
    );
    const badActivity = {
      ...blocks.main[0],
      execution:
        "Professor lança uma bola por vez para cada aluno na fila. Só continua se acertar o alvo.",
      presentation: {
        ...blocks.main[0].presentation,
        standardText:
          "Professor lança uma bola por vez para cada aluno na fila. Só continua se acertar o alvo.",
      },
    };
    const flags = validateHumanizedVolleyballBlocks(
      { warmup: blocks.warmup, main: [badActivity], cooldown: blocks.cooldown },
      "ataque"
    );

    expect(flags.some((flag) => flag.includes("Professor virou gargalo"))).toBe(true);
    expect(flags.some((flag) => flag.includes("Regra travada por acerto"))).toBe(true);
  });
});
