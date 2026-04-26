import type {
    KnownMethodologyApproach,
    RecentSessionSummary,
    SessionExecutionState,
    SessionLog,
    TeacherEditedField,
    TeacherOverrideWeight,
    TrainingPlan,
    TrainingPlanSessionBlock,
    TrainingSession,
    TrainingSessionAttendance,
} from "../../../core/models";

type BuildRecentSessionSummaryParams = {
  classId: string;
  plans?: TrainingPlan[] | null;
  sessions?: TrainingSession[] | null;
  attendance?: TrainingSessionAttendance[] | null;
  sessionLogs?: SessionLog[] | null;
  limit?: number;
};

type SummaryGroup = {
  key: string;
  date: string;
  plans: TrainingPlan[];
  session: TrainingSession | null;
  attendance: TrainingSessionAttendance[];
  sessionLogs: SessionLog[];
};

const DEFAULT_LIMIT = 6;

const normalizeText = (value: string | null | undefined) => String(value ?? "").trim();

const normalizeStringArray = (values: string[] | null | undefined) =>
  (values ?? []).map((item) => normalizeText(item)).filter(Boolean);

const getTimestamp = (value: string | null | undefined) => {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getPlanDate = (plan: TrainingPlan) => {
  const applyDate = normalizeText(plan.applyDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(applyDate)) return applyDate;
  return normalizeText(plan.createdAt).slice(0, 10);
};

const getSessionDate = (session: TrainingSession) => normalizeText(session.startAt).slice(0, 10);

const getSessionLogDate = (log: SessionLog) => normalizeText(log.createdAt).slice(0, 10);

const sortPlansNewestFirst = (left: TrainingPlan, right: TrainingPlan) => {
  const versionDiff = (right.version ?? 0) - (left.version ?? 0);
  if (versionDiff !== 0) return versionDiff;
  return getTimestamp(right.finalizedAt ?? right.createdAt) - getTimestamp(left.finalizedAt ?? left.createdAt);
};

const sortPlansOldestFirst = (left: TrainingPlan, right: TrainingPlan) => sortPlansNewestFirst(right, left);

const sortSessionsNewestFirst = (left: TrainingSession, right: TrainingSession) =>
  getTimestamp(right.startAt) - getTimestamp(left.startAt);

const pickLatestPlan = (plans: TrainingPlan[]) => [...plans].sort(sortPlansNewestFirst)[0] ?? null;

const pickGeneratedBaselinePlan = (plans: TrainingPlan[]) =>
  [...plans]
    .sort(sortPlansOldestFirst)
    .find((plan) => plan.origin === "auto" || plan.status === "generated") ?? null;

const findPreviousPlan = (plans: TrainingPlan[], current: TrainingPlan | null) => {
  if (!current?.previousVersionId) return null;
  return plans.find((plan) => plan.id === current.previousVersionId) ?? null;
};

const normalizeBlock = (block: TrainingPlanSessionBlock | null | undefined) => {
  if (!block) return null;
  return {
    summary: normalizeText(block.summary),
    activities: (block.activities ?? []).map((activity) => ({
      name: normalizeText(activity.name),
      description: normalizeText(activity.description),
    })),
  };
};

const resolveMethodologyApproach = (plan: TrainingPlan | null | undefined) =>
  (plan?.pedagogy?.override?.toApproach || plan?.pedagogy?.methodology?.approach || undefined) as
    | KnownMethodologyApproach
    | string
    | undefined;

const resolveTeacherEditedFields = (
  baseline: TrainingPlan | null,
  candidate: TrainingPlan | null
): TeacherEditedField[] => {
  if (!candidate) return [];

  const changedFields = new Set<TeacherEditedField>();

  if (baseline?.pedagogy?.focus?.skill !== candidate.pedagogy?.focus?.skill) {
    changedFields.add("primarySkill");
  }

  if (baseline?.pedagogy?.progression?.dimension !== candidate.pedagogy?.progression?.dimension) {
    changedFields.add("progressionDimension");
  }

  if (
    normalizeText(resolveMethodologyApproach(baseline)) !==
      normalizeText(resolveMethodologyApproach(candidate)) ||
    Boolean(candidate.pedagogy?.override)
  ) {
    changedFields.add("methodologyApproach");
  }

  const baselineBlocks = {
    warmup: normalizeBlock(baseline?.pedagogy?.blocks?.warmup),
    main: normalizeBlock(baseline?.pedagogy?.blocks?.main),
    cooldown: normalizeBlock(baseline?.pedagogy?.blocks?.cooldown),
  };
  const candidateBlocks = {
    warmup: normalizeBlock(candidate.pedagogy?.blocks?.warmup),
    main: normalizeBlock(candidate.pedagogy?.blocks?.main),
    cooldown: normalizeBlock(candidate.pedagogy?.blocks?.cooldown),
  };

  if (
    JSON.stringify(baselineBlocks) !== JSON.stringify(candidateBlocks) ||
    JSON.stringify(normalizeStringArray(baseline?.main)) !== JSON.stringify(normalizeStringArray(candidate.main)) ||
    JSON.stringify(normalizeStringArray(baseline?.warmup)) !== JSON.stringify(normalizeStringArray(candidate.warmup)) ||
    JSON.stringify(normalizeStringArray(baseline?.cooldown)) !== JSON.stringify(normalizeStringArray(candidate.cooldown))
  ) {
    changedFields.add("activityStructure");
  }

  if (
    baseline?.pedagogy?.load?.intendedRPE !== candidate.pedagogy?.load?.intendedRPE ||
    baseline?.pedagogy?.load?.volume !== candidate.pedagogy?.load?.volume
  ) {
    changedFields.add("loadProfile");
  }

  return [...changedFields];
};

const buildComparablePlanShape = (plan: TrainingPlan) => ({
  title: normalizeText(plan.title),
  warmup: normalizeStringArray(plan.warmup),
  main: normalizeStringArray(plan.main),
  cooldown: normalizeStringArray(plan.cooldown),
  warmupTime: normalizeText(plan.warmupTime),
  mainTime: normalizeText(plan.mainTime),
  cooldownTime: normalizeText(plan.cooldownTime),
  focusSkill: plan.pedagogy?.focus?.skill ?? null,
  progressionDimension: plan.pedagogy?.progression?.dimension ?? null,
  sessionObjective: normalizeText(plan.pedagogy?.sessionObjective),
  methodologyApproach: normalizeText(plan.pedagogy?.methodology?.approach),
  warmupBlock: normalizeBlock(plan.pedagogy?.blocks?.warmup),
  mainBlock: normalizeBlock(plan.pedagogy?.blocks?.main),
  cooldownBlock: normalizeBlock(plan.pedagogy?.blocks?.cooldown),
});

const hasMaterialPlanChanges = (baseline: TrainingPlan, candidate: TrainingPlan) =>
  resolveTeacherEditedFields(baseline, candidate).length > 0 ||
  JSON.stringify(buildComparablePlanShape(baseline)) !== JSON.stringify(buildComparablePlanShape(candidate));

const hasExplicitTeacherOverrideSignal = (plans: TrainingPlan[]) =>
  plans.some((plan) => plan.origin === "edited_auto" || Boolean(plan.pedagogy?.override));

const inferTeacherEdited = (plans: TrainingPlan[]) => {
  if (!plans.length) return false;
  if (hasExplicitTeacherOverrideSignal(plans)) return true;

  const latestPlan = pickLatestPlan(plans);
  if (!latestPlan) return false;
  if (latestPlan.origin !== "manual") return false;

  const baselinePlan = findPreviousPlan(plans, latestPlan) ?? pickGeneratedBaselinePlan(plans);
  if (!baselinePlan || baselinePlan.id === latestPlan.id) return false;
  return hasMaterialPlanChanges(baselinePlan, latestPlan);
};

const inferTeacherOverrideWeight = (
  plans: TrainingPlan[],
  wasEditedByTeacher: boolean
): TeacherOverrideWeight => {
  if (!wasEditedByTeacher) return "none";

  const latestPlan = pickLatestPlan(plans);
  const baselinePlan = findPreviousPlan(plans, latestPlan) ?? pickGeneratedBaselinePlan(plans);
  const changedFields = resolveTeacherEditedFields(baselinePlan, latestPlan);
  const explicitSignal = hasExplicitTeacherOverrideSignal(plans);
  const score =
    changedFields.length +
    (explicitSignal ? 1 : 0) +
    (changedFields.includes("primarySkill") ? 1 : 0) +
    (changedFields.includes("progressionDimension") ? 1 : 0);

  if (explicitSignal && changedFields.includes("methodologyApproach") && changedFields.includes("activityStructure")) {
    return "strong";
  }
  if (score >= 5) return "strong";
  if (score >= 2) return "medium";
  return "soft";
};

const resolveDominantBlock = (plan: TrainingPlan | null) => {
  if (!plan) return undefined;
  const blockCounts = [
    { key: "warmup", count: plan.warmup.length },
    { key: "main", count: plan.main.length },
    { key: "cooldown", count: plan.cooldown.length },
  ].sort((left, right) => right.count - left.count);
  return blockCounts[0]?.count ? blockCounts[0].key : undefined;
};

const buildFingerprint = (plan: TrainingPlan | null, dominantBlock?: string) => {
  if (!plan) return undefined;
  if (normalizeText(plan.inputHash)) return normalizeText(plan.inputHash);

  const parts = [
    plan.pedagogy?.focus?.skill,
    plan.pedagogy?.progression?.dimension,
    dominantBlock,
    plan.pedagogy?.load?.volume,
  ]
    .map((item) => normalizeText(item))
    .filter(Boolean);

  return parts.length ? parts.join(":") : undefined;
};

const hasSessionLogEvidence = (logs: SessionLog[]) =>
  logs.some((log) => {
    const attendance = typeof log.attendance === "number" ? log.attendance : 0;
    const participantsCount =
      typeof log.participantsCount === "number" ? log.participantsCount : 0;
    return Boolean(
      normalizeText(log.activity) ||
        normalizeText(log.conclusion) ||
        attendance > 0 ||
        participantsCount > 0 ||
        typeof log.PSE === "number"
    );
  });

const resolveExecutionState = (params: {
  wasPlanned: boolean;
  wasApplied: boolean;
  wasEditedByTeacher: boolean;
  wasConfirmedExecuted: boolean | null;
  session: TrainingSession | null;
}): SessionExecutionState => {
  if (params.session?.status === "cancelled") return "skipped";
  if (params.wasEditedByTeacher) return "teacher_edited";
  if (params.wasConfirmedExecuted) return "confirmed_executed";
  if (params.wasApplied) return "applied_not_confirmed";
  if (params.wasPlanned) return "planned_only";
  return "unknown";
};

const createPlanGroupKey = (date: string) => `date:${date}`;
const createSessionGroupKey = (sessionId: string) => `session:${sessionId}`;

export const buildRecentSessionSummary = (
  params: BuildRecentSessionSummaryParams
): RecentSessionSummary[] => {
  const limit =
    typeof params.limit === "number" && Number.isFinite(params.limit) && params.limit > 0
      ? Math.floor(params.limit)
      : DEFAULT_LIMIT;
  const relevantPlans = (params.plans ?? []).filter((plan) => plan.classId === params.classId);
  const relevantSessions = (params.sessions ?? []).filter((session) =>
    (session.classIds ?? []).includes(params.classId)
  );
  const relevantAttendance = (params.attendance ?? []).filter(
    (entry) => entry.classId === params.classId
  );
  const relevantSessionLogs = (params.sessionLogs ?? []).filter(
    (log) => log.classId === params.classId
  );

  if (!relevantPlans.length && !relevantSessions.length && !relevantSessionLogs.length) return [];

  const groups = new Map<string, SummaryGroup>();
  const planIdToGroupKey = new Map<string, string>();
  const sessionIdToGroupKey = new Map<string, string>();

  relevantPlans.forEach((plan) => {
    const groupKey = createPlanGroupKey(getPlanDate(plan));
    const existing = groups.get(groupKey) ?? {
      key: groupKey,
      date: getPlanDate(plan),
      plans: [],
      session: null,
      attendance: [],
      sessionLogs: [],
    };
    existing.plans.push(plan);
    groups.set(groupKey, existing);
    planIdToGroupKey.set(plan.id, groupKey);
  });

  [...relevantSessions]
    .sort(sortSessionsNewestFirst)
    .forEach((session) => {
      const linkedGroupKey =
        (session.planId ? planIdToGroupKey.get(session.planId) : undefined) ??
        groups.get(createPlanGroupKey(getSessionDate(session)))?.key ??
        createSessionGroupKey(session.id);
      const existing = groups.get(linkedGroupKey) ?? {
        key: linkedGroupKey,
        date: getSessionDate(session),
        plans: [],
        session: null,
        attendance: [],
        sessionLogs: [],
      };
      if (!existing.session || sortSessionsNewestFirst(session, existing.session) < 0) {
        existing.session = session;
      }
      existing.date = existing.session ? getSessionDate(existing.session) : existing.date;
      groups.set(linkedGroupKey, existing);
      sessionIdToGroupKey.set(session.id, linkedGroupKey);
    });

  relevantSessionLogs.forEach((log) => {
    const date = getSessionLogDate(log);
    const groupKey = groups.get(createPlanGroupKey(date))?.key ?? createPlanGroupKey(date);
    const existing = groups.get(groupKey) ?? {
      key: groupKey,
      date,
      plans: [],
      session: null,
      attendance: [],
      sessionLogs: [],
    };
    existing.sessionLogs.push(log);
    groups.set(groupKey, existing);
  });

  relevantAttendance.forEach((entry) => {
    const groupKey = sessionIdToGroupKey.get(entry.sessionId);
    if (!groupKey) return;
    const existing = groups.get(groupKey);
    if (!existing) return;
    existing.attendance.push(entry);
  });

  return [...groups.values()]
    .map((group) => {
      const orderedPlans = [...group.plans].sort(sortPlansNewestFirst);
      const latestPlan = orderedPlans[0] ?? null;
      const wasPlanned = orderedPlans.length > 0;
      const wasEditedByTeacher = inferTeacherEdited(orderedPlans);
      const linkedSession = group.session;
      const planIds = new Set(orderedPlans.map((plan) => plan.id));
      const hasLogEvidence = hasSessionLogEvidence(group.sessionLogs);
      const wasApplied = Boolean(
        (linkedSession &&
          (linkedSession.source === "plan" ||
            linkedSession.status === "completed" ||
            (linkedSession.planId ? planIds.has(linkedSession.planId) : false))) ||
          hasLogEvidence
      );
      const hasAttendanceEvidence = group.attendance.length > 0;
      const wasConfirmedExecuted =
        linkedSession?.status === "cancelled"
          ? false
          : linkedSession?.status === "completed"
            ? hasAttendanceEvidence || hasLogEvidence
            : hasLogEvidence
              ? true
          : linkedSession
            ? false
            : null;
      const executionState = resolveExecutionState({
        wasPlanned,
        wasApplied,
        wasEditedByTeacher,
        wasConfirmedExecuted,
        session: linkedSession,
      });
      const dominantBlock = resolveDominantBlock(latestPlan);
      const baselinePlan = findPreviousPlan(orderedPlans, latestPlan) ?? pickGeneratedBaselinePlan(orderedPlans);
      const teacherEditedFields = wasEditedByTeacher
        ? resolveTeacherEditedFields(baselinePlan, latestPlan)
        : [];

      return {
        sessionDate: group.date,
        wasPlanned,
        wasApplied,
        wasEditedByTeacher,
        wasConfirmedExecuted,
        executionState,
        primarySkill: latestPlan?.pedagogy?.focus?.skill,
        secondarySkill: undefined,
        progressionDimension: latestPlan?.pedagogy?.progression?.dimension,
        dominantBlock,
        fingerprint: buildFingerprint(latestPlan, dominantBlock),
        methodologyApproach: resolveMethodologyApproach(latestPlan),
        teacherEditedFields,
        teacherOverrideWeight: inferTeacherOverrideWeight(orderedPlans, wasEditedByTeacher),
      } satisfies RecentSessionSummary;
    })
    .sort((left, right) => getTimestamp(right.sessionDate) - getTimestamp(left.sessionDate))
    .slice(0, limit);
};
