// ---------------------------------------------------------------------------
// Re-export barrel — all consumers of src/db/seed can keep their imports
// unchanged. Domain logic lives in the individual modules below.
// ---------------------------------------------------------------------------

export { clearLocalReadCaches } from "./client";

export {
  type NfcCheckinPendingPayload,
  type PendingWriteDeadRow,
  type PendingWritesDiagnostics,
  type SyncHealthReport,
  type PendingWriteFailureRow,
  buildNfcCheckinPendingWriteDedupKey,
  queueNfcCheckinWrite,
  getPendingWritesCount,
  getPendingWritesDiagnostics,
  listPendingWriteFailures,
  getPendingWritePayloadById,
  reprocessPendingWriteById,
  reprocessPendingWritesNetworkFailures,
  listPendingWritesDeadLetter,
  buildSyncHealthReport,
  exportSyncHealthReportJson,
  clearPendingWritesDeadLetterCandidates,
  flushPendingWrites,
} from "./nfc-sync";

export {
  seedIfEmpty,
  seedStudentsIfEmpty,
  getClasses,
  getClassById,
  updateClass,
  updateClassColor,
  updateClassAcwrLimits,
  saveClass,
  duplicateClass,
  deleteClass,
  deleteClassCascade,
} from "./classes";

export {
  getScoutingLogByDate,
  getLatestScoutingLog,
  saveScoutingLog,
  getStudentScoutingByRange,
  getStudentScoutingByDate,
  saveStudentScoutingLog,
  saveSessionLog,
  getSessionLogByDate,
  getSessionLogsByRange,
} from "./session";

export {
  getTrainingPlans,
  saveTrainingPlan,
  updateTrainingPlan,
  deleteTrainingPlan,
  deleteTrainingPlansByClassAndDate,
  getLatestTrainingPlanByClass,
  getTrainingTemplates,
  saveTrainingTemplate,
  updateTrainingTemplate,
  deleteTrainingTemplate,
  getHiddenTemplates,
  hideTrainingTemplate,
  getExercises,
  saveExercise,
  updateExercise,
  deleteExercise,
} from "./training";

export {
  getClassPlansByClass,
  createClassPlan,
  updateClassPlan,
  saveClassPlans,
  deleteClassPlansByClass,
  getClassCompetitiveProfile,
  saveClassCompetitiveProfile,
  deleteClassCompetitiveProfile,
  getClassCalendarExceptions,
  saveClassCalendarException,
  deleteClassCalendarException,
} from "./periodization";

export {
  type SyncGoogleFormsAthleteIntakesResult,
  type LinkExistingStudentByIdentityResult,
  linkExistingStudentByIdentity,
  getStudents,
  getStudentsByClass,
  getStudentById,
  saveStudent,
  updateStudent,
  revealStudentCpf,
  updateStudentPhoto,
  deleteStudent,
  getStudentPreRegistrations,
  saveStudentPreRegistration,
  updateStudentPreRegistration,
  deleteStudentPreRegistration,
  convertStudentPreRegistration,
  getAthleteIntakesByClass,
  syncGoogleFormsAthleteIntakes,
  saveAttendanceRecords,
  getAttendanceByClass,
  getAttendanceByDate,
  getAttendanceByStudent,
  getAttendanceAll,
  getAbsenceNotices,
  createAbsenceNotice,
  updateAbsenceNoticeStatus,
  listWeeklyAutopilotProposals,
  saveWeeklyAutopilotProposal,
  updateWeeklyAutopilotProposalStatus,
} from "./students";
