import { getSessionUserId } from "../auth/session";
import { createNotification } from "../api/notifications";
import {
  listClassStaffByClassIds,
  listOrganizationCoordinators,
} from "../api/class-responsibles";
import { supabaseRestGet } from "../api/rest";
import type { StudentContextSuggestion } from "../core/student-context-events";
import { getActiveOrganizationId, supabasePost } from "./client";

export type ConfirmedStudentContextInput = {
  attendanceRecordId: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  date: string;
  rawNote: string;
  suggestion: StudentContextSuggestion;
};

type StudentContextEventRow = {
  id: string;
  organization_id: string;
  student_id: string;
  class_id: string;
  source_type: StudentContextSuggestion["sourceType"];
  source_id: string;
  raw_text: string;
  category: StudentContextSuggestion["category"];
  severity: StudentContextSuggestion["severity"];
  confidence: StudentContextSuggestion["confidence"];
  status: "confirmed";
  title: string;
  summary: string;
  event_date: string;
  created_by: string;
  confirmed_by: string;
  confirmed_at: string;
  metadata: Record<string, unknown>;
};

type ActiveStudentContextRow = Pick<
  StudentContextEventRow,
  | "id"
  | "student_id"
  | "class_id"
  | "raw_text"
  | "category"
  | "severity"
  | "title"
  | "summary"
  | "event_date"
>;

export type ActiveStudentContext = {
  id: string;
  studentId: string;
  classId: string;
  rawText: string;
  category: StudentContextSuggestion["category"];
  severity: StudentContextSuggestion["severity"];
  title: string;
  summary: string;
  eventDate: string;
};

const buildEventId = (input: ConfirmedStudentContextInput) =>
  `${input.attendanceRecordId}__${input.suggestion.category}`;

const notificationBody = (input: ConfirmedStudentContextInput) => {
  if (input.suggestion.severity === "urgent") {
    return `${input.studentName} precisa de acompanhamento prioritário em ${input.className}.`;
  }
  return `${input.studentName} recebeu um contexto de acompanhamento em ${input.className}.`;
};

export async function listActiveStudentContextsByClass(
  classIdInput: string
): Promise<ActiveStudentContext[]> {
  const organizationId = String((await getActiveOrganizationId()) ?? "").trim();
  const classId = String(classIdInput ?? "").trim();
  if (!organizationId || !classId) return [];

  try {
    const rows = await supabaseRestGet<ActiveStudentContextRow[]>(
      `/student_context_events?select=id,student_id,class_id,raw_text,category,severity,title,summary,event_date&organization_id=eq.${encodeURIComponent(
        organizationId
      )}&class_id=eq.${encodeURIComponent(
        classId
      )}&status=eq.confirmed&order=event_date.desc,created_at.desc&limit=100`
    );
    return (rows ?? []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      classId: row.class_id,
      rawText: row.raw_text,
      category: row.category,
      severity: row.severity,
      title: row.title,
      summary: row.summary,
      eventDate: row.event_date,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (message.includes("PGRST205") || message.includes("student_context_events")) {
      return [];
    }
    throw error;
  }
}

export async function saveConfirmedStudentContexts(
  inputs: ConfirmedStudentContextInput[]
): Promise<{ savedCount: number; notificationFailures: number }> {
  if (!inputs.length) return { savedCount: 0, notificationFailures: 0 };

  const organizationId = String((await getActiveOrganizationId()) ?? "").trim();
  const actorUserId = String((await getSessionUserId()) ?? "").trim();
  if (!organizationId || !actorUserId) {
    throw new Error("Não foi possível confirmar o contexto sem organização e sessão ativas.");
  }

  const confirmedAt = new Date().toISOString();
  const rows: StudentContextEventRow[] = inputs.map((input) => ({
    id: buildEventId(input),
    organization_id: organizationId,
    student_id: input.studentId,
    class_id: input.classId,
    source_type: input.suggestion.sourceType,
    source_id: input.attendanceRecordId,
    raw_text: input.rawNote.trim(),
    category: input.suggestion.category,
    severity: input.suggestion.severity,
    confidence: input.suggestion.confidence,
    status: "confirmed",
    title: input.suggestion.title,
    summary: input.suggestion.summary,
    event_date: input.date,
    created_by: actorUserId,
    confirmed_by: actorUserId,
    confirmed_at: confirmedAt,
    metadata: {
      evidence: input.suggestion.evidence,
      confirmedFrom: "attendance",
    },
  }));

  await supabasePost<StudentContextEventRow[]>(
    "/student_context_events?on_conflict=organization_id,source_type,source_id,category",
    rows,
    { Prefer: "resolution=merge-duplicates,return=representation" }
  );

  let notificationFailures = 0;
  try {
    const [staff, coordinators] = await Promise.all([
      listClassStaffByClassIds({
        organizationId,
        classIds: Array.from(new Set(inputs.map((input) => input.classId))),
      }),
      listOrganizationCoordinators(organizationId),
    ]);

    const notificationTasks = inputs.flatMap((input) => {
      const eventId = buildEventId(input);
      const recipients = new Map<string, Set<"prof" | "coord">>();
      staff
        .filter((assignment) => assignment.classId === input.classId)
        .forEach((assignment) => {
          const scopes =
            recipients.get(assignment.userId) ??
            new Set<"prof" | "coord">();
          scopes.add("prof");
          recipients.set(assignment.userId, scopes);
      });
      coordinators.forEach((coordinator) => {
        const scopes =
          recipients.get(coordinator.userId) ??
          new Set<"prof" | "coord">();
        scopes.add("coord");
        recipients.set(coordinator.userId, scopes);
      });

      return Array.from(recipients.entries()).flatMap(
        ([recipientUserId, inboxScopes]) =>
          Array.from(inboxScopes).map(async (inboxScope) => {
            try {
              await createNotification({
                organizationId,
                recipientUserId,
                inboxScope,
                actorUserId,
                type: "generic",
                title: input.suggestion.title,
                body: notificationBody(input),
                actionUrl: `/class/${input.classId}/attendance?date=${input.date}`,
                sourceType: "student_context_event",
                sourceId: eventId,
                metadata: {
                  classId: input.classId,
                  studentId: input.studentId,
                  category: input.suggestion.category,
                  severity: input.suggestion.severity,
                  eventDate: input.date,
                },
                sendPush: input.suggestion.severity === "urgent",
                dedupe: true,
              });
            } catch {
              notificationFailures += 1;
            }
          }),
      );
    });
    await Promise.all(notificationTasks);
  } catch {
    notificationFailures += 1;
  }

  return { savedCount: rows.length, notificationFailures };
}
