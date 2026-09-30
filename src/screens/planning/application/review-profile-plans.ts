import type { ClassCalendarException, ClassGroup, SessionLog, Student, TrainingPlan } from "../../../core/models";
import { resolveClassProfile, applyProfileToWeeklyPlan } from "../../../core/profile-planning";
import { createProfileRequestId } from "../../../core/profile-request-id";
import { getActiveOrganizationId, supabasePost } from "../../../db/client";
import { getClassPedagogicalProfiles } from "../../../db/class-pedagogical-profile";
import { buildTrainingPlanVersionedPayload, mapTrainingPlanRow } from "../../../db/training";
import type { TrainingPlanRow } from "../../../db/row-types";
import { buildAutoPlanForCycleDay } from "../../session/application/build-auto-plan-for-cycle-day";
import { convertPedagogicalPackageToTrainingPlan } from "../../session/application/convert-pedagogical-package-to-training-plan";
import type { ProfessorAgendaEvent } from "./professor-agenda-events";

export type ProfilePlanPreview = { before: TrainingPlan; after: TrainingPlan; token: string; version: number };
export async function previewProfilePlans(params: {
  classGroup: ClassGroup; events: ProfessorAgendaEvent[]; students: Student[];
  calendarExceptions: ClassCalendarException[]; sessionLogs: SessionLog[];
}): Promise<ProfilePlanPreview[]> {
  const { classGroup, events } = params;
  if (await getActiveOrganizationId() !== classGroup.organizationId) throw new Error("Reabra a turma na organização atual.");
  const [record] = await getClassPedagogicalProfiles(classGroup.organizationId, classGroup.id);
  const cls = { ...classGroup, pedagogicalProfile: record };
  if (!resolveClassProfile(cls)) throw new Error("Carregue o perfil antes de revisar os planos.");
  const candidates = await supabasePost<{ plan: TrainingPlanRow; token: string }[]>("/rpc/preview_class_profile_plans", {
    p_org: cls.organizationId, p_class: cls.id, p_dates: [...new Set(events.map(event => event.date))],
  });
  const previews: ProfilePlanPreview[] = [];
  for (const candidate of candidates) {
    const before = mapTrainingPlanRow(candidate.plan);
    const event = events.find(item => item.date === before.applyDate);
    if (!event || event.plan.source === "MANUAL" || (event.plan.manualOverrideMaskJson && event.plan.manualOverrideMaskJson !== "[]") ||
        event.dailyPlan?.lastManualEditedAt || event.dailyPlan?.syncStatus === "overridden" || (event.dailyPlan?.manualOverrideMaskJson && event.dailyPlan.manualOverrideMaskJson !== "[]") ||
        before.pedagogy?.decisionTrace?.influences.pedagogicalProfile?.version === record.version) continue;
    const generated = buildAutoPlanForCycleDay({
      classGroup: cls, classPlan: applyProfileToWeeklyPlan(event.plan, cls), dailyLessonPlan: event.dailyPlan,
      students: params.students, sessionDate: event.date, sessionIndexInWeek: event.sessionIndex,
      recentPlans: candidates.map(item => mapTrainingPlanRow(item.plan)), calendarExceptions: params.calendarExceptions,
      sessionLogs: params.sessionLogs,
    });
    const after = convertPedagogicalPackageToTrainingPlan({
      pkg: generated.package, classId: cls.id, sessionDate: event.date, existingPlan: null, version: (before.version ?? 0) + 1,
      pedagogy: { decisionTrace: generated.decisionTrace, sessionPlanningContext: generated.sessionPlanningContext,
        readinessState: generated.readinessState, adaptiveEnvelope: generated.adaptiveEnvelope, coachGuidance: generated.coachGuidance },
    });
    after.id = `profile_${createProfileRequestId()}`;
    previews.push({ before, after, token: candidate.token, version: record.version });
  }
  return previews;
}
export async function applyProfilePlanPreview(cls: ClassGroup, preview: ProfilePlanPreview): Promise<void> {
  if (await getActiveOrganizationId() !== cls.organizationId) throw new Error("Reabra a turma na organização atual.");
  await supabasePost("/rpc/apply_class_profile_plan", {
    p_org: cls.organizationId, p_class: cls.id, p_base: preview.before.id, p_token: preview.token,
    p_version: preview.version, p_plan: buildTrainingPlanVersionedPayload(preview.after, cls.organizationId),
  });
}
