import { buildAutoDailyLessonPlan } from "../regenerate-daily-lesson-plan";

describe("buildAutoDailyLessonPlan integration fields", () => {
  it("persists resistance session fields when class context supports gym integration", () => {
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

    expect(plan.sessionEnvironment).toBe("academia");
    expect(plan.sessionPrimaryComponent).toBe("resistido");
    expect(plan.sessionComponents?.[0]?.type).toBe("academia_resistido");
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
});
