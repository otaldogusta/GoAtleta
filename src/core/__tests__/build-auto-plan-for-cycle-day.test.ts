import { buildPeriodizationWeekSchedule } from "../../screens/periodization/application/build-auto-plan-for-cycle-day";
import { buildAutoPlanForCycleDay } from "../../screens/session/application/build-auto-plan-for-cycle-day";
import { buildRecentSessionSummary } from "../../screens/session/application/build-recent-session-summary";
import type { ScoutingCounts } from "../scouting";
import type {
    ClassGroup,
    ClassPlan,
    RecentSessionSummary,
    SessionLog,
    Student,
    TrainingPlan,
    TrainingSession,
} from "../models";

const buildClassGroup = (overrides: Partial<ClassGroup> = {}): ClassGroup => ({
  id: "class_1",
  name: "Turma Sub-15",
  organizationId: "org_1",
  unit: "Centro",
  unitId: "unit_1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "13-15",
  gender: "misto",
  startTime: "09:00",
  endTime: "10:30",
  durationMinutes: 90,
  daysOfWeek: [2, 4, 6],
  daysPerWeek: 3,
  goal: "Recepcao e transicao",
  equipment: "quadra",
  level: 2,
  mvLevel: "intermediario",
  cycleStartDate: "2026-03-02",
  cycleLengthWeeks: 52,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

const buildClassPlan = (overrides: Partial<ClassPlan> = {}): ClassPlan => ({
  id: "cp_1",
  classId: "class_1",
  startDate: "2026-03-30",
  weekNumber: 5,
  phase: "desenvolvimento",
  theme: "Recepcao sob pressao",
  technicalFocus: "Passe",
  physicalFocus: "Coordenacao",
  constraints: "bola rapida, leitura",
  mvFormat: "6x6",
  warmupProfile: "dinamico",
  jumpTarget: "baixo",
  rpeTarget: "PSE 5",
  source: "AUTO",
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

const buildStudent = (overrides: Partial<Student> = {}): Student => ({
  id: "student_1",
  name: "Ana",
  organizationId: "org_1",
  classId: "class_1",
  age: 14,
  phone: "",
  loginEmail: "",
  guardianName: "",
  guardianPhone: "",
  guardianRelation: "",
  birthDate: "2012-01-01",
  healthIssue: false,
  healthIssueNotes: "",
  medicationUse: false,
  medicationNotes: "",
  healthObservations: "",
  positionPrimary: "indefinido",
  positionSecondary: "indefinido",
  athleteObjective: "base",
  learningStyle: "misto",
  createdAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

const buildTrainingPlan = (overrides: Partial<TrainingPlan> = {}): TrainingPlan => ({
  id: "plan_1",
  classId: "class_1",
  title: "Treino base",
  tags: [],
  warmup: ["Mobilidade"],
  main: ["Passe alvo"],
  cooldown: ["Respiracao"],
  warmupTime: "15 min",
  mainTime: "40 min",
  cooldownTime: "5 min",
  applyDays: [2],
  applyDate: "2026-04-07",
  createdAt: "2026-04-01T10:00:00.000Z",
  version: 1,
  status: "generated",
  origin: "auto",
  inputHash: "hash_1",
  pedagogy: {
    focus: { skill: "passe" },
    progression: { dimension: "consistencia" },
    sessionObjective: "Estabilizar recepcao",
  },
  ...overrides,
});

const buildTrainingSession = (overrides: Partial<TrainingSession> = {}): TrainingSession => ({
  id: "session_1",
  organizationId: "org_1",
  title: "Sessao",
  description: "",
  startAt: "2026-04-07T12:00:00.000Z",
  endAt: "2026-04-07T13:30:00.000Z",
  status: "completed",
  type: "training",
  source: "plan",
  planId: "plan_1",
  classIds: ["class_1"],
  createdAt: "2026-04-07T12:00:00.000Z",
  updatedAt: "2026-04-07T13:30:00.000Z",
  ...overrides,
});

const buildSessionLog = (overrides: Partial<SessionLog> = {}): SessionLog => ({
  id: "log_1",
  classId: "class_1",
  PSE: 5,
  technique: "ok",
  attendance: 0,
  activity: "Sessao aplicada com ajustes do professor",
  conclusion: "Boa resposta apos editar o foco principal",
  photos: "",
  createdAt: "2026-04-07T13:40:00.000Z",
  ...overrides,
});

const buildRecentSession = (
  overrides: Partial<RecentSessionSummary> = {}
): RecentSessionSummary => ({
  sessionDate: "2026-04-05",
  wasPlanned: true,
  wasApplied: true,
  wasEditedByTeacher: false,
  wasConfirmedExecuted: true,
  executionState: "confirmed_executed",
  primarySkill: "ataque",
  secondarySkill: "bloqueio",
  progressionDimension: "tomada_decisao",
  dominantBlock: "main",
  fingerprint: "ataque:tomada_decisao:main",
  teacherOverrideWeight: "none",
  ...overrides,
});

describe("buildAutoPlanForCycleDay", () => {
  it("still builds a valid pedagogical package for classes with no history", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup({ daysPerWeek: 2, daysOfWeek: [2, 5] }),
      classPlan: buildClassPlan({ phase: "base", rpeTarget: "PSE 4" }),
      students: [buildStudent()],
      sessionDate: "2026-04-07",
      recentPlans: [],
    });

    expect(result.cycleContext.historicalConfidence).toBe("none");
    expect(result.repetitionAdjustment.detected).toBe(false);
    expect(result.explanation.historyMode).toBe("bootstrap");
    expect(result.explanation.debug.historicalConfidence).toBe("none");
    expect(result.package.input.duration).toBe(90);
    expect(result.package.input.periodizationPhase).toBe("base");
    expect(result.package.final.main.activities.length).toBeGreaterThan(0);
    expect(result.ageSanitizer.ageBand).toBe("13-15");
    expect(result.ageSanitizer.developmentStage).toBe("especializado");
    expect(result.pedagogyEnvelope.languageProfile).toBe("juvenil");
    expect(result.pedagogyEnvelope.mainStyle.length).toBeLessThanOrEqual(3);
    expect(result.pedagogyEnvelope.cooldownStyle.length).toBeLessThanOrEqual(2);
  });

  it("sanitizes adult warmup language for fundamental age bands", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup({
        ageBand: "09-11",
        goal: "Fundamentos + jogo reduzido",
        level: 1,
      }),
      classPlan: buildClassPlan({
        phase: "base",
        theme: "Recepcao e movimento",
        technicalFocus: "Passe",
      }),
      students: [buildStudent({ age: 10, birthDate: "2016-01-01" })],
      sessionDate: "2026-04-07",
      recentPlans: [],
    });

    expect(result.ageSanitizer.developmentStage).toBe("fundamental");
    expect(result.ageSanitizer.ageBand).toBe("09-11");
    expect(typeof result.ageSanitizer.warmupSummary).toBe("string");
    expect(["engine", "age_sanitizer"]).toContain(result.ageSanitizer.warmupSource);
    expect(Array.isArray(result.ageSanitizer.ageSanitizerReasons)).toBe(true);
    expect(result.pedagogyEnvelope.languageProfile).toBe("infantil");
    expect(["ludico", "guiado"]).toContain(result.pedagogyEnvelope.tone);
    expect(result.pedagogyEnvelope.feedbackStyle).toBe("positivo_curto");
    expect(result.pedagogyEnvelope.mainStyle.length).toBeLessThanOrEqual(3);
    expect(result.pedagogyEnvelope.cooldownStyle.length).toBeLessThanOrEqual(2);
    if (result.ageSanitizer.usedAgeSanitizer) {
      expect(result.package.final.warmup.summary || "").not.toContain("sem dor reportada");
      expect(result.ageSanitizer.warmupSource).toBe("age_sanitizer");
      expect(result.ageSanitizer.ageSanitizerReasons).toContain("clinical_warmup_language");
    }
  });

  it("uses the new context and strategy pipeline to shape the generated context", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup({ daysPerWeek: 3, daysOfWeek: [2, 4, 6] }),
      classPlan: buildClassPlan({
        phase: "competitivo",
        theme: "Ataque e cobertura",
        technicalFocus: "",
        rpeTarget: "PSE 6",
      }),
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [buildTrainingPlan()],
      recentSessions: [
        buildRecentSession(),
        buildRecentSession({
          sessionDate: "2026-04-03",
          wasEditedByTeacher: true,
          executionState: "teacher_edited",
          teacherOverrideWeight: "strong",
        }),
      ],
      sessionIndexInWeek: 2,
    });

    expect(result.cycleContext.sessionIndexInWeek).toBe(2);
    expect(typeof result.fingerprint).toBe("string");
    expect(result.explanation.historyMode).toBe("strong_history");
    expect(result.generationContext.primarySkill).toBe(result.strategy.primarySkill);
    expect(result.generationContext.progressionDimensionTarget).toBe(
      result.strategy.progressionDimension
    );
    expect(result.generationContext.allowedDrillFamilies).toEqual(result.strategy.drillFamilies);
    expect(result.package.input.constraints).toContain(
      `Skill principal: ${result.strategy.primarySkill}.`
    );
    expect(
      result.package.input.constraints.some((item) => item.includes("Favorecer familias:"))
    ).toBe(true);
  });

  it("carries teacher override influence into the auto-plan pipeline conservatively", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup({ daysPerWeek: 2, daysOfWeek: [2, 5] }),
      classPlan: buildClassPlan({ phase: "base", technicalFocus: "", theme: "Saque" }),
      students: [buildStudent()],
      sessionDate: "2026-04-07",
      recentPlans: [buildTrainingPlan()],
      recentSessions: [
        buildRecentSession({
          primarySkill: "saque",
          progressionDimension: "transferencia_jogo",
          wasEditedByTeacher: true,
          executionState: "teacher_edited",
          teacherOverrideWeight: "strong",
        }),
        buildRecentSession({
          sessionDate: "2026-04-03",
          primarySkill: "saque",
          progressionDimension: "transferencia_jogo",
          wasEditedByTeacher: true,
          executionState: "teacher_edited",
          teacherOverrideWeight: "soft",
        }),
      ],
    });

    expect(result.strategy.primarySkill).toBe("saque");
    expect(result.strategy.progressionDimension).toBe("consistencia");
    expect(result.overrideAdjusted).toBe(true);
    expect(result.explanation.debug.operationalRulesApplied).toContain("recent_history_review_lock");
    expect(result.explanation.debug.overrideStrength).toBe("strong");
    expect(result.explanation.debug.overrideLearningWindowGenerations).toBe(3);
    expect(result.explanation.coachSummary).toContain("Aprendizado local do professor (forte)");
    expect(result.explanation.coachSummary).toContain("próximas 3 gerações");
    expect(result.package.input.constraints).toContain("Skill principal: saque.");
    expect(result.package.input.periodizationPhase).toBe("base");
  });

  it("builds a structured session planning context that shapes the final activities", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup({
        ageBand: "10-12",
        durationMinutes: 60,
        daysPerWeek: 2,
        daysOfWeek: [2, 5],
      }),
      classPlan: buildClassPlan({
        phase: "pre_competitivo",
        theme: "Recepcao com comunicacao",
        technicalFocus: "Passe",
        rpeTarget: "PSE 6",
      }),
      students: [buildStudent({ id: "student_1" }), buildStudent({ id: "student_2" })],
      sessionDate: "2026-04-10",
      recentPlans: [
        buildTrainingPlan({
          main: ["Passe para alvo"],
          pedagogy: {
            focus: { skill: "passe" },
            progression: { dimension: "tomada_decisao" },
            sessionObjective: "Comunicação no passe com dificuldade de decisão",
          },
        }),
      ],
      upcomingEvents: [
        { title: "Festival da unidade", date: "2026-04-13", classScoped: true },
      ],
      sessionIndexInWeek: 2,
    });
    const visibleText = [
      ...result.package.final.warmup.activities,
      ...result.package.final.main.activities,
      ...result.package.final.cooldown.activities,
    ]
      .map((activity) => `${activity.name} ${activity.presentation?.standardText ?? ""}`)
      .join(" ");

    expect(result.sessionPlanningContext.skillFocus).toBe("passe");
    expect(result.sessionPlanningContext.classProfile.size).toBe(2);
    expect(result.sessionPlanningContext.upcomingEvents[0]?.title).toBe("Festival da unidade");
    expect(result.package.input.sessionPlanningContext?.recentDifficulties).toContain("comunicacao");
    expect(result.package.input.sessionPlanningContext?.recentActivityFamilies).toContain("alvo_zona");
    expect(visibleText).toContain("Quem recebe chama a bola antes do contato");
    expect(visibleText).toContain("Festival da unidade em 13/04");
    expect(visibleText.toLowerCase()).not.toContain("levantamento");
    expect(visibleText).not.toContain("Foco do professor:");
    expect(visibleText).not.toContain("Critério de sucesso:");
    expect(visibleText).not.toContain("Adaptação:");
  });

  it("does not invent event reminders when no class or unit event is provided", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup({ ageBand: "10-12", daysPerWeek: 2, daysOfWeek: [2, 5] }),
      classPlan: buildClassPlan({
        phase: "desenvolvimento",
        theme: "Recepcao com continuidade",
        technicalFocus: "Passe",
      }),
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [buildTrainingPlan()],
      upcomingEvents: [],
    });
    const visibleText = [
      ...result.package.final.warmup.activities,
      ...result.package.final.main.activities,
      ...result.package.final.cooldown.activities,
    ]
      .map((activity) => `${activity.name} ${activity.presentation?.standardText ?? ""}`)
      .join(" ");

    expect(result.sessionPlanningContext.upcomingEvents).toEqual([]);
    expect(visibleText).not.toMatch(/Festival|torneio|amistoso|cronograma/i);
  });

  it("surfaces dominant block influence in the explanation and strategy output", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup(),
      classPlan: buildClassPlan({
        phase: "desenvolvimento",
        physicalFocus: "Organizacao ofensiva",
        technicalFocus: "Ataque",
      }),
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [buildTrainingPlan()],
    });

    expect(result.cycleContext.dominantBlock).toBe("Organizacao ofensiva");
    expect(result.strategy.pedagogicalIntent).toBe("team_organization");
    expect(result.explanation.debug.dominantBlockAdjusted).toBe(true);
    expect(result.explanation.coachSummary).toContain("Bloco organizacao ofensiva priorizado");
  });

  it("surfaces load modulation in the explanation when the week target is intensive", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup(),
      classPlan: buildClassPlan({
        phase: "competitivo",
        rpeTarget: "PSE 7",
        technicalFocus: "Ataque",
      }),
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [buildTrainingPlan()],
    });

    expect(result.strategy.loadIntent).toBe("alto");
    expect(result.explanation.debug.loadProfileKey).toBe("intensive");
    expect(result.explanation.debug.loadAdjusted).toBe(true);
    expect(result.explanation.coachSummary).toContain("Carga intensiva");
  });

  it("surfaces anti-repetition adjustment when a recent exact clone exists", () => {
    const baseline = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup(),
      classPlan: buildClassPlan({ technicalFocus: "Passe" }),
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [buildTrainingPlan()],
      recentSessions: [],
    });

    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup(),
      classPlan: buildClassPlan({ technicalFocus: "Passe" }),
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [buildTrainingPlan()],
      recentSessions: [
        buildRecentSession({
          sessionDate: "2026-04-03",
          primarySkill: baseline.strategy.primarySkill,
          secondarySkill: baseline.strategy.secondarySkill,
          progressionDimension: baseline.strategy.progressionDimension,
          dominantBlock: baseline.cycleContext.dominantBlock,
          fingerprint: baseline.fingerprint,
          structuralFingerprint: baseline.structuralFingerprint,
        }),
      ],
    });

    expect(result.repetitionAdjustment.detected).toBe(true);
    expect(result.repetitionAdjustment.changedFields.length).toBeGreaterThan(0);
    expect(result.explanation.coachSummary).toContain("Variação anti-repetição aplicada");
  });

  it("closes the periodization to session learning loop after apply and teacher edit", () => {
    const classGroup = buildClassGroup({ daysPerWeek: 2, daysOfWeek: [2, 5] });
    const classPlan = buildClassPlan({ phase: "base", technicalFocus: "Passe", theme: "Recepcao" });
    const weekSchedule = buildPeriodizationWeekSchedule({
      classGroup,
      classPlan,
      weekPlan: {
        week: 5,
        title: "base",
        focus: "Recepcao",
        volume: "baixo",
        notes: ["construcao", "controle"],
        jumpTarget: "baixo",
        PSETarget: "PSE 4",
        plannedSessionLoad: 320,
        plannedWeeklyLoad: 640,
        source: "AUTO",
      },
      cycleStartDate: classGroup.cycleStartDate,
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions: 2,
      dominantBlock: "Base tecnica",
    });

    const firstSuggestedSession = weekSchedule.find((item) => item.autoPlan);

    expect(firstSuggestedSession?.autoPlan).toBeTruthy();

    const suggestedDate = firstSuggestedSession!.date;
    const suggestedAutoPlan = firstSuggestedSession!.autoPlan!;

    const generatedPlan = buildTrainingPlan({
      id: "plan_generated",
      applyDate: suggestedDate,
      applyDays: [2],
      status: "generated",
      origin: "auto",
      inputHash: suggestedAutoPlan.fingerprint,
      pedagogy: {
        focus: { skill: suggestedAutoPlan.strategy.primarySkill },
        progression: { dimension: suggestedAutoPlan.strategy.progressionDimension },
        methodology: { approach: "analitico" },
        sessionObjective: suggestedAutoPlan.sessionLabel,
      },
    });
    const editedPlan = buildTrainingPlan({
      id: "plan_final",
      applyDate: suggestedDate,
      applyDays: [2],
      status: "final",
      origin: "edited_auto",
      previousVersionId: "plan_generated",
      parentPlanId: "plan_generated",
      version: 2,
      inputHash: "edited_hash",
      main: ["Saque tatico", "Leitura e decisao"],
      pedagogy: {
        focus: { skill: "saque" },
        progression: { dimension: "transferencia_jogo" },
        methodology: { approach: "jogo" },
        override: {
          type: "methodology",
          fromRuleId: "rule_a",
          toRuleId: "rule_b",
          fromApproach: "analitico",
          toApproach: "jogo",
          createdAt: `${suggestedDate}T14:00:00.000Z`,
        },
        sessionObjective: "Saque sob pressao com leitura",
      },
    });
    const appliedSession = buildTrainingSession({
      id: "session_applied",
      startAt: `${suggestedDate}T12:00:00.000Z`,
      endAt: `${suggestedDate}T13:30:00.000Z`,
      planId: "plan_final",
      classIds: [classGroup.id],
    });
    const recentSummaries = buildRecentSessionSummary({
      classId: classGroup.id,
      plans: [generatedPlan, editedPlan],
      sessions: [appliedSession],
      sessionLogs: [
        buildSessionLog({
          classId: classGroup.id,
          createdAt: `${suggestedDate}T13:40:00.000Z`,
        }),
      ],
    });

    expect(recentSummaries).toHaveLength(1);
    expect(recentSummaries[0]).toMatchObject({
      wasApplied: true,
      wasEditedByTeacher: true,
      executionState: "teacher_edited",
      teacherOverrideWeight: "strong",
    });

    const regenerated = buildAutoPlanForCycleDay({
      classGroup,
      classPlan,
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [editedPlan],
      recentSessions: recentSummaries,
      sessionIndexInWeek: 2,
    });

    expect(regenerated.explanation.historyMode).toBe("partial_history");
    expect(regenerated.recentSessions[0]?.wasEditedByTeacher).toBe(true);
    expect(regenerated.overrideAdjusted).toBe(true);
    expect(regenerated.explanation.debug.overrideStrength).toBe("strong");
    expect(regenerated.explanation.coachSummary).toContain("Aprendizado local do professor (forte)");
  });

  it("builds a structured decision trace for periodized generated sessions", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup({
        ageBand: "07-09",
        level: 1,
        goal: "Passe e manchete",
      }),
      classPlan: buildClassPlan({
        id: "cp_trace",
        weekNumber: 7,
        phase: "base",
        theme: "Recepcao com comunicacao",
        technicalFocus: "Passe",
        rpeTarget: "PSE 4",
      }),
      students: [buildStudent({ age: 8 })],
      sessionDate: "2026-04-10",
      recentPlans: [
        buildTrainingPlan({
          pedagogy: {
            focus: { skill: "passe" },
            progression: { dimension: "consistencia" },
            sessionObjective: "Comunicação no primeiro contato",
          },
        }),
      ],
      recentSessions: [
        buildRecentSession({
          primarySkill: "passe",
          progressionDimension: "consistencia",
        }),
      ],
    });

    expect(result.decisionTrace.schemaVersion).toBe(1);
    expect(result.decisionTrace.source).toMatchObject({
      classId: "class_1",
      sessionDate: "2026-04-10",
      classPlanId: "cp_trace",
      classPlanWeekNumber: 7,
    });
    expect(result.decisionTrace.influences.periodization).toMatchObject({
      used: true,
      technicalFocus: "Passe",
      theme: "Recepcao com comunicacao",
      phase: "base",
      rpeTarget: "PSE 4",
    });
    expect(result.decisionTrace.decision.primarySkill).toBe(result.strategy.primarySkill);
    expect(result.decisionTrace.decision.progressionDimension).toBe(
      result.strategy.progressionDimension
    );
    expect(result.decisionTrace.decision.pedagogicalIntent).toBe(
      result.strategy.pedagogicalIntent
    );
    expect(result.decisionTrace.decision.phaseIntent).toBe(result.cycleContext.phaseIntent);
    expect(result.decisionTrace.plannedContext.weekNumber).toBe(7);
    expect(result.decisionTrace.influences.history.used).toBe(true);
    expect(result.decisionTrace.influences.history.recentSkills).toContain("passe");
    expect(result.decisionTrace.influences.classContext.used).toBe(true);
    expect(result.decisionTrace.teacherFacingSummary).toContain("A aula prioriza");
    expect(result.decisionTrace.teacherFacingSummary).not.toMatch(
      /IA analisou|par[âa]metros avançados|otimizar a aprendizagem/i
    );
  });

  it("keeps decision trace aligned with the first explicit skill in mixed periodization focus", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup({
        name: "Turma 07-09",
        ageBand: "07-09",
        level: 1,
        daysOfWeek: [6],
        daysPerWeek: 1,
        goal: "Fundamentos",
        durationMinutes: 60,
      }),
      classPlan: buildClassPlan({
        id: "cp_mixed_focus",
        weekNumber: 25,
        phase: "desenvolvimento",
        theme: "Consolidação técnica · Aplicação",
        technicalFocus:
          "Aplicação de passe ao alvo, saque direcionado e levantamento simples em situações da semana",
        constraints: "Consistência e direção, Sequências de 2-3 contatos",
        rpeTarget: "4-5",
      }),
      students: [buildStudent({ age: 8 })],
      sessionDate: "2026-06-20",
      recentSessions: [
        buildRecentSession({
          sessionDate: "2026-06-13",
          primarySkill: "levantamento",
          progressionDimension: "consistencia",
        }),
      ],
    });

    const visibleText = [
      result.package.final.warmup,
      result.package.final.main,
      result.package.final.cooldown,
    ]
      .flatMap((block) => block.activities.map((activity) => `${activity.name} ${activity.description}`))
      .join(" ");

    expect(result.strategy.primarySkill).toBe("passe");
    expect(result.decisionTrace.decision.primarySkill).toBe("passe");
    expect(result.decisionTrace.teacherFacingSummary).toContain("A aula prioriza passe");
    expect(result.decisionTrace.teacherFacingSummary).not.toContain("prioriza levantamento");
    expect(result.package.final.main.activities.every((activity) => activity.primarySkill === "passe"))
      .toBe(true);
    expect(visibleText).toContain("Passe em duplas para voltar jogável");
    expect(visibleText).not.toMatch(/Passe orientado|Cone pega-toque|segundo contato/i);
  });

  it("marks periodization and scouting as unused when no real signals are provided", () => {
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup({
        ageBand: "10-12",
        goal: "Fundamentos",
      }),
      classPlan: null,
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [],
      recentSessions: [],
      upcomingEvents: [],
    });

    expect(result.decisionTrace.influences.periodization.used).toBe(false);
    expect(result.decisionTrace.influences.classContext.used).toBe(true);
    expect(result.decisionTrace.influences.scouting.used).toBe(false);
    expect(result.decisionTrace.influences.scouting.confidence).toBe("none");
    expect(result.decisionTrace.influences.history.used).toBe(false);
    expect(result.decisionTrace.influences.reportFeedback.used).toBe(false);
    expect(result.decisionTrace.safeguards.fallbackUsed).toBe(false);
  });

  it("records scouting and report feedback signals when they shape the context", () => {
    const scoutingCounts: ScoutingCounts = {
      serve: { 0: 0, 1: 2, 2: 4 },
      receive: { 0: 8, 1: 2, 2: 0 },
      set: { 0: 0, 1: 0, 2: 0 },
      attack_send: { 0: 0, 1: 0, 2: 0 },
    };
    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup({
        ageBand: "10-12",
        goal: "Passe e recepcao",
      }),
      classPlan: buildClassPlan({
        technicalFocus: "",
        theme: "Recepcao",
      }),
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      scoutingCounts,
      recentPlans: [buildTrainingPlan()],
      recentSessions: [
        buildRecentSession({
          pedagogicalFeedbackSignals: ["low_participation", "recurring_technical_difficulty"],
        }),
      ],
    });

    expect(result.decisionTrace.influences.scouting.used).toBe(true);
    expect(result.decisionTrace.influences.scouting.sampleSize).toBe(16);
    expect(result.decisionTrace.influences.scouting.confidence).toBe("medium");
    expect(result.decisionTrace.influences.scouting.dominantGapSkill).toBe("passe");
    expect(result.decisionTrace.influences.scouting.dominantGapType).toBeDefined();
    expect(result.decisionTrace.influences.reportFeedback.used).toBe(true);
    expect(result.decisionTrace.influences.reportFeedback.signals).toEqual(
      expect.arrayContaining(["low_participation", "recurring_technical_difficulty"])
    );
    expect(result.decisionTrace.influences.reportFeedback.adjusted).toBe(true);
    expect(result.decisionTrace.influences.reportFeedback.rulesApplied).toEqual(
      expect.arrayContaining([
        "report_feedback_participation_rebuild",
        "report_feedback_technical_regression",
      ])
    );
    expect(result.explanation.debug.reportFeedbackAdjusted).toBe(true);
    expect(result.explanation.debug.reportFeedbackSignals).toEqual(
      expect.arrayContaining(["low_participation", "recurring_technical_difficulty"])
    );
    expect(result.explanation.debug.reportFeedbackRulesApplied).toEqual(
      expect.arrayContaining([
        "report_feedback_participation_rebuild",
        "report_feedback_technical_regression",
      ])
    );
  });

  it("uses previous report feedback to reduce complexity without changing the planned skill", () => {
    const classGroup = buildClassGroup({
      ageBand: "13-15",
      daysPerWeek: 2,
      daysOfWeek: [2, 5],
      goal: "Ataque e transicao",
      level: 3,
    });
    const classPlan = buildClassPlan({
      phase: "desenvolvimento",
      theme: "Ataque com leitura",
      technicalFocus: "Ataque",
      rpeTarget: "PSE 6",
    });
    const baseline = buildAutoPlanForCycleDay({
      classGroup,
      classPlan,
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentSessions: [
        buildRecentSession({
          sessionDate: "2026-04-03",
          primarySkill: "defesa",
          progressionDimension: "pressao_tempo",
        }),
      ],
      sessionIndexInWeek: 2,
    });
    const withReportFeedback = buildAutoPlanForCycleDay({
      classGroup,
      classPlan,
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentSessions: [
        buildRecentSession({
          sessionDate: "2026-04-03",
          primarySkill: "defesa",
          progressionDimension: "pressao_tempo",
          pedagogicalFeedbackSignals: [
            "low_participation",
            "class_agitation",
            "recurring_technical_difficulty",
          ],
        }),
      ],
      sessionIndexInWeek: 2,
    });

    expect(withReportFeedback.strategy.primarySkill).toBe(baseline.strategy.primarySkill);
    expect(withReportFeedback.strategy.primarySkill).toBe("ataque");
    expect(withReportFeedback.explanation.debug.reportFeedbackAdjusted).toBe(true);
    expect(withReportFeedback.explanation.debug.reportFeedbackRulesApplied).toEqual(
      expect.arrayContaining([
        "report_feedback_participation_rebuild",
        "report_feedback_climate_mediation",
        "report_feedback_technical_regression",
      ])
    );
    expect(withReportFeedback.strategy.loadIntent).not.toBe("alto");
    expect(withReportFeedback.strategy.oppositionLevel).not.toBe("high");
    expect(withReportFeedback.strategy.timePressureLevel).not.toBe("high");
    expect(withReportFeedback.strategy.pedagogicalIntent).toBe("technical_adjustment");
    expect(withReportFeedback.decisionTrace.influences.reportFeedback).toMatchObject({
      used: true,
      adjusted: true,
    });
  });

  it("records anti-repetition safeguards in the decision trace", () => {
    const baseline = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup(),
      classPlan: buildClassPlan({ technicalFocus: "Passe" }),
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [buildTrainingPlan()],
      recentSessions: [],
    });

    const result = buildAutoPlanForCycleDay({
      classGroup: buildClassGroup(),
      classPlan: buildClassPlan({ technicalFocus: "Passe" }),
      students: [buildStudent()],
      sessionDate: "2026-04-10",
      recentPlans: [buildTrainingPlan()],
      recentSessions: [
        buildRecentSession({
          sessionDate: "2026-04-03",
          primarySkill: baseline.strategy.primarySkill,
          secondarySkill: baseline.strategy.secondarySkill,
          progressionDimension: baseline.strategy.progressionDimension,
          dominantBlock: baseline.cycleContext.dominantBlock,
          fingerprint: baseline.fingerprint,
          structuralFingerprint: baseline.structuralFingerprint,
        }),
      ],
    });

    expect(result.decisionTrace.safeguards.repetitionAdjusted).toBe(true);
    expect(result.decisionTrace.influences.history.used).toBe(true);
    expect(result.decisionTrace.influences.history.mustAvoidRepeating.length).toBeGreaterThan(0);
  });
});
