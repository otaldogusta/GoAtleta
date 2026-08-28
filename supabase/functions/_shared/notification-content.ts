import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type AuthorizationMode = "self" | "admin" | "staff" | "student";

export type AuthorizedNotificationContent = {
  inboxScope: "prof" | "coord" | "student" | "all";
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  sourceType: string | null;
  sourceId: string | null;
  metadata: Record<string, unknown>;
};

type StudentRow = {
  id: string;
  name: string;
  classid: string | null;
  student_user_id: string | null;
};

type ClassIdRow = { class_id: string };

const asString = (value: unknown) => String(value ?? "").trim();

const requireSingle = <T>(result: {
  data: T | null;
  error: { message: string } | null;
}) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};

const requireRows = <T>(result: {
  data: T[] | null;
  error: { message: string } | null;
}) => {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) {
    throw new Error("Notification source validation query failed.");
  }
  return result.data;
};

const uniqueClassIds = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(values.map((value) => asString(value)).filter(Boolean)),
  );

const getStudent = async (
  supabase: SupabaseClient,
  organizationId: string,
  studentId: string,
) =>
  requireSingle<StudentRow>(
    await supabase
      .from("students")
      .select("id,name,classid,student_user_id")
      .eq("organization_id", organizationId)
      .eq("id", studentId)
      .maybeSingle<StudentRow>(),
  );

const getStudentClassIds = async (
  supabase: SupabaseClient,
  organizationId: string,
  student: StudentRow,
) => {
  const enrollmentRows = requireRows<ClassIdRow>(
    await supabase
      .from("student_class_enrollments")
      .select("class_id")
      .eq("organization_id", organizationId)
      .eq("student_id", student.id)
      .eq("status", "active")
      .returns<ClassIdRow[]>(),
  );

  return uniqueClassIds([
    student.classid,
    ...enrollmentRows.map((row) => row.class_id),
  ]);
};

const isResponsibleForAnyClass = async (params: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  roleLevel: number;
  classIds: string[];
}) => {
  if (params.roleLevel >= 50) return true;
  if (!params.userId || !params.classIds.length) return false;

  const assignment = requireSingle<{ class_id: string }>(
    await params.supabase
      .from("class_staff")
      .select("class_id")
      .eq("organization_id", params.organizationId)
      .eq("user_id", params.userId)
      .in("class_id", params.classIds)
      .limit(1)
      .maybeSingle<{ class_id: string }>(),
  );
  return Boolean(assignment);
};

const isStaffMode = (mode: AuthorizationMode) =>
  mode === "staff" || mode === "admin";

async function canonicalizeConsultation(params: {
  supabase: SupabaseClient;
  organizationId: string;
  senderUserId: string;
  recipientUserId: string;
  recipientRoleLevel: number;
  mode: AuthorizationMode;
  metadata: Record<string, unknown>;
}) {
  const event = asString(params.metadata.event);
  const studentId = asString(params.metadata.studentId);
  const workoutId = asString(params.metadata.workoutId);
  const executionLogId = asString(params.metadata.executionLogId);
  if (!event || !studentId) return null;

  const student = await getStudent(
    params.supabase,
    params.organizationId,
    studentId,
  );
  if (!student) return null;
  const studentClassIds = await getStudentClassIds(
    params.supabase,
    params.organizationId,
    student,
  );
  if (!studentClassIds.length) return null;

  let title = "";
  let body = "";
  let inboxScope: AuthorizedNotificationContent["inboxScope"] = "student";
  let canonicalWorkoutId = workoutId;
  let canonicalExecutionLogId = executionLogId;

  if (
    event === "consultation_workout_published" ||
    event === "consultation_execution_reviewed"
  ) {
    if (
      !isStaffMode(params.mode) ||
      !student.student_user_id ||
      student.student_user_id !== params.recipientUserId
    ) {
      return null;
    }
    if (
      params.mode === "staff" &&
      !(await isResponsibleForAnyClass({
        supabase: params.supabase,
        organizationId: params.organizationId,
        userId: params.senderUserId,
        roleLevel: 0,
        classIds: studentClassIds,
      }))
    ) {
      return null;
    }

    if (event === "consultation_workout_published") {
      if (!workoutId) return null;
      const workout = requireSingle<{ id: string }>(
        await params.supabase
          .from("prescribed_workouts")
          .select("id")
          .eq("organization_id", params.organizationId)
          .eq("id", workoutId)
          .eq("student_id", studentId)
          .in("status", ["published", "completed"])
          .maybeSingle<{ id: string }>(),
      );
      if (!workout) return null;
      canonicalWorkoutId = workout.id;
      canonicalExecutionLogId = "";
      title = "Treino publicado";
      body = "Seu treino já está disponível.";
    } else {
      if (!executionLogId) return null;
      const reviewedLog = requireSingle<{ id: string; workout_id: string }>(
        await params.supabase
          .from("workout_execution_logs")
          .select("id,workout_id")
          .eq("organization_id", params.organizationId)
          .eq("id", executionLogId)
          .eq("student_id", studentId)
          .eq("coach_review_status", "reviewed")
          .maybeSingle<{ id: string; workout_id: string }>(),
      );
      if (!reviewedLog || (workoutId && reviewedLog.workout_id !== workoutId)) {
        return null;
      }
      canonicalWorkoutId = reviewedLog.workout_id;
      canonicalExecutionLogId = reviewedLog.id;
      title = "Devolutiva revisada";
      body = "O profissional revisou seu feedback de treino.";
    }
  } else if (
    event === "consultation_workout_completed" ||
    event === "consultation_high_pain_reported"
  ) {
    if (
      params.mode !== "student" ||
      student.student_user_id !== params.senderUserId ||
      !executionLogId
    ) {
      return null;
    }
    if (
      !(await isResponsibleForAnyClass({
        supabase: params.supabase,
        organizationId: params.organizationId,
        userId: params.recipientUserId,
        roleLevel: params.recipientRoleLevel,
        classIds: studentClassIds,
      }))
    ) {
      return null;
    }
    const executionLog = requireSingle<{
      id: string;
      workout_id: string;
      pain_level: number | null;
    }>(
      await params.supabase
        .from("workout_execution_logs")
        .select("id,workout_id,pain_level")
        .eq("organization_id", params.organizationId)
        .eq("id", executionLogId)
        .eq("student_id", studentId)
        .maybeSingle<{
          id: string;
          workout_id: string;
          pain_level: number | null;
        }>(),
    );
    if (
      !executionLog ||
      (workoutId && executionLog.workout_id !== workoutId) ||
      (event === "consultation_high_pain_reported" &&
        Number(executionLog.pain_level ?? 0) < 7)
    ) {
      return null;
    }
    canonicalWorkoutId = executionLog.workout_id;
    canonicalExecutionLogId = executionLog.id;
    inboxScope = "prof";
    if (event === "consultation_high_pain_reported") {
      title = "Atenção no treino";
      body = `${student.name} enviou um feedback que precisa de revisão.`;
    } else {
      title = "Treino concluído";
      body = `${student.name} concluiu o treino.`;
    }
  } else {
    return null;
  }

  return {
    inboxScope,
    type: "consultation_event",
    title,
    body,
    actionUrl:
      inboxScope === "student" ? "/student-consultation" : "/prof/consultation",
    sourceType: "consultation",
    sourceId: [
      event,
      studentId,
      canonicalWorkoutId || "no-workout",
      canonicalExecutionLogId || "no-log",
    ].join(":"),
    metadata: {
      event,
      studentId,
      workoutId: canonicalWorkoutId || null,
      executionLogId: canonicalExecutionLogId || null,
      recipientRole: inboxScope === "student" ? "student" : "coach",
    },
  } satisfies AuthorizedNotificationContent;
}

async function canonicalizeAbsence(params: {
  supabase: SupabaseClient;
  organizationId: string;
  senderUserId: string;
  recipientUserId: string;
  recipientRoleLevel: number;
  mode: AuthorizationMode;
  type: string;
  sourceId: string;
}) {
  if (!params.sourceId) return null;
  const notice = requireSingle<{
    id: string;
    student_id: string;
    class_id: string;
    session_date: string;
    status: string;
  }>(
    await params.supabase
      .from("absence_notices")
      .select("id,student_id,class_id,session_date,status")
      .eq("organization_id", params.organizationId)
      .eq("id", params.sourceId)
      .maybeSingle<{
        id: string;
        student_id: string;
        class_id: string;
        session_date: string;
        status: string;
      }>(),
  );
  if (!notice) return null;
  const student = await getStudent(
    params.supabase,
    params.organizationId,
    notice.student_id,
  );
  if (!student) return null;
  const studentClassIds = await getStudentClassIds(
    params.supabase,
    params.organizationId,
    student,
  );
  if (!studentClassIds.includes(notice.class_id)) return null;
  if (
    params.mode === "student" &&
    student.student_user_id !== params.senderUserId
  ) {
    return null;
  }
  if (
    params.mode === "staff" &&
    !(await isResponsibleForAnyClass({
      supabase: params.supabase,
      organizationId: params.organizationId,
      userId: params.senderUserId,
      roleLevel: 0,
      classIds: [notice.class_id],
    }))
  ) {
    return null;
  }
  if (
    !isStaffMode(params.mode) &&
    params.mode !== "student"
  ) {
    return null;
  }
  if (
    params.type === "absence_notice_status_changed" &&
    !isStaffMode(params.mode)
  ) {
    return null;
  }
  if (
    !(await isResponsibleForAnyClass({
      supabase: params.supabase,
      organizationId: params.organizationId,
      userId: params.recipientUserId,
      roleLevel: params.recipientRoleLevel,
      classIds: [notice.class_id],
    }))
  ) {
    return null;
  }
  const classRow = requireSingle<{ name: string }>(
    await params.supabase
      .from("classes")
      .select("name")
      .eq("organization_id", params.organizationId)
      .eq("id", notice.class_id)
      .maybeSingle<{ name: string }>(),
  );
  if (!classRow) return null;

  const created = params.type === "absence_notice_created";
  const title = created
    ? "Novo aviso de ausência"
    : "Aviso de ausência atualizado";
  const body = created
    ? `${student.name} avisou ausência em ${classRow.name} (${notice.session_date}).`
    : notice.status === "confirmed"
      ? `${student.name} teve ausência confirmada em ${classRow.name} (${notice.session_date}).`
      : `${student.name} teve ausência ignorada em ${classRow.name} (${notice.session_date}).`;

  return {
    inboxScope: "prof",
    type: params.type,
    title,
    body,
    actionUrl: "/prof/absence-notices",
    sourceType: "absence_notice",
    sourceId: notice.id,
    metadata: {
      studentId: notice.student_id,
      classId: notice.class_id,
      date: notice.session_date,
      status: notice.status,
    },
  } satisfies AuthorizedNotificationContent;
}

async function canonicalizeStudentContext(params: {
  supabase: SupabaseClient;
  organizationId: string;
  senderUserId: string;
  recipientUserId: string;
  recipientRoleLevel: number;
  mode: AuthorizationMode;
  sourceId: string;
}) {
  const selfMember = params.mode === "self" && params.recipientRoleLevel > 0;
  if ((!isStaffMode(params.mode) && !selfMember) || !params.sourceId) {
    return null;
  }
  const event = requireSingle<{
    id: string;
    class_id: string;
    student_id: string;
    title: string;
    summary: string;
    category: string;
    severity: string;
    event_date: string;
    created_by: string;
  }>(
    await params.supabase
      .from("student_context_events")
      .select(
        "id,class_id,student_id,title,summary,category,severity,event_date,created_by",
      )
      .eq("organization_id", params.organizationId)
      .eq("id", params.sourceId)
      .eq("created_by", params.senderUserId)
      .maybeSingle<{
        id: string;
        class_id: string;
        student_id: string;
        title: string;
        summary: string;
        category: string;
        severity: string;
        event_date: string;
        created_by: string;
      }>(),
  );
  if (!event) return null;
  if (
    params.mode !== "admin" &&
    !(await isResponsibleForAnyClass({
      supabase: params.supabase,
      organizationId: params.organizationId,
      userId: params.senderUserId,
      roleLevel: selfMember ? params.recipientRoleLevel : 0,
      classIds: [event.class_id],
    }))
  ) {
    return null;
  }
  if (
    !(await isResponsibleForAnyClass({
      supabase: params.supabase,
      organizationId: params.organizationId,
      userId: params.recipientUserId,
      roleLevel: params.recipientRoleLevel,
      classIds: [event.class_id],
    }))
  ) {
    return null;
  }

  return {
    inboxScope: params.recipientRoleLevel >= 50 ? "coord" : "prof",
    type: "generic",
    title: event.title,
    body: event.summary,
    actionUrl: `/class/${event.class_id}/attendance?date=${event.event_date}`,
    sourceType: "student_context_event",
    sourceId: event.id,
    metadata: {
      classId: event.class_id,
      studentId: event.student_id,
      category: event.category,
      severity: event.severity,
      eventDate: event.event_date,
    },
  } satisfies AuthorizedNotificationContent;
}

export async function resolveAuthorizedNotificationContent(params: {
  supabase: SupabaseClient;
  organizationId: string;
  senderUserId: string;
  recipientUserId: string;
  recipientRoleLevel: number;
  mode: AuthorizationMode;
  inboxScope: AuthorizedNotificationContent["inboxScope"];
  type: string;
  title: string;
  body: string;
  actionUrl: string;
  sourceType: string;
  sourceId: string;
  metadata: Record<string, unknown>;
}): Promise<AuthorizedNotificationContent | null> {
  if (params.type === "consultation_event") {
    return params.sourceType === "consultation"
      ? canonicalizeConsultation(params)
      : null;
  }
  if (
    params.type === "absence_notice_created" ||
    params.type === "absence_notice_status_changed"
  ) {
    return params.sourceType === "absence_notice"
      ? canonicalizeAbsence(params)
      : null;
  }
  if (params.type === "generic") {
    if (params.sourceType === "student_context_event") {
      return canonicalizeStudentContext(params);
    }
    if (params.sourceType) return null;
    if (params.mode !== "self" && params.mode !== "admin") return null;
  }

  if (params.mode === "self" || params.mode === "admin") {
    return {
      inboxScope: params.inboxScope,
      type: params.type,
      title: params.title,
      body: params.body,
      actionUrl: params.actionUrl || null,
      sourceType: params.sourceType || null,
      sourceId: params.sourceId || null,
      metadata: params.metadata,
    };
  }
  return null;
}
