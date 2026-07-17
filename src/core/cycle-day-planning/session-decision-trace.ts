import type {
  ClassPlan,
  CycleDayPlanningContext,
  RepetitionAdjustment,
  SessionStrategy,
} from "../models";
import type { SessionPedagogyEnvelopeDiagnostics } from "../resolve-session-pedagogy-envelope";
import type { AgeSanitizerDiagnostics } from "../sanitize-plan-for-age-band";
import { getTotalActions, type ScoutingCounts, type ScoutingPlanningSignal } from "../scouting";
import type {
  SessionPlanningContext,
  SessionPlanningDailyPlanAnchor,
} from "../session-planning-context-contract";
import type { ReportFeedbackInfluence } from "./apply-report-feedback-rules";
import type { CycleDayGenerationExplanation } from "./format-generation-explanation";

export type SessionDecisionTrace = {
  schemaVersion: 1;
  source: {
    classId: string;
    sessionDate: string;
    classPlanId?: string;
    classPlanWeekNumber?: number;
  };
  plannedContext: {
    ageBand: string;
    classLevel: number;
    planningPhase?: CycleDayPlanningContext["planningPhase"];
    weekNumber?: number;
    sessionIndexInWeek: number;
    loadIntent: SessionStrategy["loadIntent"];
    plannedSessionLoad?: number;
    plannedWeeklyLoad?: number;
  };
  decision: {
    primarySkill: SessionStrategy["primarySkill"];
    secondarySkill?: SessionStrategy["secondarySkill"];
    progressionDimension: SessionStrategy["progressionDimension"];
    pedagogicalIntent: SessionStrategy["pedagogicalIntent"];
    phaseIntent: CycleDayPlanningContext["phaseIntent"];
  };
  influences: {
    periodization: {
      used: boolean;
      technicalFocus?: string;
      theme?: string;
      phase?: string;
      rpeTarget?: string;
      weeklyOperationalDecision?: string;
    };
    periodizationDaily: {
      used: boolean;
      dailyPlanId?: string;
      weeklyPlanId?: string;
      title?: string;
      sourceObjective?: string;
      conflictResolved?: boolean;
      conflictReasons: string[];
    };
    classContext: {
      used: boolean;
      goal?: string;
      modality?: string;
      materials: string[];
      constraints: string[];
    };
    scouting: {
      used: boolean;
      dominantGapSkill?: CycleDayPlanningContext["dominantGapSkill"];
      dominantGapType?: CycleDayPlanningContext["dominantGapType"];
      confidence?: "none" | "low" | "medium" | "high";
      sampleSize?: number;
    };
    history: {
      used: boolean;
      historicalConfidence: CycleDayPlanningContext["historicalConfidence"];
      recentSkills: SessionStrategy["primarySkill"][];
      mustAvoidRepeating: string[];
      mustProgressFrom?: string;
    };
    reportFeedback: {
      used: boolean;
      signals: string[];
      rulesApplied?: string[];
      adjusted?: boolean;
    };
    documentContext?: {
      used: boolean;
      referenceCount: number;
      planningSourceTitle?: string;
      sourceScopes: string[];
      actionDate?: string;
      warnings: string[];
      readOnly: true;
    };
  };
  safeguards: {
    repetitionAdjusted: boolean;
    overrideAdjusted: boolean;
    fallbackUsed: boolean;
    ageSanitizerFlags: string[];
    envelopeDiagnostics: string[];
  };
  teacherFacingSummary: string;
};

const cleanList = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const hasRealClassPlan = (classPlan?: ClassPlan | null) =>
  Boolean(
    classPlan &&
      cleanList([
        classPlan.technicalFocus,
        classPlan.theme,
        classPlan.phase,
        classPlan.rpeTarget,
      ]).length
  );

const resolveScoutingConfidence = (sampleSize: number): "none" | "low" | "medium" | "high" => {
  if (sampleSize <= 0) return "none";
  if (sampleSize < 8) return "low";
  if (sampleSize < 20) return "medium";
  return "high";
};

const buildTeacherFacingSummary = (params: {
  trace: Omit<SessionDecisionTrace, "teacherFacingSummary">;
}) => {
  const periodization = params.trace.influences.periodization;
  const periodizationDaily = params.trace.influences.periodizationDaily;
  const history = params.trace.influences.history;
  const scouting = params.trace.influences.scouting;
  const documentContext = params.trace.influences.documentContext;
  const reasons = [
    periodizationDaily.used
      ? `o plano do dia indica ${periodizationDaily.sourceObjective || periodizationDaily.title || "essa intenção"}`
      : null,
    periodization.used
      ? `o planejamento da semana indica ${periodization.technicalFocus || periodization.theme || "esse foco"}`
      : null,
    scouting.used && scouting.dominantGapSkill
      ? `o scouting apontou necessidade em ${scouting.dominantGapSkill}`
      : null,
    history.used && history.mustAvoidRepeating.length
      ? "o histórico recente pediu variação"
      : null,
    documentContext?.planningSourceTitle
      ? `a fonte ${documentContext.planningSourceTitle} orienta o período`
      : documentContext?.used
        ? "referências documentais autorizadas complementam o contexto"
        : null,
  ].filter(Boolean);

  const reasonText = reasons.length
    ? reasons.join(", ")
    : "o contexto atual da turma orienta esse foco";

  return `A aula prioriza ${params.trace.decision.primarySkill} porque ${reasonText}.`;
};

export const buildSessionDecisionTrace = (params: {
  cycleContext: CycleDayPlanningContext;
  classPlan?: ClassPlan | null;
  strategy: SessionStrategy;
  sessionPlanningContext: SessionPlanningContext;
  explanation: CycleDayGenerationExplanation;
  repetitionAdjustment: RepetitionAdjustment;
  overrideAdjusted: boolean;
  reportFeedbackInfluence?: ReportFeedbackInfluence;
  scoutingCounts?: ScoutingCounts | null;
  scoutingSignal?: ScoutingPlanningSignal | null;
  dailyPlanAnchor?: SessionPlanningDailyPlanAnchor | null;
  ageSanitizer: AgeSanitizerDiagnostics;
  pedagogyEnvelope: SessionPedagogyEnvelopeDiagnostics;
}): SessionDecisionTrace => {
  const scoutingSampleSize =
    params.scoutingSignal?.sampleSize ??
    (params.scoutingCounts ? getTotalActions(params.scoutingCounts) : 0);
  const scoutingConfidence =
    params.scoutingSignal?.confidence ?? resolveScoutingConfidence(scoutingSampleSize);
  const scoutingUsed =
    scoutingSampleSize > 0 ||
    Boolean(params.cycleContext.dominantGapSkill || params.cycleContext.dominantGapType);
  const recentSkills = params.cycleContext.recentSessions
    .map((session) => session.primarySkill)
    .filter((skill): skill is SessionStrategy["primarySkill"] => Boolean(skill));
  const periodizationUsed = hasRealClassPlan(params.classPlan);
  const reportSignals = cleanList(params.sessionPlanningContext.reportFeedback?.notes ?? []);
  const reportRulesApplied = cleanList(params.reportFeedbackInfluence?.rulesApplied ?? []);
  const documentSupport =
    params.sessionPlanningContext.documentSupport ??
    params.sessionPlanningContext.academicSupport;
  const documentReferences = documentSupport?.references ?? [];
  const planningSource = documentReferences.find(
    (reference) =>
      reference.isPrimaryPlanningSource ||
      (reference.sourceScope === "class_planning" &&
        reference.documentType === "monthly_plan")
  );

  const traceWithoutSummary: Omit<SessionDecisionTrace, "teacherFacingSummary"> = {
    schemaVersion: 1,
    source: {
      classId: params.cycleContext.classId,
      sessionDate: params.cycleContext.sessionDate,
      classPlanId: params.classPlan?.id,
      classPlanWeekNumber: params.classPlan?.weekNumber,
    },
    plannedContext: {
      ageBand: params.cycleContext.ageBand,
      classLevel: params.cycleContext.classLevel,
      planningPhase: params.cycleContext.planningPhase,
      weekNumber: params.cycleContext.weekNumber,
      sessionIndexInWeek: Math.max(1, params.cycleContext.sessionIndexInWeek || 1),
      loadIntent: params.strategy.loadIntent,
      plannedSessionLoad: params.cycleContext.plannedSessionLoad,
      plannedWeeklyLoad: params.cycleContext.plannedWeeklyLoad,
    },
    decision: {
      primarySkill: params.strategy.primarySkill,
      secondarySkill: params.strategy.secondarySkill,
      progressionDimension: params.strategy.progressionDimension,
      pedagogicalIntent: params.strategy.pedagogicalIntent,
      phaseIntent: params.cycleContext.phaseIntent,
    },
    influences: {
      periodization: {
        used: periodizationUsed,
        technicalFocus: periodizationUsed ? params.classPlan?.technicalFocus : undefined,
        theme: periodizationUsed ? params.classPlan?.theme : undefined,
        phase: periodizationUsed ? params.classPlan?.phase : undefined,
        rpeTarget: periodizationUsed ? params.classPlan?.rpeTarget : undefined,
        weeklyOperationalDecision: periodizationUsed
          ? params.cycleContext.weeklyOperationalDecision?.quarterFocus
          : undefined,
      },
      periodizationDaily: {
        used: Boolean(params.dailyPlanAnchor),
        dailyPlanId: params.dailyPlanAnchor?.dailyPlanId,
        weeklyPlanId: params.dailyPlanAnchor?.weeklyPlanId,
        title: params.dailyPlanAnchor?.title,
        sourceObjective: params.dailyPlanAnchor?.objectiveHint,
        conflictResolved: params.dailyPlanAnchor?.conflictResolved,
        conflictReasons: [...(params.dailyPlanAnchor?.conflictReasons ?? [])],
      },
      classContext: {
        used: true,
        goal: params.cycleContext.classGoal,
        modality: params.cycleContext.modality,
        materials: [...params.sessionPlanningContext.materials],
        constraints: [...params.sessionPlanningContext.constraints],
      },
      scouting: {
        used: scoutingUsed,
        dominantGapSkill: scoutingUsed ? params.cycleContext.dominantGapSkill : undefined,
        dominantGapType: scoutingUsed ? params.cycleContext.dominantGapType : undefined,
        confidence: scoutingConfidence,
        sampleSize: scoutingSampleSize,
      },
      history: {
        used: params.cycleContext.recentSessions.length > 0,
        historicalConfidence: params.cycleContext.historicalConfidence,
        recentSkills,
        mustAvoidRepeating: [...params.cycleContext.mustAvoidRepeating],
        mustProgressFrom: params.cycleContext.mustProgressFrom,
      },
      reportFeedback: {
        used: reportSignals.length > 0 || Boolean(params.reportFeedbackInfluence?.applied),
        signals: reportSignals,
        rulesApplied: reportRulesApplied,
        adjusted: Boolean(params.reportFeedbackInfluence?.applied),
      },
      documentContext: {
        used: documentReferences.length > 0,
        referenceCount: documentReferences.length,
        planningSourceTitle: planningSource?.title,
        sourceScopes: cleanList(
          documentReferences.map((reference) => reference.sourceScope)
        ),
        actionDate: documentSupport?.actionDate,
        warnings: cleanList(documentSupport?.warnings ?? []),
        readOnly: true,
      },
    },
    safeguards: {
      repetitionAdjusted: params.repetitionAdjustment.detected,
      overrideAdjusted: params.overrideAdjusted,
      fallbackUsed: false,
      ageSanitizerFlags: [...params.ageSanitizer.ageSanitizerReasons],
      envelopeDiagnostics: cleanList([
        params.pedagogyEnvelope.tone,
        params.pedagogyEnvelope.languageProfile,
        params.pedagogyEnvelope.feedbackStyle,
        ...params.pedagogyEnvelope.mainStyle,
        ...params.pedagogyEnvelope.cooldownStyle,
      ]),
    },
  };

  return {
    ...traceWithoutSummary,
    teacherFacingSummary: buildTeacherFacingSummary({ trace: traceWithoutSummary }),
  };
};
