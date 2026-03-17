import {
    applyStudentsImport,
    applyStudentsImportWithToken,
    getStudentImportRunLogs,
    listStudentImportRuns,
    previewStudentsImport,
    previewStudentsImportWithToken,
    type ImportPolicy,
    type StudentImportFunctionResult,
    type StudentImportLog,
    type StudentImportRow,
    type StudentImportRun,
    type StudentsImportApplyPayload,
    type StudentsImportPreviewPayload,
} from "../api/student-import";

export type StudentsSyncPreviewPayload = StudentsImportPreviewPayload;

export type StudentsSyncApplyPayload = StudentsImportApplyPayload;

export type StudentsSyncPayload = {
  organizationId: string;
  policy: ImportPolicy;
  sourceFilename?: string;
  rows?: StudentImportRow[];
  runId?: string;
  resolutions?: Record<string, "KEEP_EXISTING" | "OVERWRITE" | "SKIP">;
};

export type StudentsSyncRequest = StudentsSyncPayload & {
  accessToken?: string | null;
};

export const previewStudentsSync = async (
  request: StudentsSyncRequest & StudentsSyncPreviewPayload
): Promise<StudentImportFunctionResult> => {
  const { accessToken, ...payload } = request;
  if (accessToken) {
    return previewStudentsImportWithToken(payload as StudentsSyncPreviewPayload, accessToken);
  }
  return previewStudentsImport(payload as StudentsSyncPreviewPayload);
};

export const applyStudentsSync = async (
  request: StudentsSyncRequest & StudentsSyncApplyPayload
): Promise<StudentImportFunctionResult> => {
  const { accessToken, ...payload } = request;
  if (accessToken) {
    return applyStudentsImportWithToken(payload as StudentsSyncApplyPayload, accessToken);
  }
  return applyStudentsImport(payload as StudentsSyncApplyPayload);
};

export const listStudentsSyncRuns = async (
  organizationId: string,
  limit = 20
): Promise<StudentImportRun[]> => listStudentImportRuns(organizationId, limit);

export const listStudentsSyncRunLogs = async (
  runId: string,
  limit = 200,
  offset = 0
): Promise<StudentImportLog[]> => getStudentImportRunLogs(runId, limit, offset);

export type {
    ImportPolicy,
    StudentImportFunctionResult,
    StudentImportLog,
    StudentImportRow,
    StudentImportRun
};

