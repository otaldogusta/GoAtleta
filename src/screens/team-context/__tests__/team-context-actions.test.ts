import {
  buildTeamPlanningContextSummary,
  createCoachIntervention,
  createTeamEvent,
  listCoachInterventions,
  listTeamEvents,
} from "../team-context-actions";
import { resetTeamContextStore } from "../team-context-store";

describe("team context actions", () => {
  const classId = "class_el_cartel";

  beforeEach(async () => {
    await resetTeamContextStore();
  });

  test("cria evento de amistoso", async () => {
    const event = await createTeamEvent({
      classId,
      title: "Amistoso El Cartel",
      type: "friendly",
      date: "2026-05-09",
      importance: "high",
    });

    expect(event.type).toBe("friendly");
    expect(event.title).toBe("Amistoso El Cartel");
  });

  test("lista eventos por classId", async () => {
    await createTeamEvent({
      classId,
      title: "Amistoso El Cartel",
      type: "friendly",
      date: "2026-05-09",
      importance: "high",
    });
    await createTeamEvent({
      classId: "other",
      title: "Outro",
      type: "training",
      date: "2026-05-10",
      importance: "low",
    });

    const events = await listTeamEvents(classId);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Amistoso El Cartel");
  });

  test("cria intervenção tática", async () => {
    const intervention = await createCoachIntervention({
      classId,
      date: "2026-05-08",
      type: "tactical",
      summary: "Ajustes de cobertura e comunicação",
      tags: ["cobertura", "comunicação"],
    });

    expect(intervention.type).toBe("tactical");
    expect(intervention.tags).toEqual(["cobertura", "comunicação"]);
  });

  test("contexto com amistoso amanhã mostra pré-jogo", async () => {
    await createTeamEvent({
      classId,
      title: "Amistoso El Cartel",
      type: "friendly",
      date: "2026-05-09",
      importance: "high",
    });

    const summary = await buildTeamPlanningContextSummary(classId, "2026-05-08");
    expect(summary.context.planningMode).toBe("pre_match");
    expect(summary.planningModeLabel).toBe("Pré-jogo");
  });

  test("contexto com intervenção recente mostra foco", async () => {
    await createCoachIntervention({
      classId,
      date: "2026-05-08",
      type: "tactical",
      summary: "Ajustes de cobertura e comunicação",
      tags: ["transição"],
    });

    const summary = await buildTeamPlanningContextSummary(classId, "2026-05-08");
    expect(summary.context.focusHints).toEqual(
      expect.arrayContaining(["Ajustes de cobertura e comunicação", "transição"])
    );
  });

  test("sem eventos mostra normal", async () => {
    const summary = await buildTeamPlanningContextSummary(classId, "2026-05-08");
    expect(summary.context.planningMode).toBe("normal");
    expect(summary.loadBiasLabel).toBe("Manter carga");
  });

  test("lista intervenções por classId", async () => {
    await createCoachIntervention({
      classId,
      date: "2026-05-08",
      type: "tactical",
      summary: "Ajustes de cobertura e comunicação",
    });
    await createCoachIntervention({
      classId: "other",
      date: "2026-05-08",
      type: "technical",
      summary: "Outro contexto",
    });

    const interventions = await listCoachInterventions(classId);
    expect(interventions).toHaveLength(1);
    expect(interventions[0].summary).toBe("Ajustes de cobertura e comunicação");
  });
});
