import { resolveSessionStrategyFromCycleContext } from "../cycle-day-planning/resolve-session-strategy-from-cycle-context";
import type { CycleDayPlanningContext } from "../models";

const buildContext = (
  overrides: Partial<CycleDayPlanningContext> = {}
): CycleDayPlanningContext => ({
  classId: "class_1",
  sessionDate: "2026-04-10",
  modality: "voleibol",
  classLevel: 2,
  ageBand: "13-15",
  daysPerWeek: 2,
  developmentStage: "especializado",
  planningPhase: "base",
  weekNumber: 5,
  sessionIndexInWeek: 1,
  historicalConfidence: "medium",
  phaseIntent: "exploracao_fundamentos",
  weeklyLoadIntent: "moderado",
  primarySkill: "passe",
  secondarySkill: "levantamento",
  progressionDimensionTarget: "consistencia",
  pedagogicalIntent: "technical_adjustment",
  recentSessions: [],
  targetPse: 5,
  duration: 90,
  materials: ["quadra"],
  constraints: [],
  mustAvoidRepeating: [],
  allowedDrillFamilies: ["bloco_tecnico", "alvo_zona", "cooperacao", "jogo_condicionado"],
  forbiddenDrillFamilies: ["repeticao_estatica_prolongada"],
  ...overrides,
});

describe("resolveSessionStrategyFromCycleContext", () => {
  it("keeps base phase conservative with low opposition and technical emphasis", () => {
    const strategy = resolveSessionStrategyFromCycleContext(
      buildContext({
        phaseIntent: "exploracao_fundamentos",
        planningPhase: "base",
        progressionDimensionTarget: "consistencia",
      })
    );

    expect(strategy.progressionDimension).toBe("precisao");
    expect(strategy.oppositionLevel).toBe("low");
    expect(strategy.gameTransferLevel).toBe("low");
    expect(strategy.drillFamilies[0]).toBe("bloco_tecnico");
  });

  it("pushes development phase toward hybrid technical-tactical progression", () => {
    const strategy = resolveSessionStrategyFromCycleContext(
      buildContext({
        phaseIntent: "estabilizacao_tecnica",
        planningPhase: "desenvolvimento",
        progressionDimensionTarget: "pressao_tempo",
        pedagogicalIntent: "pressure_adaptation",
        allowedDrillFamilies: ["bloco_tecnico", "deslocamento", "alvo_zona"],
      })
    );

    expect(strategy.progressionDimension).toBe("pressao_tempo");
    expect(strategy.timePressureLevel).toBe("high");
    expect(strategy.oppositionLevel).toBe("medium");
    expect(strategy.drillFamilies).toContain("deslocamento");
  });

  it("elevates decision-making and pressure in the pre-competitive phase", () => {
    const strategy = resolveSessionStrategyFromCycleContext(
      buildContext({
        phaseIntent: "aceleracao_decisao",
        planningPhase: "pre_competitivo",
        progressionDimensionTarget: "tomada_decisao",
        pedagogicalIntent: "decision_making",
        weeklyLoadIntent: "alto",
      })
    );

    expect(strategy.progressionDimension).toBe("tomada_decisao");
    expect(strategy.timePressureLevel).toBe("high");
    expect(strategy.gameTransferLevel).toBe("high");
  });

  it("prioritizes transfer and game behavior in the competitive phase", () => {
    const strategy = resolveSessionStrategyFromCycleContext(
      buildContext({
        phaseIntent: "pressao_competitiva",
        planningPhase: "competitivo",
        progressionDimensionTarget: "transferencia_jogo",
        pedagogicalIntent: "game_reading",
        weeklyLoadIntent: "alto",
        allowedDrillFamilies: ["jogo_condicionado", "deslocamento", "bloco_tecnico"],
      })
    );

    expect(strategy.progressionDimension).toBe("transferencia_jogo");
    expect(strategy.oppositionLevel).toBe("high");
    expect(strategy.gameTransferLevel).toBe("high");
    expect(strategy.drillFamilies[0]).toBe("jogo_condicionado");
  });

  it("creates coherent weekly role splits for frequency two classes", () => {
    const firstSession = resolveSessionStrategyFromCycleContext(
      buildContext({
        daysPerWeek: 2,
        sessionIndexInWeek: 1,
        phaseIntent: "estabilizacao_tecnica",
        planningPhase: "desenvolvimento",
        weeklyLoadIntent: "moderado",
        progressionDimensionTarget: "precisao",
      })
    );
    const secondSession = resolveSessionStrategyFromCycleContext(
      buildContext({
        daysPerWeek: 2,
        sessionIndexInWeek: 2,
        phaseIntent: "estabilizacao_tecnica",
        planningPhase: "desenvolvimento",
        weeklyLoadIntent: "moderado",
        progressionDimensionTarget: "precisao",
      })
    );

    expect(firstSession.loadIntent).toBe("moderado");
    expect(secondSession.loadIntent).toBe("moderado");
    expect(firstSession.drillFamilies).not.toEqual(secondSession.drillFamilies);
  });

  it("creates coherent weekly role splits for frequency three classes", () => {
    const firstSession = resolveSessionStrategyFromCycleContext(
      buildContext({
        daysPerWeek: 3,
        sessionIndexInWeek: 1,
        phaseIntent: "transferencia_jogo",
        planningPhase: "competitivo",
        progressionDimensionTarget: "tomada_decisao",
        pedagogicalIntent: "game_reading",
        weeklyLoadIntent: "moderado",
        primarySkill: "ataque",
        secondarySkill: "bloqueio",
      })
    );
    const secondSession = resolveSessionStrategyFromCycleContext(
      buildContext({
        daysPerWeek: 3,
        sessionIndexInWeek: 2,
        phaseIntent: "transferencia_jogo",
        planningPhase: "competitivo",
        progressionDimensionTarget: "tomada_decisao",
        pedagogicalIntent: "game_reading",
        weeklyLoadIntent: "moderado",
        primarySkill: "ataque",
        secondarySkill: "bloqueio",
      })
    );
    const thirdSession = resolveSessionStrategyFromCycleContext(
      buildContext({
        daysPerWeek: 3,
        sessionIndexInWeek: 3,
        phaseIntent: "transferencia_jogo",
        planningPhase: "competitivo",
        progressionDimensionTarget: "tomada_decisao",
        pedagogicalIntent: "game_reading",
        weeklyLoadIntent: "moderado",
        primarySkill: "ataque",
        secondarySkill: "bloqueio",
      })
    );

    expect(firstSession.loadIntent).toBe("baixo");
    expect(secondSession.primarySkill).toBe("bloqueio");
    expect(thirdSession.gameTransferLevel).toBe("high");
    expect(thirdSession.drillFamilies[0]).toBe("jogo_condicionado");
  });

  it("applies conservative teacher override influence without changing macro phase", () => {
    const strategy = resolveSessionStrategyFromCycleContext(
      buildContext({
        phaseIntent: "exploracao_fundamentos",
        planningPhase: "base",
        progressionDimensionTarget: "consistencia",
        recentSessions: [
          {
            sessionDate: "2026-04-08",
            wasPlanned: true,
            wasApplied: true,
            wasEditedByTeacher: true,
            wasConfirmedExecuted: true,
            executionState: "teacher_edited",
            primarySkill: "saque",
            progressionDimension: "transferencia_jogo",
            dominantBlock: "main",
            fingerprint: "saque:transferencia_jogo:main",
            teacherOverrideWeight: "strong",
          },
          {
            sessionDate: "2026-04-05",
            wasPlanned: true,
            wasApplied: true,
            wasEditedByTeacher: true,
            wasConfirmedExecuted: true,
            executionState: "teacher_edited",
            primarySkill: "saque",
            progressionDimension: "transferencia_jogo",
            dominantBlock: "main",
            fingerprint: "saque:transferencia_jogo:main",
            teacherOverrideWeight: "soft",
          },
        ],
      })
    );

    expect(strategy.primarySkill).toBe("saque");
    expect(strategy.progressionDimension).toBe("precisao");
    expect(strategy.loadIntent).toBe("moderado");
  });

  it("changes the generated strategy when dominant block changes under the same phase", () => {
    const baseTecnica = resolveSessionStrategyFromCycleContext(
      buildContext({
        phaseIntent: "estabilizacao_tecnica",
        planningPhase: "desenvolvimento",
        dominantBlock: "Base tecnica",
        primarySkill: "ataque",
        secondarySkill: "levantamento",
        progressionDimensionTarget: "oposicao",
        pedagogicalIntent: "pressure_adaptation",
      })
    );
    const organizacaoOfensiva = resolveSessionStrategyFromCycleContext(
      buildContext({
        phaseIntent: "estabilizacao_tecnica",
        planningPhase: "desenvolvimento",
        dominantBlock: "Organizacao ofensiva",
        primarySkill: "ataque",
        secondarySkill: "levantamento",
        progressionDimensionTarget: "oposicao",
        pedagogicalIntent: "pressure_adaptation",
      })
    );
    const aplicacaoEmJogo = resolveSessionStrategyFromCycleContext(
      buildContext({
        phaseIntent: "transferencia_jogo",
        planningPhase: "competitivo",
        dominantBlock: "Aplicacao em jogo",
        primarySkill: "ataque",
        secondarySkill: "transicao",
        progressionDimensionTarget: "tomada_decisao",
        pedagogicalIntent: "team_organization",
      })
    );

    expect(baseTecnica.primarySkill).toBe("levantamento");
    expect(baseTecnica.progressionDimension).toBe("precisao");
    expect(baseTecnica.pedagogicalIntent).toBe("technical_adjustment");
    expect(organizacaoOfensiva.primarySkill).toBe("levantamento");
    expect(organizacaoOfensiva.progressionDimension).toBe("oposicao");
    expect(organizacaoOfensiva.pedagogicalIntent).toBe("team_organization");
    expect(aplicacaoEmJogo.primarySkill).toBe("transicao");
    expect(aplicacaoEmJogo.progressionDimension).toBe("transferencia_jogo");
    expect(aplicacaoEmJogo.gameTransferLevel).toBe("high");
  });

  it("modulates density and family priority when load signals diverge within the same phase", () => {
    const recoveryDay = resolveSessionStrategyFromCycleContext(
      buildContext({
        phaseIntent: "estabilizacao_tecnica",
        planningPhase: "desenvolvimento",
        progressionDimensionTarget: "oposicao",
        pedagogicalIntent: "pressure_adaptation",
        weeklyLoadIntent: "baixo",
        targetPse: 4,
        demandIndex: 3,
        plannedSessionLoad: 320,
        allowedDrillFamilies: ["bloco_tecnico", "alvo_zona", "deslocamento", "jogo_condicionado"],
      })
    );
    const intensiveDay = resolveSessionStrategyFromCycleContext(
      buildContext({
        phaseIntent: "estabilizacao_tecnica",
        planningPhase: "desenvolvimento",
        progressionDimensionTarget: "oposicao",
        pedagogicalIntent: "pressure_adaptation",
        weeklyLoadIntent: "alto",
        targetPse: 7,
        demandIndex: 8,
        plannedSessionLoad: 630,
        allowedDrillFamilies: ["bloco_tecnico", "alvo_zona", "deslocamento", "jogo_condicionado"],
      })
    );

    expect(recoveryDay.loadIntent).toBe("baixo");
    expect(recoveryDay.drillFamilies[0]).toBe("bloco_tecnico");
    expect(recoveryDay.timePressureLevel).toBe("low");
    expect(intensiveDay.loadIntent).toBe("alto");
    expect(intensiveDay.drillFamilies[0]).toBe("deslocamento");
    expect(intensiveDay.timePressureLevel).toBe("high");
  });
});
