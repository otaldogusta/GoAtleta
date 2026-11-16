import type { Href } from "expo-router";

import { listEvents } from "../../api/events";
import { getSessionIdentity, isSessionIdentityCurrent } from "../../auth/session";
import { getActiveOrganizationId, getReadCacheGeneration } from "../../db/client";
import { getClassStudentRecords } from "../../db/students";
import { getTrainingPlanSummaries } from "../../db/training";
import { formatIsoDateToPtBr } from "../../utils/date-time";
import type { HomeSearchEntry } from "./components/HomeSearchModal";

export type HomeSearchRecordEntry = HomeSearchEntry & { href: Href; studentClassId?: string };

type HomeSearchRecordsOptions = {
  organizationId: string;
  profile?: "coord" | "prof";
  canReadStudents: boolean;
  canReadPlans: boolean;
  canReadEvents: boolean;
  signal: AbortSignal;
  userId?: string;
  now?: Date;
};

const noResults = () => ({ entries: [] as HomeSearchRecordEntry[], partialFailure: false });

export async function loadHomeSearchRecords({
  organizationId,
  profile = "coord",
  canReadStudents,
  canReadPlans,
  canReadEvents,
  signal,
  userId,
  now = new Date(),
}: HomeSearchRecordsOptions): Promise<{ entries: HomeSearchRecordEntry[]; partialFailure: boolean }> {
  if (signal.aborted || !organizationId || !(canReadStudents || canReadPlans || canReadEvents)) return noResults();
  const identity = getSessionIdentity();
  const generation = getReadCacheGeneration();
  if (!identity.userId || (userId && userId !== identity.userId)) return noResults();
  const canUseResults = async () => {
    const activeOrganizationId = await getActiveOrganizationId();
    return !signal.aborted && activeOrganizationId === organizationId &&
      isSessionIdentityCurrent(identity) && generation === getReadCacheGeneration();
  };
  if (!(await canUseResults())) return noResults();

  const requests: Promise<HomeSearchRecordEntry[]>[] = [];
  if (canReadStudents) {
    requests.push(getClassStudentRecords({ organizationId }).then(students =>
      students.filter(student => student.organizationId === organizationId).map(student => ({
        id: `student:${student.id}`,
        title: student.name,
        section: "Atletas",
        studentClassId: student.classId || undefined,
        href: { pathname: profile === "coord" ? "/coord/students" : "/prof/students", params: { studentProfile: student.id } },
      })),
    ));
  }
  if (canReadPlans) {
    requests.push(getTrainingPlanSummaries({ organizationId, signal }).then(plans =>
      plans.map(plan => ({
        id: `plan:${plan.id}`,
        title: plan.title,
        section: "Planos de aula",
        keywords: plan.tags.join(" "),
        description: plan.applyDate ? formatIsoDateToPtBr(plan.applyDate) : undefined,
        href: { pathname: profile === "coord" ? "/coord/planning" : "/prof/planning", params: { viewPlanId: plan.id } },
      })),
    ));
  }
  if (canReadEvents) {
    const from = new Date(now);
    const to = new Date(now);
    from.setFullYear(from.getFullYear() - 1);
    to.setFullYear(to.getFullYear() + 1);
    requests.push(listEvents({
      organizationId,
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      overlap: true,
    }).then(events =>
      events.filter(event => event.organizationId === organizationId).map(event => ({
        id: `event:${event.id}`,
        title: event.title,
        section: "Eventos da agenda",
        keywords: event.eventType,
        description: [new Date(event.startsAt).toLocaleDateString("pt-BR"), event.locationLabel].filter(Boolean).join(" · "),
        href: { pathname: "/events/[id]", params: { id: event.id } },
      })),
    ));
  }

  const results = await Promise.allSettled(requests);
  if (!(await canUseResults())) return noResults();
  return {
    entries: results.flatMap(result => result.status === "fulfilled" ? result.value : []),
    partialFailure: results.some(result => result.status === "rejected"),
  };
}
