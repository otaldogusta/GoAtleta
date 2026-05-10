import { buildAutoDailyLessonPlan } from "../regenerate-daily-lesson-plan";

describe("buildAutoDailyLessonPlan integration fields", () => {
  it("does not turn physical focus or gym access into academy without explicit session decision", () => {
    const weeklyPlan = {
      id: "wp-1",
      classId: "class-1",
      weekNumber: 3,
      phase: "Base",
      generalObjective: "Objetivo semanal",
      specificObjective: "Objetivo específico",
      theme: "Continuidade",
      technicalFocus: "Passe",
      physicalFocus: "Potência",
      pedagogicalRule: "Regra semanal",
      rpeTarget: "PSE 5",
      jumpTarget: "baixo",
      warmupProfile: "ativo",
      constraints: "",
      generationVersion: 2,
      generationContextSnapshotJson: JSON.stringify({
        weeklyOperationalStrategy: {
          decisions: [
            {
              sessionIndexInWeek: 2,
              sessionRole: "consolidacao_orientada",
            },
          ],
        },
      }),
      weeklyIntegratedContextJson: JSON.stringify({
        weeklyPhysicalEmphasis: "potencia_atletica",
        courtGymRelationship: "integrado_transferencia_direta",
        gymSessionsCount: 1,
        courtSessionsCount: 2,
        interferenceRisk: "moderado",
        notes: "Integração direta academia → quadra",
      }),
      createdAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z",
    } as any;

    const session = {
      sessionIndex: 2,
      weekday: 3,
      weekdayLabel: "Qua",
      date: "2026-04-22",
      dateLabel: "22/04/2026",
      shortLabel: "Qua 22/04",
    };

    const plan = buildAutoDailyLessonPlan(
      weeklyPlan,
      session,
      "2026-04-20T12:00:00.000Z",
      null,
      {
        classGroup: {
          id: "class-1",
          name: "Sub-14",
          organizationId: "org-1",
          unit: "Centro",
          unitId: "unit-1",
          colorKey: "blue",
          modality: "voleibol",
          ageBand: "13-14",
          gender: "misto",
          startTime: "18:00",
          endTime: "19:30",
          durationMinutes: 90,
          daysOfWeek: [1, 3, 5],
          daysPerWeek: 3,
          goal: "base",
          equipment: "academia",
          level: 2,
          mvLevel: "intermediario",
          cycleStartDate: "2026-04-20",
          cycleLengthWeeks: 12,
          acwrLow: 0.8,
          acwrHigh: 1.3,
          createdAt: "2026-04-20T00:00:00.000Z",
          integratedTrainingModel: "academia_integrada",
          resistanceTrainingProfile: "iniciante",
        } as any,
      },
    );

    expect(plan.sessionEnvironment).toBe("quadra");
    expect(plan.sessionPrimaryComponent).toBe("tecnico_tatico");
    expect(plan.sessionComponents).toBeUndefined();
  });

  it("persists resistance session fields when periodization explicitly marks the session as academy", () => {
    const weeklyPlan = {
      id: "wp-1b",
      classId: "class-1",
      weekNumber: 3,
      phase: "Base",
      generalObjective: "Objetivo semanal",
      specificObjective: "Objetivo específico",
      theme: "Continuidade",
      technicalFocus: "Passe",
      physicalFocus: "Potência",
      pedagogicalRule: "Regra semanal",
      rpeTarget: "PSE 5",
      jumpTarget: "baixo",
      warmupProfile: "ativo",
      constraints: "",
      generationVersion: 2,
      generationContextSnapshotJson: JSON.stringify({
        weeklyOperationalStrategy: {
          decisions: [
            {
              sessionIndexInWeek: 2,
              sessionRole: "consolidacao_orientada",
              sessionEnvironment: "academia",
              sessionPrimaryComponent: "resistido",
              trainingContext: "volleyball",
              sportContext: "volleyball",
              contextSource: "weekly_strategy",
            },
          ],
        },
      }),
      weeklyIntegratedContextJson: JSON.stringify({
        weeklyPhysicalEmphasis: "potencia_atletica",
        courtGymRelationship: "integrado_transferencia_direta",
        gymSessionsCount: 1,
        courtSessionsCount: 2,
        interferenceRisk: "moderado",
        notes: "Integração direta academia → quadra",
      }),
      createdAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z",
    } as any;

    const session = {
      sessionIndex: 2,
      weekday: 3,
      weekdayLabel: "Qua",
      date: "2026-04-22",
      dateLabel: "22/04/2026",
      shortLabel: "Qua 22/04",
    };

    const plan = buildAutoDailyLessonPlan(
      weeklyPlan,
      session,
      "2026-04-20T12:00:00.000Z",
      null,
      {
        classGroup: {
          id: "class-1",
          name: "Sub-14",
          organizationId: "org-1",
          unit: "Centro",
          unitId: "unit-1",
          colorKey: "blue",
          modality: "voleibol",
          ageBand: "13-14",
          gender: "misto",
          startTime: "18:00",
          endTime: "19:30",
          durationMinutes: 90,
          daysOfWeek: [1, 3, 5],
          daysPerWeek: 3,
          goal: "base",
          equipment: "academia",
          level: 2,
          mvLevel: "intermediario",
          cycleStartDate: "2026-04-20",
          cycleLengthWeeks: 12,
          acwrLow: 0.8,
          acwrHigh: 1.3,
          createdAt: "2026-04-20T00:00:00.000Z",
          integratedTrainingModel: "academia_integrada",
          resistanceTrainingProfile: "iniciante",
        } as any,
      },
    );

    expect(plan.sessionEnvironment).toBe("academia");
    expect(plan.sessionPrimaryComponent).toBe("resistido");
    expect(plan.sessionComponents?.[0]?.type).toBe("academia_resistido");
    expect(
      plan.sessionComponents?.[0]?.type === "academia_resistido"
        ? plan.sessionComponents[0].trainingContext
        : null
    ).toBe("volleyball");
    expect(
      plan.sessionComponents?.[0]?.type === "academia_resistido"
        ? plan.sessionComponents[0].contextSource
        : null
    ).toBe("weekly_strategy");
  });

  it("keeps snapshot environment fallback when class context is absent", () => {
    const weeklyPlan = {
      id: "wp-2",
      classId: "class-2",
      weekNumber: 1,
      phase: "Base",
      generalObjective: "Objetivo semanal",
      specificObjective: "Objetivo específico",
      theme: "Continuidade",
      technicalFocus: "Passe",
      physicalFocus: "Base",
      pedagogicalRule: "",
      rpeTarget: "PSE 4",
      jumpTarget: "baixo",
      warmupProfile: "ativo",
      constraints: "",
      generationVersion: 1,
      generationContextSnapshotJson: JSON.stringify({
        weeklyOperationalStrategy: {
          decisions: [
            {
              sessionIndexInWeek: 1,
              sessionRole: "introducao_exploracao",
              sessionEnvironment: "quadra",
              sessionPrimaryComponent: "tecnico_tatico",
            },
          ],
        },
      }),
      createdAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z",
    } as any;

    const session = {
      sessionIndex: 1,
      weekday: 1,
      weekdayLabel: "Seg",
      date: "2026-04-20",
      dateLabel: "20/04/2026",
      shortLabel: "Seg 20/04",
    };

    const plan = buildAutoDailyLessonPlan(
      weeklyPlan,
      session,
      "2026-04-20T12:00:00.000Z",
    );

    expect(plan.sessionEnvironment).toBe("quadra");
    expect(plan.sessionPrimaryComponent).toBe("tecnico_tatico");
    expect(plan.sessionComponents).toBeUndefined();
  });

  it("persists quadra-only environment for 07-09 beginner volleyball even when gym exists", () => {
    const weeklyPlan = {
      id: "wp-3",
      classId: "class-3",
      weekNumber: 2,
      phase: "Base",
      generalObjective: "Objetivo semanal",
      specificObjective: "Objetivo específico",
      theme: "Coordenação e controle",
      technicalFocus: "Toque",
      physicalFocus: "Coordenação",
      pedagogicalRule: "Base motora",
      rpeTarget: "PSE 4",
      jumpTarget: "baixo",
      warmupProfile: "ativo",
      constraints: "",
      generationVersion: 2,
      generationContextSnapshotJson: JSON.stringify({
        weeklyOperationalStrategy: {
          decisions: [
            {
              sessionIndexInWeek: 2,
              sessionRole: "consolidacao_orientada",
            },
          ],
        },
      }),
      weeklyIntegratedContextJson: JSON.stringify({
        weeklyPhysicalEmphasis: "manutencao",
        courtGymRelationship: "quadra_dominante",
        gymSessionsCount: 0,
        courtSessionsCount: 3,
        interferenceRisk: "baixo",
        notes: "Academia disponível apenas como apoio motor/preventivo; quadra permanece dominante.",
      }),
      createdAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z",
    } as any;

    const session = {
      sessionIndex: 2,
      weekday: 3,
      weekdayLabel: "Qua",
      date: "2026-04-22",
      dateLabel: "22/04/2026",
      shortLabel: "Qua 22/04",
    };

    const plan = buildAutoDailyLessonPlan(
      weeklyPlan,
      session,
      "2026-04-20T12:00:00.000Z",
      null,
      {
        classGroup: {
          id: "class-3",
          name: "Sub-09",
          organizationId: "org-1",
          unit: "Centro",
          unitId: "unit-1",
          colorKey: "blue",
          modality: "voleibol",
          ageBand: "07-09",
          gender: "misto",
          startTime: "18:00",
          endTime: "19:30",
          durationMinutes: 90,
          daysOfWeek: [1, 3, 5],
          daysPerWeek: 3,
          goal: "Fundamentos + coordenação",
          equipment: "academia",
          level: 1,
          mvLevel: "base",
          cycleStartDate: "2026-04-20",
          cycleLengthWeeks: 12,
          acwrLow: 0.8,
          acwrHigh: 1.3,
          createdAt: "2026-04-20T00:00:00.000Z",
          integratedTrainingModel: "academia_integrada",
          resistanceTrainingProfile: "iniciante",
        } as any,
      },
    );

    expect(plan.sessionEnvironment).toBe("quadra");
    expect(plan.sessionPrimaryComponent).toBe("tecnico_tatico");
    expect(plan.sessionComponents).toBeUndefined();
  });

  it("uses general fitness for explicit academy sessions without sport modality", () => {
    const weeklyPlan = {
      id: "wp-generic-academy",
      classId: "class-generic",
      weekNumber: 4,
      phase: "Base",
      generalObjective: "Objetivo semanal",
      specificObjective: "Objetivo específico",
      theme: "Condicionamento",
      technicalFocus: "Coordenação",
      physicalFocus: "Força geral",
      pedagogicalRule: "Regra semanal",
      rpeTarget: "PSE 5",
      jumpTarget: "baixo",
      warmupProfile: "ativo",
      constraints: "",
      generationVersion: 1,
      generationContextSnapshotJson: JSON.stringify({
        weeklyOperationalStrategy: {
          decisions: [
            {
              sessionIndexInWeek: 1,
              sessionRole: "consolidacao_orientada",
              sessionEnvironment: "academia",
              sessionPrimaryComponent: "resistido",
              trainingContext: "general_fitness",
              contextSource: "weekly_strategy",
            },
          ],
        },
      }),
      createdAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z",
    } as any;

    const plan = buildAutoDailyLessonPlan(
      weeklyPlan,
      {
        sessionIndex: 1,
        weekday: 2,
        weekdayLabel: "Ter",
        date: "2026-04-21",
        dateLabel: "21/04/2026",
        shortLabel: "Ter 21/04",
      },
      "2026-04-20T12:00:00.000Z",
      null,
      {
        classGroup: {
          id: "class-generic",
          name: "Saúde e movimento",
          organizationId: "org-1",
          unit: "Centro",
          unitId: "unit-1",
          colorKey: "blue",
          modality: undefined,
          ageBand: "16+",
          gender: "misto",
          startTime: "18:00",
          endTime: "19:00",
          durationMinutes: 60,
          daysOfWeek: [2],
          daysPerWeek: 1,
          goal: "saúde geral",
          equipment: "academia",
          level: 1,
          mvLevel: "iniciante",
          cycleStartDate: "2026-04-20",
          cycleLengthWeeks: 12,
          acwrLow: 0.8,
          acwrHigh: 1.3,
          createdAt: "2026-04-20T00:00:00.000Z",
          integratedTrainingModel: "academia_integrada",
          resistanceTrainingProfile: "iniciante",
        } as any,
      }
    );

    expect(plan.sessionComponents?.[0]?.type).toBe("academia_resistido");
    expect(
      plan.sessionComponents?.[0]?.type === "academia_resistido"
        ? plan.sessionComponents[0].trainingContext
        : null
    ).toBe("general_fitness");
    expect(
      plan.sessionComponents?.[0]?.type === "academia_resistido"
        ? plan.sessionComponents[0].sportContext
        : null
    ).toBeUndefined();
    expect(
      plan.sessionComponents?.[0]?.type === "academia_resistido"
        ? plan.sessionComponents[0].contextSource
        : null
    ).toBe("weekly_strategy");
  });

  it("prioritizes weekly training context over class modality when the week defines a generic resisted focus", () => {
    const weeklyPlan = {
      id: "wp-weekly-general-fitness",
      classId: "class-volleyball-generic-strength",
      weekNumber: 4,
      phase: "Base",
      generalObjective: "Objetivo semanal",
      specificObjective: "Objetivo específico",
      theme: "Força geral",
      technicalFocus: "Base física",
      physicalFocus: "Força",
      pedagogicalRule: "",
      rpeTarget: "PSE 5",
      jumpTarget: "baixo",
      warmupProfile: "ativo",
      constraints: "",
      generationVersion: 1,
      generationContextSnapshotJson: JSON.stringify({
        weeklyOperationalStrategy: {
          decisions: [
            {
              sessionIndexInWeek: 1,
              sessionRole: "consolidacao_orientada",
              sessionEnvironment: "academia",
              sessionPrimaryComponent: "resistido",
              trainingContext: "general_fitness",
              contextSource: "weekly_strategy",
            },
          ],
        },
      }),
      createdAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z",
    } as any;

    const plan = buildAutoDailyLessonPlan(
      weeklyPlan,
      {
        sessionIndex: 1,
        weekday: 2,
        weekdayLabel: "Ter",
        date: "2026-04-21",
        dateLabel: "21/04/2026",
        shortLabel: "Ter 21/04",
      },
      "2026-04-20T12:00:00.000Z",
      null,
      {
        classGroup: {
          id: "class-volleyball-generic-strength",
          name: "Turma de vôlei",
          organizationId: "org-1",
          unit: "Centro",
          unitId: "unit-1",
          colorKey: "blue",
          modality: "voleibol",
          ageBand: "16+",
          gender: "misto",
          startTime: "18:00",
          endTime: "19:00",
          durationMinutes: 60,
          daysOfWeek: [2],
          daysPerWeek: 1,
          goal: "força geral",
          equipment: "academia",
          level: 2,
          mvLevel: "intermediario",
          cycleStartDate: "2026-04-20",
          cycleLengthWeeks: 12,
          acwrLow: 0.8,
          acwrHigh: 1.3,
          createdAt: "2026-04-20T00:00:00.000Z",
          integratedTrainingModel: "academia_integrada",
          resistanceTrainingProfile: "iniciante",
        } as any,
      }
    );

    expect(plan.sessionComponents?.[0]?.type).toBe("academia_resistido");
    expect(
      plan.sessionComponents?.[0]?.type === "academia_resistido"
        ? plan.sessionComponents[0].trainingContext
        : null
    ).toBe("general_fitness");
    expect(
      plan.sessionComponents?.[0]?.type === "academia_resistido"
        ? plan.sessionComponents[0].contextSource
        : null
    ).toBe("weekly_strategy");
  });

  it("generates operational court activities for 07-09 reception sessions", () => {
    const weeklyPlan = {
      id: "wp-4",
      classId: "class-4",
      weekNumber: 2,
      phase: "Base",
      generalObjective: "Desenvolver controlar a primeira bola",
      specificObjective: "Recepção e manchete com alvo",
      theme: "Controle da primeira bola",
      technicalFocus: "Manchete e recepção",
      physicalFocus: "Coordenação",
      pedagogicalRule: "Direcionar a primeira bola para uma zona combinada",
      rpeTarget: "PSE 4",
      jumpTarget: "baixo",
      warmupProfile: "ativo",
      constraints: "",
      generationVersion: 2,
      generationContextSnapshotJson: JSON.stringify({
        weeklyOperationalStrategy: {
          decisions: [
            {
              sessionIndexInWeek: 1,
              sessionRole: "consolidacao_orientada",
              sessionEnvironment: "quadra",
              sessionPrimaryComponent: "tecnico_tatico",
            },
          ],
        },
      }),
      createdAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z",
    } as any;

    const session = {
      sessionIndex: 1,
      weekday: 2,
      weekdayLabel: "Ter",
      date: "2026-04-21",
      dateLabel: "21/04/2026",
      shortLabel: "Ter 21/04",
    };

    const plan = buildAutoDailyLessonPlan(
      weeklyPlan,
      session,
      "2026-04-20T12:00:00.000Z",
      null,
      {
        className: "Turma 07-09",
        ageBand: "07-09",
        durationMinutes: 60,
      },
    );

    const blocks = JSON.parse(plan.blocksJson || "[]");
    expect(plan.observations).toContain("Objetivo da aula: Desenvolver o controle da primeira bola");
    expect(plan.observations).not.toContain("Desenvolver controlar");
    expect(blocks.find((block: any) => block.key === "warmup")?.activities?.[0]?.name).toBe("Alvo da primeira bola");
    expect(blocks.find((block: any) => block.key === "main")?.activities).toHaveLength(3);
    expect(plan.mainPart).toContain("Mini 2x2");
    expect(plan.mainPart).not.toContain("Comandos do professor:");
    expect(plan.mainPart).not.toContain("Critério de sucesso:");
    expect(plan.mainPart).not.toContain("Progressão:");
    expect(plan.mainPart).not.toContain("Adaptação:");
    expect(plan.mainPart).not.toContain("Ajuste a tarefa:");
    expect(plan.mainPart).toContain("Ajuste:");
  });

  it("differentiates 07-09 and 10-12 reception planning instead of cloning activities", () => {
    const weeklyPlan = {
      id: "wp-5",
      classId: "class-5",
      weekNumber: 2,
      phase: "Base",
      generalObjective: "Desenvolver a primeira bola",
      specificObjective: "Recepção e continuidade",
      theme: "Controle da primeira bola",
      technicalFocus: "Manchete e recepção",
      physicalFocus: "Coordenação",
      pedagogicalRule: "Organizar a recepção para dar sequência",
      rpeTarget: "PSE 4",
      jumpTarget: "baixo",
      warmupProfile: "ativo",
      constraints: "",
      generationVersion: 2,
      generationContextSnapshotJson: JSON.stringify({
        weeklyOperationalStrategy: {
          decisions: [
            {
              sessionIndexInWeek: 1,
              sessionRole: "consolidacao_orientada",
              sessionEnvironment: "quadra",
              sessionPrimaryComponent: "tecnico_tatico",
            },
          ],
        },
      }),
      createdAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z",
    } as any;

    const session = {
      sessionIndex: 1,
      weekday: 2,
      weekdayLabel: "Ter",
      date: "2026-04-21",
      dateLabel: "21/04/2026",
      shortLabel: "Ter 21/04",
    };

    const youngPlan = buildAutoDailyLessonPlan(
      weeklyPlan,
      session,
      "2026-04-20T12:00:00.000Z",
      null,
      {
        className: "Turma 07-09",
        ageBand: "07-09",
        durationMinutes: 60,
      },
    );
    const preteenPlan = buildAutoDailyLessonPlan(
      { ...weeklyPlan, id: "wp-6", classId: "class-6" },
      session,
      "2026-04-20T12:00:00.000Z",
      null,
      {
        className: "Turma 10-12",
        ageBand: "10-12",
        durationMinutes: 60,
      },
    );

    const youngBlocks = JSON.parse(youngPlan.blocksJson || "[]");
    const preteenBlocks = JSON.parse(preteenPlan.blocksJson || "[]");
    const youngMainNames = youngBlocks.find((block: any) => block.key === "main")?.activities?.map((item: any) => item.name);
    const preteenMainNames = preteenBlocks.find((block: any) => block.key === "main")?.activities?.map((item: any) => item.name);

    expect(youngBlocks.find((block: any) => block.key === "warmup")?.activities?.[0]?.name).toBe("Alvo da primeira bola");
    expect(preteenBlocks.find((block: any) => block.key === "warmup")?.activities?.[0]?.name).toBe(
      "Primeira bola para zona de levantamento",
    );
    expect(youngMainNames).not.toEqual(preteenMainNames);
    expect(youngPlan.observations).toContain("mini 2x2");
    expect(preteenPlan.observations).toContain("3x3");
    expect(preteenPlan.mainPart).toContain("zona de levantamento");
  });

  it("generates court language for older reception and service plans without system wording", () => {
    const weeklyPlan = {
      id: "wp-7",
      classId: "class-7",
      weekNumber: 4,
      phase: "Desenvolvimento",
      generalObjective: "Desenvolver fundamentos de consolidação técnica",
      specificObjective: "Serviço, recepção e organização de ataque",
      theme: "serviço, recepção e organização de ataque no mini 4x4",
      technicalFocus: "recepção do saque e primeira bola",
      physicalFocus: "potência controlada",
      pedagogicalRule: "Organizar primeira bola para continuidade",
      rpeTarget: "PSE 6",
      jumpTarget: "moderado",
      warmupProfile: "ativo",
      constraints: "",
      generationVersion: 2,
      generationContextSnapshotJson: JSON.stringify({
        weeklyOperationalStrategy: {
          decisions: [
            {
              sessionIndexInWeek: 1,
              sessionRole: "consolidacao_orientada",
              sessionEnvironment: "quadra",
              sessionPrimaryComponent: "tecnico_tatico",
            },
          ],
        },
      }),
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    } as any;

    const session = {
      sessionIndex: 1,
      weekday: 2,
      weekdayLabel: "Ter",
      date: "2026-05-05",
      dateLabel: "05/05/2026",
      shortLabel: "Ter 05/05",
    };

    const plan = buildAutoDailyLessonPlan(
      weeklyPlan,
      session,
      "2026-05-01T12:00:00.000Z",
      null,
      {
        className: "Turma 16+",
        ageBand: "16+",
        durationMinutes: 90,
      },
    );

    const blocks = JSON.parse(plan.blocksJson || "[]");
    const mainActivities = blocks.find((block: any) => block.key === "main")?.activities ?? [];
    const allGeneratedText = [plan.title, plan.observations, plan.warmup, plan.mainPart, plan.cooldown].join("\n");

    expect(plan.title).toBe("Saque, recepção e primeira bola no mini 4x4");
    expect(plan.observations).toContain("Organizar a recepção do saque e a primeira bola");
    expect(plan.observations).toContain("Receber o saque com controle");
    expect(mainActivities.map((item: any) => item.name)).toEqual([
      "Recepção de saque direcionado",
      "Recepção e transição para contra-ataque",
      "Jogo condicionado de primeira bola",
    ]);
    expect(plan.mainPart).toContain("zona de levantamento");
    expect(plan.mainPart).toContain("zona vulnerável");
    expect(plan.mainPart).not.toContain("Ajuste a tarefa:");
    expect(allGeneratedText).not.toMatch(/Etapa:|atividades guiadas|proposta progressiva|execução qualificada|fundamentos de consolidação técnica/i);
  });
});
