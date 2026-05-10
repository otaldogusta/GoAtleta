import {
  getRecentCoachInterventions,
  getRecentScoutingImpacts,
  getUpcomingTeamEvents,
  resolveTeamPlanningContext,
  type CoachIntervention,
  type ScoutingImpact,
  type TeamEvent,
} from "../index";

const classId = "class_el_cartel";
const referenceDate = "2026-05-08";

const buildEvent = (overrides: Partial<TeamEvent>): TeamEvent => ({
  id: "event_1",
  classId,
  title: "Amistoso El Cartel",
  type: "friendly",
  date: "2026-05-09",
  importance: "high",
  createdAt: "2026-05-08T08:00:00.000Z",
  ...overrides,
});

const buildIntervention = (
  overrides: Partial<CoachIntervention>
): CoachIntervention => ({
  id: "intervention_1",
  classId,
  date: "2026-05-08",
  type: "tactical",
  summary: "Ajuste de cobertura e organização após bola quebrada",
  tags: ["cobertura", "transição", "comunicação"],
  createdAt: "2026-05-08T09:00:00.000Z",
  ...overrides,
});

const buildScouting = (overrides: Partial<ScoutingImpact>): ScoutingImpact => ({
  id: "scouting_1",
  classId,
  eventId: "event_1",
  date: "2026-05-08",
  strengths: ["bom saque"],
  weaknesses: ["recepção instável"],
  tacticalNotes: ["cobertura atrasou nas bolas largadas"],
  recommendedFocus: ["recepção contextualizada", "transição após defesa"],
  loadImpact: "reduce",
  createdAt: "2026-05-08T10:00:00.000Z",
  ...overrides,
});

describe("team planning context", () => {
  test("amistoso amanhã gera planningMode pre_match", () => {
    const context = resolveTeamPlanningContext({
      classId,
      referenceDate,
      events: [buildEvent({})],
    });

    expect(context.planningMode).toBe("pre_match");
    expect(context.hasUpcomingMatch).toBe(true);
    expect(context.daysUntilMatch).toBe(1);
  });

  test("amistoso amanhã evita carga alta e puxa bias de redução", () => {
    const context = resolveTeamPlanningContext({
      classId,
      referenceDate,
      events: [buildEvent({})],
    });

    expect(context.recommendedLoadBias).toBe("reduce");
    expect(context.avoidHints).toEqual(
      expect.arrayContaining(["fadiga excessiva", "carga alta", "volume desnecessário"])
    );
  });

  test("intervenção tática recente aparece em focusHints", () => {
    const context = resolveTeamPlanningContext({
      classId,
      referenceDate,
      coachInterventions: [buildIntervention({})],
    });

    expect(context.focusHints).toEqual(
      expect.arrayContaining([
        "Ajuste de cobertura e organização após bola quebrada",
        "cobertura",
        "transição",
        "comunicação",
      ])
    );
  });

  test("scouting recente influencia foco e carga", () => {
    const context = resolveTeamPlanningContext({
      classId,
      referenceDate,
      scoutingImpacts: [buildScouting({})],
    });

    expect(context.focusHints).toEqual(
      expect.arrayContaining([
        "recepção instável",
        "recepção contextualizada",
        "transição após defesa",
      ])
    );
    expect(context.recommendedLoadBias).toBe("reduce");
  });

  test("sem evento retorna normal", () => {
    const context = resolveTeamPlanningContext({
      classId,
      referenceDate,
    });

    expect(context.planningMode).toBe("normal");
    expect(context.recommendedLoadBias).toBe("maintain");
    expect(context.hasUpcomingMatch).toBe(false);
  });

  test("evento passado recente pode gerar post_match", () => {
    const context = resolveTeamPlanningContext({
      classId,
      referenceDate: "2026-05-10",
      events: [buildEvent({ date: "2026-05-09" })],
    });

    expect(context.planningMode).toBe("post_match");
    expect(context.recommendedLoadBias).toBe("reduce");
  });

  test("múltiplos sinais são combinados sem quebrar", () => {
    const context = resolveTeamPlanningContext({
      classId,
      referenceDate,
      events: [buildEvent({})],
      coachInterventions: [buildIntervention({})],
      scoutingImpacts: [buildScouting({})],
    });

    expect(context.planningMode).toBe("pre_match");
    expect(context.focusHints).toEqual(
      expect.arrayContaining([
        "ajuste tático",
        "organização coletiva",
        "Ajuste de cobertura e organização após bola quebrada",
        "recepção contextualizada",
      ])
    );
    expect(context.recommendedLoadBias).toBe("reduce");
  });

  test("nenhuma semana vira alta por padrão para 7-9 é refletido por pre_match sem increase", () => {
    const context = resolveTeamPlanningContext({
      classId,
      referenceDate,
      events: [buildEvent({})],
      scoutingImpacts: [buildScouting({ loadImpact: "increase" })],
    });

    expect(context.recommendedLoadBias).not.toBe("increase");
    expect(context.recommendedLoadBias).toBe("reduce");
  });

  test("helper filters upcoming, interventions and scouting by class and window", () => {
    const otherClass = "other";
    expect(
      getUpcomingTeamEvents(
        classId,
        { startDate: "2026-05-08", endDate: "2026-05-10" },
        [
          buildEvent({ id: "1", date: "2026-05-09" }),
          buildEvent({ id: "2", date: "2026-05-15" }),
          buildEvent({ id: "3", classId: otherClass }),
        ]
      )
    ).toHaveLength(1);

    expect(
      getRecentCoachInterventions(
        classId,
        3,
        [
          buildIntervention({ id: "1", date: "2026-05-08" }),
          buildIntervention({ id: "2", date: "2026-05-01" }),
          buildIntervention({ id: "3", classId: otherClass }),
        ],
        referenceDate
      )
    ).toHaveLength(1);

    expect(
      getRecentScoutingImpacts(
        classId,
        3,
        [
          buildScouting({ id: "1", date: "2026-05-08" }),
          buildScouting({ id: "2", date: "2026-05-02" }),
          buildScouting({ id: "3", classId: otherClass }),
        ],
        referenceDate
      )
    ).toHaveLength(1);
  });
});
