export type ImportMode = "preview" | "apply";
export type ImportPolicy = "conservador" | "misto" | "agressivo";
export type ImportRunStatus = "preview" | "applied" | "failed" | "partial";
export type ImportAction = "create" | "update" | "conflict" | "skip" | "error";
export type MatchConfidence = "high" | "medium" | "low";

export type StudentImportRow = {
  externalId?: string;
  name?: string;
  ra?: string;
  birthDate?: string;
  rg?: string;
  classId?: string;
  className?: string;
  unit?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianCpf?: string;
  phone?: string;
  loginEmail?: string;
  sourceRowNumber?: number;
};

export type NormalizedImportRow = {
  sourceRowNumber: number;
  externalId: string | null;
  name: string;
  nameNormalized: string;
  ra: string | null;
  birthDate: string | null;
  rgNormalized: string | null;
  classId: string | null;
  className: string | null;
  unit: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianCpfHmac: string | null;
  phone: string | null;
  loginEmail: string | null;
  incomingForLog: Record<string, unknown>;
  identityKey: string | null;
};

export type ExistingStudentRow = {
  id: string;
  organization_id: string;
  classid: string;
  name: string;
  ra: string | null;
  birthdate: string | null;
  age: number | null;
  phone: string | null;
  login_email: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_relation: string | null;
  external_id: string | null;
  rg_normalized: string | null;
  guardian_cpf_hmac: string | null;
  createdat: string;
};

export type ExistingClassRow = {
  id: string;
  name: string;
  unit: string | null;
  organization_id: string;
};

export type MatchResult = {
  student: ExistingStudentRow | null;
  matchedBy: string | null;
  confidence: MatchConfidence;
};

export type MergeResult = {
  action: ImportAction;
  patch: Record<string, unknown> | null;
  conflicts: Record<string, unknown> | null;
  flags: string[];
};
