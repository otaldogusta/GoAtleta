// ---------------------------------------------------------------------------
// Re-export barrel — all consumers of src/db/seed can keep their imports
// unchanged. Domain logic lives in the individual modules below.
// ---------------------------------------------------------------------------

export { clearLocalReadCaches } from "./client";

export {
    buildNfcCheckinPendingWriteDedupKey, buildSyncHealthReport, clearPendingWritesDeadLetterCandidates, exportSyncHealthReportJson, flushPendingWrites, getPendingWritePayloadById, getPendingWritesCount,
    getPendingWritesDiagnostics,
    listPendingWriteFailures, listPendingWritesDeadLetter, queueNfcCheckinWrite, reprocessPendingWriteById,
    reprocessPendingWritesNetworkFailures, type NfcCheckinPendingPayload,
    type PendingWriteDeadRow, type PendingWriteFailureRow, type PendingWritesDiagnostics,
    type SyncHealthReport
} from "./nfc-sync";

export {
    deleteClass,
    deleteClassCascade, duplicateClass, getClassById, getClasses, saveClass, seedIfEmpty,
    seedStudentsIfEmpty, updateClass, updateClassAcwrLimits, updateClassColor
} from "./classes";

export {
    getLatestScoutingLog, getScoutingLogByDate, getSessionLogByDate, getSessionLogsByClass, getSessionLogsByRange, getStudentScoutingByDate, getStudentScoutingByRange, saveScoutingLog, saveSessionLog, saveStudentScoutingLog
} from "./session";

export {
    buildTrainingSessionId,
    buildTrainingSessionWindow, deleteTrainingIntegrationRuleBySession, deleteTrainingSessionsByClass, getTrainingIntegrationRules, getTrainingSessionAttendanceBySessionId, getTrainingSessionByDate, getTrainingSessionEvidenceByClass,
    getTrainingSessionsByClass, resolveTrainingPlanForDate, syncTrainingIntegrationRuleFromSession, syncTrainingSessionFromAttendance,
    syncTrainingSessionFromReport, upsertTrainingSession
} from "./training-sessions";

export {
    deleteKnowledgeBaseVersion, deleteKnowledgeRule,
    deleteKnowledgeRuleCitation, deleteKnowledgeSource, getActiveKnowledgeBaseVersion,
    getKnowledgeBaseSnapshot, getKnowledgeBaseVersions, getKnowledgeRuleCitations, getKnowledgeRules, getKnowledgeSources, upsertKnowledgeBaseVersion, upsertKnowledgeRule, upsertKnowledgeRuleCitation, upsertKnowledgeSource
} from "./knowledge-base";

export {
    deleteExercise, deleteTrainingPlan,
    deleteTrainingPlansByClassAndDate, deleteTrainingTemplate, getExercises, getHiddenTemplates, getLatestTrainingPlanByClass, getTrainingPlans, getTrainingTemplates, hideTrainingTemplate, saveExercise, saveTrainingPlan, saveTrainingTemplate, updateExercise, updateTrainingPlan, updateTrainingTemplate
} from "./training";

export {
    createClassPlan, deleteClassCalendarException, deleteClassCompetitiveProfile, deleteClassPlansByClass, getClassCalendarExceptions, getClassCompetitiveProfile, getClassPlansByClass, saveClassCalendarException, saveClassCompetitiveProfile, saveClassPlans, updateClassPlan
} from "./periodization";

export {
    convertStudentPreRegistration, createAbsenceNotice, deleteStudent, deleteStudentPreRegistration, deleteStudents, getAbsenceNotices, getAthleteIntakesByClass, getAttendanceAll, getAttendanceByClass,
    getAttendanceByDate,
    getAttendanceByStudent, getStudentById, getStudentPreRegistrations, getStudents,
    getStudentsByClass, linkExistingStudentByIdentity, listWeeklyAutopilotProposals, moveStudentsToClass, revealStudentCpf, saveAttendanceRecords, saveStudent, saveStudentPreRegistration, saveWeeklyAutopilotProposal, syncGoogleFormsAthleteIntakes, updateAbsenceNoticeStatus, updateStudent, updateStudentPhoto, updateStudentPreRegistration, updateWeeklyAutopilotProposalStatus, type LinkExistingStudentByIdentityResult, type SyncGoogleFormsAthleteIntakesResult
} from "./students";

