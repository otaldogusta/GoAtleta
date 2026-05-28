import { buildAutoDailyLessonPlan } from "../regenerate-daily-lesson-plan";
import { buildAutoWeekPlan } from "../../../periodization/build-auto-week-plan";
import type { ClassGroup } from "../../../../core/models";

const buildClassGroup = (overrides: Partial<ClassGroup> = {}): ClassGroup => ({
  id: "class-longitudinal",
  name: "Turma 09-11",
  organizationId: "org-1",
  unit: "Centro",
  unitId: "unit-1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "09-11",
  gender: "misto",
  startTime: "18:00",
  endTime: "19:00",
  durationMinutes: 60,
  daysOfWeek: [2, 4],
  daysPerWeek: 2,
  goal: "Jogos reduzidos, comunicação e continuidade",
  equipment: "quadra",
  level: 1,
  mvLevel: "MV2",
  cycleStartDate: "2026-06-01",
  cycleLengthWeeks: 12,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

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
        pedagogicalDecisionSupport: {
          capIntent: {
            conceitual: ["Compreender ocupação de espaço."],
            procedimental: ["Aplicar passe em 3x3."],
            atitudinal: ["Cooperar e respeitar o erro."],
          },
          pedagogicalApproachIntent: {
            primary: "combinada",
            rationale: "Jogo reduzido com mediação coletiva.",
            cues: ["tomada de decisão", "cooperação"],
          },
          decisionRationale: "Fase e carga direcionam jogo reduzido.",
          riskFlags: [],
          teacherFacingSummary: "Intenção: combinada; passe com tomada de decisão; carga moderado.",
          sessionConstraintSuggestions: ["Usar jogo reduzido com regra simples."],
        },
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
    const snapshot = JSON.parse(plan.generationContextSnapshotJson ?? "{}");
    expect(snapshot.pedagogicalDecisionSupport.teacherFacingSummary).toContain("Intenção:");
    expect(snapshot.pedagogicalDecisionSupport.capIntent.atitudinal[0]).toContain("Cooperar");
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

  it("keeps the same pedagogical support structure from week to daily snapshot", () => {
    const classGroup = buildClassGroup();
    const weeklyPlan = buildAutoWeekPlan({
      selectedClass: classGroup,
      weekNumber: 3,
      cycleLength: 12,
      activeCycleStartDate: "2026-06-01",
      isCompetitiveMode: false,
      calendarExceptions: [],
      competitiveProfile: null,
      ageBand: "09-11",
      periodizationModel: "formacao",
      weeklySessions: 2,
      sportProfile: "voleibol",
    });
    expect(weeklyPlan).toBeTruthy();

    const session = {
      sessionIndex: 1,
      weekday: 2,
      weekdayLabel: "Ter",
      date: "2026-06-16",
      dateLabel: "16/06/2026",
      shortLabel: "Ter 16/06",
    };
    const dailyPlan = buildAutoDailyLessonPlan(
      weeklyPlan as NonNullable<typeof weeklyPlan>,
      session,
      "2026-06-15T12:00:00.000Z",
      null,
      { classGroup, ageBand: classGroup.ageBand, durationMinutes: classGroup.durationMinutes },
    );

    const weeklySnapshot = JSON.parse(weeklyPlan?.generationContextSnapshotJson ?? "{}");
    const dailySnapshot = JSON.parse(dailyPlan.generationContextSnapshotJson ?? "{}");
    expect(dailySnapshot.pedagogicalDecisionSupport).toEqual(
      weeklySnapshot.pedagogicalDecisionSupport
    );
    expect(dailySnapshot.pedagogicalDecisionSupport.capIntent.conceitual.length).toBeGreaterThan(0);
    expect(dailySnapshot.pedagogicalDecisionSupport.teacherFacingSummary).toContain("Intenção:");
  });
});
