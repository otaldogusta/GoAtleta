import { resolveSessionIndexInWeek } from "../../../core/cycle-day-planning/resolve-session-index-in-week";
import type {
  ClassGroup,
  ClassPlan,
  SessionComponent,
  SessionEnvironment,
  WeekSessionRole,
  WeeklyIntegratedTrainingContext,
} from "../../../core/models";
import { buildResistanceSessionPlan } from "../../../core/resistance/build-resistance-session-plan";
import {
  buildWeeklyIntegratedContext,
  resolveSessionEnvironment,
} from "../../../core/resistance/resolve-session-environment";
import { parseWeeklyIntegratedContext } from "../../../core/resistance/weekly-integrated-context";
import {
  resolveTeamTrainingContext,
  supportsResistanceTraining,
} from "../../../core/resistance/training-context";

type BuildSessionResistancePreviewParams = {
  classGroup?: ClassGroup | null;
  classPlan?: ClassPlan | null;
  sessionDate: string;
  sessionRole?: WeekSessionRole;
};

type SessionResistancePreview = {
  sessionEnvironment: SessionEnvironment;
  weeklyContext?: WeeklyIntegratedTrainingContext;
  sessionComponents?: SessionComponent[];
};

export function buildSessionResistancePreview(
  params: BuildSessionResistancePreviewParams,
): SessionResistancePreview | null {
  if (!params.classGroup) {
    return null;
  }

  const teamContext = resolveTeamTrainingContext(params.classGroup);
  const weeklySessions = Math.max(1, params.classGroup.daysPerWeek || 1);

  if (!supportsResistanceTraining(teamContext, params.classGroup)) {
    return {
      sessionEnvironment: "quadra",
    };
  }

  const sessionIndexInWeek = resolveSessionIndexInWeek({
    daysOfWeek: params.classGroup.daysOfWeek,
    sessionDate: params.sessionDate,
  });

  const sessionEnvironment = resolveSessionEnvironment({
    teamContext,
    classGroup: params.classGroup,
    weeklySessions,
    sessionIndexInWeek: Math.max(0, sessionIndexInWeek - 1),
  });

  if (sessionEnvironment === "quadra") {
    return { sessionEnvironment };
  }

  const weeklyContext =
    parseWeeklyIntegratedContext(params.classPlan?.weeklyIntegratedContextJson) ??
    buildWeeklyIntegratedContext({
      teamContext,
      classGroup: params.classGroup,
      weeklySessions,
    });

  return {
    sessionEnvironment,
    weeklyContext,
    sessionComponents: [
      buildResistanceSessionPlan({
        teamContext,
        weeklyContext,
        sessionRole: params.sessionRole ?? "consolidacao_orientada",
      }),
    ],
  };
}
