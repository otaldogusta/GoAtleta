// ---------------------------------------------------------------------------
// Students + pre-registrations + athlete intakes + attendance + absence notices
// + weekly autopilot proposals domain module
// ---------------------------------------------------------------------------

import * as Sentry from "@sentry/react-native";
import {
  mapGoogleFormsRowToAthleteIntake,
  matchAthleteIntakeToStudents,
  type AthleteIntake,
} from "../core/athlete-intake";
import { normalizeAgeBand, parseAgeBandRange } from "../core/age-band";
import type {
  AbsenceNotice,
  AttendanceRecord,
  ClassGroup,
  Student,
  StudentPreRegistration,
  StudentPreRegistrationStatus,
  WeeklyAutopilotProposal,
} from "../core/models";
import { normalizeCpfDigits, validateCpf } from "../utils/cpf";
import { normalizeRg } from "../utils/document-normalization";
import { deriveRaStartYear, normalizeRaDigits } from "../utils/student-ra";
import { safeJsonParse } from "../utils/safe-json";
import {
  CACHE_KEYS,
  getActiveOrganizationId,
  getScopedOrganizationId,
  isAuthError,
  isMissingColumnInSchemaCache,
  isMissingRelation,
  isNetworkError,
  readCache,
  supabaseDelete,
  supabaseGet,
  supabasePatch,
  supabasePost,
  writeCache,
} from "./client";
import { enqueueWrite } from "./nfc-sync";
import type {
  AbsenceNoticeRow,
  AthleteIntakeRow,
  AttendanceRow,
  StudentClassEnrollmentRow,
  StudentPreRegistrationRow,
  StudentRow,
} from "./row-types";
import { getClasses } from "./classes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LinkExistingStudentByIdentityResult = {
  status: "none" | "linked" | "already-linked";
  student: Student | null;
  matchedBy: "ra" | "email" | null;
};

export type SyncGoogleFormsAthleteIntakesResult = {
  total: number;
  created: number;
  updated: number;
  matchedStudents: number;
  linkedClasses: number;
  suggestedClasses: number;
};

type AbsenceNoticeInput = {
  studentId: string;
  classId: string;
  date: string;
  reason: string;
  note?: string;
  status?: AbsenceNotice["status"];
};

type WeeklyAutopilotProposalRow = {
  id: string;
  organization_id: string;
  class_id: string;
  week_start: string;
  summary: string;
  actions: string;
  proposed_plan_ids: string;
  status: WeeklyAutopilotProposal["status"];
  created_by: string;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Row mappers / internal helpers
// ---------------------------------------------------------------------------

const buildStudentsCacheKey = (organizationId: string | null) =>
  organizationId ? `${CACHE_KEYS.students}_${organizationId}` : CACHE_KEYS.students;

const mapStudentRow = (
  row: StudentRow,
  activeOrganizationId?: string | null
): Student => {
  const resolvedOrganizationId = row.organization_id ?? activeOrganizationId ?? "";
  return {
    id: row.id,
    name: row.name,
    organizationId: resolvedOrganizationId,
    photoUrl: row.photo_url ?? undefined,
    ra: row.ra ?? null,
    raStartYear: row.ra_start_year ?? null,
    externalId: row.external_id ?? null,
    cpfMasked: row.cpf_masked ?? null,
    cpfHmac: row.cpf_hmac ?? null,
    rg: row.rg ?? null,
    rgNormalized: row.rg_normalized ?? null,
    collegeCourse: row.college_course ?? null,
    isExperimental: Boolean(row.is_experimental),
    sourcePreRegistrationId: row.source_pre_registration_id ?? null,
    classId: row.classid,
    age: row.age,
    phone: row.phone,
    loginEmail: row.login_email ?? "",
    guardianName: row.guardian_name ?? "",
    guardianPhone: row.guardian_phone ?? "",
    guardianRelation: row.guardian_relation ?? "",
    healthIssue: row.health_issue ?? false,
    healthIssueNotes: row.health_issue_notes ?? "",
    medicationUse: row.medication_use ?? false,
    medicationNotes: row.medication_notes ?? "",
    healthObservations: row.health_observations ?? "",
    positionPrimary: (row.position_primary as Student["positionPrimary"]) ?? "indefinido",
    positionSecondary: (row.position_secondary as Student["positionSecondary"]) ?? "indefinido",
    athleteObjective: (row.athlete_objective as Student["athleteObjective"]) ?? "base",
    learningStyle: (row.learning_style as Student["learningStyle"]) ?? "misto",
    birthDate: row.birthdate ?? "",
    createdAt: row.createdat,
  };
};

const buildStudentsInFilter = (ids: string[]) =>
  ids
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => encodeURIComponent(id))
    .join(",");

const isAlreadyLinkedToClass = async (
  student: Student,
  classId: string,
  organizationId: string | null
) => {
  if (student.classId === classId) return true;
  try {
    const rows = await supabaseGet<StudentClassEnrollmentRow[]>(
      organizationId
        ? `/student_class_enrollments?select=id&student_id=eq.${encodeURIComponent(student.id)}&class_id=eq.${encodeURIComponent(classId)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`
        : `/student_class_enrollments?select=id&student_id=eq.${encodeURIComponent(student.id)}&class_id=eq.${encodeURIComponent(classId)}&limit=1`
    );
    return rows.length > 0;
  } catch (error) {
    if (isMissingRelation(error, "student_class_enrollments")) return false;
    throw error;
  }
};

const createStudentClassEnrollment = async (
  studentId: string,
  classId: string,
  modality: string | null,
  organizationId: string | null
) => {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    id: `sce_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    student_id: studentId,
    class_id: classId,
    modality: modality ?? null,
    status: "active",
    created_at: now,
    updated_at: now,
  };
  if (organizationId) {
    payload.organization_id = organizationId;
  }

  try {
    await supabasePost("/student_class_enrollments", [payload]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingRelation(error, "student_class_enrollments")) return;
    if (message.toLowerCase().includes("duplicate key")) return;
    throw error;
  }
};

const mapAbsenceNotice = (row: AbsenceNoticeRow): AbsenceNotice => ({
  id: row.id,
  studentId: row.student_id,
  classId: row.class_id,
  date: row.session_date,
  reason: row.reason,
  note: row.note ?? "",
  status:
    row.status === "confirmed"
      ? "confirmed"
      : row.status === "ignored"
      ? "ignored"
      : "pending",
  createdAt: row.created_at,
});

const mapWeeklyAutopilotProposal = (
  row: WeeklyAutopilotProposalRow
): WeeklyAutopilotProposal => ({
  id: row.id,
  organizationId: row.organization_id,
  classId: row.class_id,
  weekStart: row.week_start,
  summary: row.summary,
  actions: (() => {
    const parsed = safeJsonParse<unknown>(row.actions, []);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  })(),
  proposedPlanIds: (() => {
    const parsed = safeJsonParse<unknown>(row.proposed_plan_ids, []);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  })(),
  status: row.status,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ---------------------------------------------------------------------------
// Athlete intake helpers (internal)
// ---------------------------------------------------------------------------

const parseArrayField = (value: string[] | string | null | undefined) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const parsed = safeJsonParse<unknown>(value, value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
    }
    return value
      .split(/,|;|\|/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeAthleteIntakeLookup = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const matchAthleteIntakeHeaderToken = (normalizedHeader: string, token: string) => {
  const normalizedToken = normalizeAthleteIntakeLookup(token);
  if (!normalizedToken) return false;
  if (normalizedHeader === normalizedToken) return true;
  if (normalizedToken.length <= 2) {
    return normalizedHeader.split(" ").includes(normalizedToken);
  }
  return normalizedHeader.includes(normalizedToken);
};

const findAthleteIntakeRawValue = (row: Record<string, string>, includes: string[]) => {
  const entries = Object.entries(row);
  for (const [header, value] of entries) {
    const normalizedHeader = normalizeAthleteIntakeLookup(header);
    if (includes.some((token) => matchAthleteIntakeHeaderToken(normalizedHeader, token))) {
      return String(value ?? "").trim();
    }
  }
  return "";
};

const buildAthleteIntakeNameBirthKey = (
  name: string | null | undefined,
  birthDate: string | null | undefined
) => {
  const normalizedName = normalizeAthleteIntakeLookup(name);
  const normalizedBirthDate = String(birthDate ?? "").trim();
  if (!normalizedName || !normalizedBirthDate) return "";
  return `${normalizedName}::${normalizedBirthDate}`;
};

const buildAthleteIntakeClassLookup = (classes: ClassGroup[]) => {
  const byName = new Map<string, ClassGroup[]>();
  for (const item of classes) {
    const key = normalizeAthleteIntakeLookup(item.name);
    const bucket = byName.get(key) ?? [];
    bucket.push(item);
    byName.set(key, bucket);
  }
  return byName;
};

const hasVolleyballModality = (modalities: string[]) =>
  modalities.some((item) => {
    const normalized = normalizeAthleteIntakeLookup(item);
    return normalized.includes("volei") || normalized.includes("voleibol");
  });

const toAgeFromBirthDate = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDelta = today.getMonth() + 1 - month;
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < day)) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
};

const scoreAgeBandFit = (ageBand: string, age: number | null) => {
  if (age === null) return { score: 0, matched: false };
  const normalized = normalizeAgeBand(ageBand);
  const range = parseAgeBandRange(normalized);
  if (!range) return { score: 0, matched: false };
  if (age < range.min || age > range.max) return { score: -100, matched: false };
  const center = (range.min + range.max) / 2;
  const distance = Math.abs(age - center);
  return { score: 25 - Math.min(20, distance * 2), matched: true };
};

const suggestAthleteIntakeClassId = (params: {
  row: Record<string, string>;
  intake: AthleteIntake;
  classes: ClassGroup[];
}) => {
  if (!params.classes.length) return null;

  const normalizedUnitName = normalizeAthleteIntakeLookup(
    findAthleteIntakeRawValue(params.row, ["unidade", "polo", "campus", "local"])
  );
  const wantsVolleyball = hasVolleyballModality(params.intake.modalities);
  const age = toAgeFromBirthDate(params.intake.birthDate);

  const candidates = params.classes
    .map((item) => {
      let score = 0;
      if (normalizedUnitName) {
        const classUnit = normalizeAthleteIntakeLookup(item.unit);
        if (classUnit === normalizedUnitName) {
          score += 40;
        } else {
          score -= 10;
        }
      }

      if (wantsVolleyball) {
        score += item.modality === "voleibol" ? 28 : -8;
      }

      const ageFit = scoreAgeBandFit(item.ageBand, age);
      score += ageFit.score;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = candidates[0] ?? null;
  if (!best || best.score < 20) return null;
  return best.item.id;
};

const resolveAthleteIntakeClassId = (params: {
  row: Record<string, string>;
  intake: AthleteIntake;
  fallbackClassId?: string | null;
  classes: ClassGroup[];
}) => {
  if (params.fallbackClassId?.trim()) {
    return { classId: params.fallbackClassId, source: "student" as const };
  }

  const className = findAthleteIntakeRawValue(params.row, ["turma", "categoria", "grupo"]);
  if (!className) {
    const suggested = suggestAthleteIntakeClassId({
      row: params.row,
      intake: params.intake,
      classes: params.classes,
    });
    return suggested ? { classId: suggested, source: "suggested" as const } : { classId: null, source: "none" as const };
  }

  const byName = buildAthleteIntakeClassLookup(params.classes);
  const candidates = byName.get(normalizeAthleteIntakeLookup(className)) ?? [];
  if (!candidates.length) {
    const suggested = suggestAthleteIntakeClassId({
      row: params.row,
      intake: params.intake,
      classes: params.classes,
    });
    return suggested ? { classId: suggested, source: "suggested" as const } : { classId: null, source: "none" as const };
  }
  if (candidates.length === 1) return { classId: candidates[0].id, source: "explicit" as const };

  const unitName = findAthleteIntakeRawValue(params.row, ["unidade", "polo", "campus", "local"]);
  if (unitName) {
    const normalizedUnitName = normalizeAthleteIntakeLookup(unitName);
    const filtered = candidates.filter(
      (item) => normalizeAthleteIntakeLookup(item.unit) === normalizedUnitName
    );
    if (filtered.length === 1) {
      return { classId: filtered[0].id, source: "explicit" as const };
    }
  }

  const suggested = suggestAthleteIntakeClassId({
    row: params.row,
    intake: params.intake,
    classes: params.classes,
  });
  return suggested ? { classId: suggested, source: "suggested" as const } : { classId: null, source: "none" as const };
};

const mapAthleteIntakeRow = (row: AthleteIntakeRow): AthleteIntake => {
  const sex = row.sex === "masculino" || row.sex === "feminino" || row.sex === "outro" ? row.sex : null;
  const riskStatus =
    row.risk_status === "revisar" || row.risk_status === "atencao" || row.risk_status === "apto"
      ? row.risk_status
      : "apto";
  return {
    id: row.id,
    classId: row.class_id ?? null,
    studentId: row.student_id ?? null,
    fullName: row.full_name ?? "",
    ra: row.ra ?? null,
    sex,
    birthDate: row.birth_date ?? null,
    email: row.email ?? null,
    modalities: parseArrayField(row.modalities),
    parqPositive: Boolean(row.parq_positive),
    cardioRisk: Boolean(row.cardio_risk),
    orthoRisk: Boolean(row.ortho_risk),
    currentInjury: Boolean(row.current_injury),
    smoker: Boolean(row.smoker),
    allergies: Boolean(row.allergies),
    majorSurgery: Boolean(row.major_surgery),
    familyHistoryRisk: Boolean(row.family_history_risk),
    dizzinessOrSyncope: Boolean(row.dizziness_or_syncope),
    needsMedicalClearance: Boolean(row.needs_medical_clearance),
    needsIndividualAttention: Boolean(row.needs_individual_attention),
    jumpRestriction: row.jump_restriction === "avaliar" ? "avaliar" : "nenhuma",
    riskStatus,
    tags: parseArrayField(row.tags),
    notes: row.notes ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export async function linkExistingStudentByIdentity(params: {
  classId: string;
  organizationId?: string | null;
  modality?: string | null;
  ra?: string | null;
  email?: string | null;
}): Promise<LinkExistingStudentByIdentityResult> {
  const organizationId =
    params.organizationId ?? (await getActiveOrganizationId());
  if (!organizationId) {
    return { status: "none", student: null, matchedBy: null };
  }

  const ra = normalizeRaDigits(params.ra ?? "");
  const email = (params.email ?? "").trim().toLowerCase();

  let matchedBy: "ra" | "email" | null = null;
  let row: StudentRow | null = null;

  if (ra) {
    const raRows = await supabaseGet<StudentRow[]>(
      `/students?select=*&organization_id=eq.${encodeURIComponent(
        organizationId
      )}&ra=eq.${encodeURIComponent(ra)}&limit=1`
    );
    row = raRows[0] ?? null;
    matchedBy = row ? "ra" : null;
  }

  if (!row && email) {
    const emailRows = await supabaseGet<StudentRow[]>(
      `/students?select=*&organization_id=eq.${encodeURIComponent(
        organizationId
      )}&login_email=eq.${encodeURIComponent(email)}&limit=1`
    );
    row = emailRows[0] ?? null;
    matchedBy = row ? "email" : null;
  }

  if (!row) {
    return { status: "none", student: null, matchedBy: null };
  }

  const student = mapStudentRow(row, organizationId);
  const alreadyLinked = await isAlreadyLinkedToClass(
    student,
    params.classId,
    organizationId
  );
  if (alreadyLinked) {
    return { status: "already-linked", student, matchedBy };
  }

  await createStudentClassEnrollment(
    student.id,
    params.classId,
    params.modality?.trim() || null,
    organizationId
  );
  return { status: "linked", student, matchedBy };
}

export async function getStudents(
  options: { organizationId?: string | null } = {}
): Promise<Student[]> {
  const startedAt = Date.now();
  try {
    const activeOrganizationId = await getScopedOrganizationId(
      options.organizationId,
      "getStudents"
    );
    if (!activeOrganizationId) return [];
    const cacheKey = buildStudentsCacheKey(activeOrganizationId ?? null);
    const rows = await supabaseGet<StudentRow[]>(
      `/students?select=*&organization_id=eq.${encodeURIComponent(
        activeOrganizationId
      )}&order=name.asc`
    );
    const mapped = rows.map((row) => mapStudentRow(row, activeOrganizationId));
    await writeCache(cacheKey, mapped);
    Sentry.addBreadcrumb({
      category: "sqlite-query",
      message: "getStudents",
      level: "info",
      data: { ms: Date.now() - startedAt, rows: mapped.length },
    });
    return mapped;
  } catch (error) {
    if (isNetworkError(error) || isAuthError(error)) {
      const activeOrganizationId =
        options.organizationId ?? (await getActiveOrganizationId());
      const cacheKey = buildStudentsCacheKey(activeOrganizationId ?? null);
      const cached = await readCache<Student[]>(cacheKey);
      if (cached) return cached;
      return [];
    }
    throw error;
  }
}

export async function getStudentsByClass(
  classId: string,
  options: { organizationId?: string | null } = {}
): Promise<Student[]> {
  try {
    const activeOrganizationId =
      options.organizationId ?? (await getActiveOrganizationId());
    const rows = await supabaseGet<StudentRow[]>(
      activeOrganizationId
        ? "/students?select=*&classid=eq." +
            encodeURIComponent(classId) +
            "&organization_id=eq." +
            encodeURIComponent(activeOrganizationId) +
            "&order=name.asc"
        : "/students?select=*&classid=eq." + encodeURIComponent(classId) + "&order=name.asc"
    );
    const directStudents = rows.map((row) => mapStudentRow(row, activeOrganizationId));
    const byId = new Map(directStudents.map((student) => [student.id, student]));

    try {
      const enrollmentRows = await supabaseGet<StudentClassEnrollmentRow[]>(
        activeOrganizationId
          ? `/student_class_enrollments?select=student_id&class_id=eq.${encodeURIComponent(classId)}&organization_id=eq.${encodeURIComponent(activeOrganizationId)}&status=eq.active`
          : `/student_class_enrollments?select=student_id&class_id=eq.${encodeURIComponent(classId)}&status=eq.active`
      );
      const missingIds = Array.from(
        new Set(
          enrollmentRows
            .map((item) => item.student_id)
            .filter((studentId) => Boolean(studentId) && !byId.has(studentId))
        )
      );

      if (missingIds.length > 0) {
        const inFilter = buildStudentsInFilter(missingIds);
        if (inFilter) {
          const enrolledRows = await supabaseGet<StudentRow[]>(
            activeOrganizationId
              ? `/students?select=*&organization_id=eq.${encodeURIComponent(activeOrganizationId)}&id=in.(${inFilter})&order=name.asc`
              : `/students?select=*&id=in.(${inFilter})&order=name.asc`
          );
          for (const row of enrolledRows) {
            const mapped = mapStudentRow(row, activeOrganizationId);
            byId.set(mapped.id, { ...mapped, classId });
          }
        }
      }
    } catch (error) {
      if (!isMissingRelation(error, "student_class_enrollments")) {
        throw error;
      }
    }

    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (isNetworkError(error) || isAuthError(error)) {
      const activeOrganizationId =
        options.organizationId ?? (await getActiveOrganizationId());
      const cacheKey = buildStudentsCacheKey(activeOrganizationId ?? null);
      const cached = await readCache<Student[]>(cacheKey);
      if (cached) return cached.filter((item) => item.classId === classId);
      return [];
    }
    throw error;
  }
}

export async function getStudentById(
  id: string,
  options: { organizationId?: string | null } = {}
): Promise<Student | null> {
  const activeOrganizationId =
    options.organizationId ?? (await getActiveOrganizationId());
  const rows = await supabaseGet<StudentRow[]>(
    activeOrganizationId
      ? "/students?select=*&id=eq." +
          encodeURIComponent(id) +
          "&organization_id=eq." +
          encodeURIComponent(activeOrganizationId)
      : "/students?select=*&id=eq." + encodeURIComponent(id)
  );
  const row = rows[0];
  if (!row) return null;
  return mapStudentRow(row, activeOrganizationId);
}

export async function saveStudent(student: Student) {
  const normalizedLoginEmail = student.loginEmail?.trim().toLowerCase() || null;
  const activeOrganizationId =
    student.organizationId || (await getActiveOrganizationId());
  const rgRaw = student.rg?.trim() || null;
  const rgNormalized = rgRaw ? normalizeRg(rgRaw) : null;
  const raDigits = normalizeRaDigits(student.ra);
  const raStartYear = deriveRaStartYear(raDigits);
  const cpfCandidate = String(student.cpfMasked ?? "").trim();
  const cpfDigits = normalizeCpfDigits(cpfCandidate);
  const shouldProcessCpf = Boolean(cpfCandidate) && !cpfCandidate.includes("*");
  if (shouldProcessCpf && cpfDigits && !validateCpf(cpfDigits)) {
    throw new Error("CPF inválido.");
  }
  const payload: Record<string, unknown> = {
    id: student.id,
    name: student.name,
    ra: raDigits || null,
    ra_start_year: raStartYear,
    external_id: student.externalId?.trim() || null,
    rg: rgRaw,
    rg_normalized: rgNormalized,
    college_course: student.collegeCourse?.trim() || null,
    is_experimental: Boolean(student.isExperimental),
    source_pre_registration_id: student.sourcePreRegistrationId?.trim() || null,
    classid: student.classId,
    age: student.age,
    phone: student.phone,
    login_email: normalizedLoginEmail,
    guardian_name: student.guardianName?.trim() || null,
    guardian_phone: student.guardianPhone?.trim() || null,
    guardian_relation: student.guardianRelation?.trim() || null,
    health_issue: student.healthIssue ?? false,
    health_issue_notes: student.healthIssue ? student.healthIssueNotes?.trim() || null : null,
    medication_use: student.medicationUse ?? false,
    medication_notes: student.medicationUse ? student.medicationNotes?.trim() || null : null,
    health_observations: student.healthObservations?.trim() || null,
    position_primary: student.positionPrimary ?? "indefinido",
    position_secondary: student.positionSecondary ?? "indefinido",
    athlete_objective: student.athleteObjective ?? "base",
    learning_style: student.learningStyle ?? "misto",
    birthdate: student.birthDate ? student.birthDate : null,
    createdat: student.createdAt,
  };
  if (shouldProcessCpf && cpfDigits) {
    payload.cpf_input = cpfDigits;
  }
  if (activeOrganizationId) {
    payload.organization_id = activeOrganizationId;
  }
  try {
    await supabasePost("/students", [payload]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingColumnInSchemaCache(error, "college_course")) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.college_course;
      await supabasePost("/students", [fallbackPayload]);
      return;
    }
    if (message.includes("students_org_cpf_hmac_uidx")) {
      throw new Error("Já existe um aluno com este CPF nesta organização.");
    }
    if (message.includes("students_org_ra_uidx")) {
      throw new Error("Já existe um aluno com este RA nesta organização.");
    }
    throw error;
  }
}

export async function updateStudent(student: Student) {
  const normalizedLoginEmail = student.loginEmail?.trim().toLowerCase() || null;
  const activeOrganizationId =
    student.organizationId || (await getActiveOrganizationId());
  const rgRaw = student.rg?.trim() || null;
  const rgNormalized = rgRaw ? normalizeRg(rgRaw) : null;
  const raDigits = normalizeRaDigits(student.ra);
  const raStartYear = deriveRaStartYear(raDigits);
  const cpfCandidate = String(student.cpfMasked ?? "").trim();
  const cpfDigits = normalizeCpfDigits(cpfCandidate);
  const shouldProcessCpf = Boolean(cpfCandidate) && !cpfCandidate.includes("*");
  if (shouldProcessCpf && cpfDigits && !validateCpf(cpfDigits)) {
    throw new Error("CPF inválido.");
  }
  const payload: Record<string, unknown> = {
    name: student.name,
    ra: raDigits || null,
    ra_start_year: raStartYear,
    external_id: student.externalId?.trim() || null,
    rg: rgRaw,
    rg_normalized: rgNormalized,
    college_course: student.collegeCourse?.trim() || null,
    is_experimental: Boolean(student.isExperimental),
    source_pre_registration_id: student.sourcePreRegistrationId?.trim() || null,
    classid: student.classId,
    age: student.age,
    phone: student.phone,
    login_email: normalizedLoginEmail,
    guardian_name: student.guardianName?.trim() || null,
    guardian_phone: student.guardianPhone?.trim() || null,
    guardian_relation: student.guardianRelation?.trim() || null,
    health_issue: student.healthIssue ?? false,
    health_issue_notes: student.healthIssue ? student.healthIssueNotes?.trim() || null : null,
    medication_use: student.medicationUse ?? false,
    medication_notes: student.medicationUse ? student.medicationNotes?.trim() || null : null,
    health_observations: student.healthObservations?.trim() || null,
    position_primary: student.positionPrimary ?? "indefinido",
    position_secondary: student.positionSecondary ?? "indefinido",
    athlete_objective: student.athleteObjective ?? "base",
    learning_style: student.learningStyle ?? "misto",
    birthdate: student.birthDate ? student.birthDate : null,
    createdat: student.createdAt,
  };
  if (cpfCandidate) {
    if (shouldProcessCpf) {
      payload.cpf_input = cpfDigits;
    }
  } else {
    payload.cpf_input = "";
  }
  if (activeOrganizationId) {
    payload.organization_id = activeOrganizationId;
  }
  try {
    await supabasePatch(
      activeOrganizationId
        ? "/students?id=eq." +
            encodeURIComponent(student.id) +
            "&organization_id=eq." +
            encodeURIComponent(activeOrganizationId)
        : "/students?id=eq." + encodeURIComponent(student.id),
      payload
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingColumnInSchemaCache(error, "college_course")) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.college_course;
      await supabasePatch(
        activeOrganizationId
          ? "/students?id=eq." +
              encodeURIComponent(student.id) +
              "&organization_id=eq." +
              encodeURIComponent(activeOrganizationId)
          : "/students?id=eq." + encodeURIComponent(student.id),
        fallbackPayload
      );
      return;
    }
    if (message.includes("students_org_cpf_hmac_uidx")) {
      throw new Error("Já existe um aluno com este CPF nesta organização.");
    }
    if (message.includes("students_org_ra_uidx")) {
      throw new Error("Já existe um aluno com este RA nesta organização.");
    }
    throw error;
  }
}

export async function revealStudentCpf(
  studentId: string,
  options: {
    reason: string;
    legalBasis?: string | null;
  }
) {
  const reason = options.reason.trim();
  if (!reason) {
    throw new Error("Motivo obrigatorio para revelar CPF.");
  }
  let rows: { cpf?: string | null }[] = [];
  try {
    rows = await supabasePost<{ cpf?: string | null }[]>(
      "/rpc/reveal_student_cpf",
      {
        p_student_id: studentId,
        p_reason: reason,
        p_legal_basis: options.legalBasis?.trim() || null,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("CPF_NOT_AVAILABLE")) {
      throw new Error(
        "CPF completo indisponivel para este aluno. Salve o CPF novamente para habilitar a revelacao segura."
      );
    }
    if (message.includes("FORBIDDEN")) {
      throw new Error("Sem permissao para revelar CPF.");
    }
    if (message.includes("REASON_REQUIRED")) {
      throw new Error("Motivo obrigatorio para revelar CPF.");
    }
    throw error;
  }

  const first = Array.isArray(rows) ? rows[0] : null;
  const cpf = first?.cpf?.trim() || "";
  if (!cpf) {
    throw new Error("CPF indisponivel para este aluno.");
  }
  return cpf;
}

export async function updateStudentPhoto(studentId: string, photoUrl: string | null) {
  const activeOrganizationId = await getActiveOrganizationId();
  await supabasePatch(
    activeOrganizationId
      ? "/students?id=eq." +
          encodeURIComponent(studentId) +
          "&organization_id=eq." +
          encodeURIComponent(activeOrganizationId)
      : "/students?id=eq." + encodeURIComponent(studentId),
    {
      photo_url: photoUrl?.trim() || null,
    }
  );
}

export async function deleteStudent(id: string) {
  const activeOrganizationId = await getActiveOrganizationId();
  await supabaseDelete(
    activeOrganizationId
      ? "/students?id=eq." +
          encodeURIComponent(id) +
          "&organization_id=eq." +
          encodeURIComponent(activeOrganizationId)
      : "/students?id=eq." + encodeURIComponent(id)
  );
}

// ---------------------------------------------------------------------------
// Pre-registrations
// ---------------------------------------------------------------------------

const mapStudentPreRegistrationRow = (
  row: StudentPreRegistrationRow
): StudentPreRegistration => ({
  id: row.id,
  organizationId: row.organization_id,
  childName: row.child_name,
  guardianName: row.guardian_name,
  guardianPhone: row.guardian_phone,
  ageOrBirth: row.age_or_birth ?? null,
  classInterest: row.class_interest ?? null,
  unitInterest: row.unit_interest ?? null,
  trialDate: row.trial_date ?? null,
  status: row.status,
  notes: row.notes ?? null,
  convertedStudentId: row.converted_student_id ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function getStudentPreRegistrations(
  options: {
    organizationId?: string | null;
    status?: StudentPreRegistrationStatus | null;
  } = {}
): Promise<StudentPreRegistration[]> {
  try {
    const organizationId = await getScopedOrganizationId(
      options.organizationId,
      "getStudentPreRegistrations"
    );
    if (!organizationId) return [];

    const statusFilter =
      options.status && options.status.trim()
        ? `&status=eq.${encodeURIComponent(options.status)}`
        : "";
    const rows = await supabaseGet<StudentPreRegistrationRow[]>(
      `/student_pre_registrations?select=*&organization_id=eq.${encodeURIComponent(
        organizationId
      )}${statusFilter}&order=created_at.desc`
    );
    return rows.map(mapStudentPreRegistrationRow);
  } catch (error) {
    if (isMissingRelation(error, "student_pre_registrations")) return [];
    if (isNetworkError(error) || isAuthError(error)) return [];
    throw error;
  }
}

export async function saveStudentPreRegistration(
  item: Omit<StudentPreRegistration, "createdAt" | "updatedAt">
) {
  const organizationId = await getScopedOrganizationId(
    item.organizationId,
    "saveStudentPreRegistration"
  );
  if (!organizationId) throw new Error("Organização ativa não encontrada.");
  const now = new Date().toISOString();
  await supabasePost("/student_pre_registrations", [
    {
      id: item.id,
      organization_id: organizationId,
      child_name: item.childName.trim(),
      guardian_name: item.guardianName.trim(),
      guardian_phone: item.guardianPhone.trim(),
      age_or_birth: item.ageOrBirth?.trim() || null,
      class_interest: item.classInterest?.trim() || null,
      unit_interest: item.unitInterest?.trim() || null,
      trial_date: item.trialDate?.trim() || null,
      status: item.status,
      notes: item.notes?.trim() || null,
      converted_student_id: item.convertedStudentId?.trim() || null,
      created_at: now,
      updated_at: now,
    },
  ]);
}

export async function updateStudentPreRegistration(
  item: Omit<StudentPreRegistration, "createdAt" | "updatedAt">
) {
  const organizationId = await getScopedOrganizationId(
    item.organizationId,
    "updateStudentPreRegistration"
  );
  if (!organizationId) throw new Error("Organização ativa não encontrada.");
  await supabasePatch(
    `/student_pre_registrations?id=eq.${encodeURIComponent(
      item.id
    )}&organization_id=eq.${encodeURIComponent(organizationId)}`,
    {
      child_name: item.childName.trim(),
      guardian_name: item.guardianName.trim(),
      guardian_phone: item.guardianPhone.trim(),
      age_or_birth: item.ageOrBirth?.trim() || null,
      class_interest: item.classInterest?.trim() || null,
      unit_interest: item.unitInterest?.trim() || null,
      trial_date: item.trialDate?.trim() || null,
      status: item.status,
      notes: item.notes?.trim() || null,
      converted_student_id: item.convertedStudentId?.trim() || null,
      updated_at: new Date().toISOString(),
    }
  );
}

export async function deleteStudentPreRegistration(id: string) {
  const organizationId = await getActiveOrganizationId();
  await supabaseDelete(
    organizationId
      ? `/student_pre_registrations?id=eq.${encodeURIComponent(
          id
        )}&organization_id=eq.${encodeURIComponent(organizationId)}`
      : `/student_pre_registrations?id=eq.${encodeURIComponent(id)}`
  );
}

export async function convertStudentPreRegistration(
  preRegistration: Omit<StudentPreRegistration, "createdAt" | "updatedAt">,
  studentPayload: Student
) {
  await saveStudent({
    ...studentPayload,
    isExperimental: true,
    sourcePreRegistrationId: preRegistration.id,
  });
  await updateStudentPreRegistration({
    ...preRegistration,
    status: "converted",
    convertedStudentId: studentPayload.id,
  });
}

// ---------------------------------------------------------------------------
// Athlete intakes
// ---------------------------------------------------------------------------

export async function getAthleteIntakesByClass(
  classId: string,
  options: { organizationId?: string | null } = {}
): Promise<AthleteIntake[]> {
  try {
    const activeOrganizationId =
      options.organizationId ?? (await getActiveOrganizationId());
    const rows = await supabaseGet<AthleteIntakeRow[]>(
      activeOrganizationId
        ? "/athlete_intakes?select=*&class_id=eq." +
            encodeURIComponent(classId) +
            "&organization_id=eq." +
            encodeURIComponent(activeOrganizationId) +
            "&order=updated_at.desc"
        : "/athlete_intakes?select=*&class_id=eq." + encodeURIComponent(classId) + "&order=updated_at.desc"
    );
    return rows.map(mapAthleteIntakeRow);
  } catch (error) {
    if (isMissingRelation(error, "athlete_intakes")) return [];
    if (isNetworkError(error) || isAuthError(error)) return [];
    throw error;
  }
}

export async function syncGoogleFormsAthleteIntakes(params: {
  rawRows: Record<string, string>[];
  organizationId?: string | null;
  classes?: ClassGroup[];
}): Promise<SyncGoogleFormsAthleteIntakesResult> {
  const organizationId = await getScopedOrganizationId(
    params.organizationId,
    "syncGoogleFormsAthleteIntakes"
  );
  if (!organizationId) throw new Error("Organização ativa não encontrada.");

  const prepared = params.rawRows
    .map((row) => {
      const intake = mapGoogleFormsRowToAthleteIntake(row);
      if (!intake.fullName.trim()) return null;
      return { row, intake };
    })
    .filter((item): item is { row: Record<string, string>; intake: AthleteIntake } => Boolean(item));

  if (!prepared.length) {
    return { total: 0, created: 0, updated: 0, matchedStudents: 0, linkedClasses: 0, suggestedClasses: 0 };
  }

  const [students, classes, existingRows] = await Promise.all([
    getStudents({ organizationId }),
    params.classes?.length
      ? Promise.resolve(params.classes.filter((item) => item.organizationId === organizationId))
      : getClasses({ organizationId }),
    (async () => {
      try {
        return await supabaseGet<AthleteIntakeRow[]>(
          `/athlete_intakes?select=*&organization_id=eq.${encodeURIComponent(
            organizationId
          )}&order=updated_at.desc`
        );
      } catch (error) {
        if (isMissingRelation(error, "athlete_intakes")) return [];
        throw error;
      }
    })(),
  ]);

  const existingIntakes = existingRows.map(mapAthleteIntakeRow);
  const existingByStudentId = new Map<string, AthleteIntake>();
  const existingByRa = new Map<string, AthleteIntake>();
  const existingByEmail = new Map<string, AthleteIntake>();
  const existingByNameBirth = new Map<string, AthleteIntake>();

  const registerExistingIntake = (intake: AthleteIntake) => {
    if (intake.studentId?.trim()) existingByStudentId.set(intake.studentId, intake);
    const normalizedRa = normalizeRaDigits(intake.ra);
    if (normalizedRa) existingByRa.set(normalizedRa, intake);
    const normalizedEmail = String(intake.email ?? "").trim().toLowerCase();
    if (normalizedEmail) existingByEmail.set(normalizedEmail, intake);
    const nameBirthKey = buildAthleteIntakeNameBirthKey(intake.fullName, intake.birthDate);
    if (nameBirthKey) existingByNameBirth.set(nameBirthKey, intake);
  };

  existingIntakes.forEach(registerExistingIntake);

  const studentById = new Map(students.map((student) => [student.id, student]));
  const matches = matchAthleteIntakeToStudents(
    prepared.map((item) => item.intake),
    students
  );
  const matchedStudentIdByIntakeId = new Map(
    matches.matches.map((match) => [match.intakeId, match.studentId])
  );

  const result: SyncGoogleFormsAthleteIntakesResult = {
    total: prepared.length,
    created: 0,
    updated: 0,
    matchedStudents: 0,
    linkedClasses: 0,
    suggestedClasses: 0,
  };

  for (const item of prepared) {
    const matchedStudentId = matchedStudentIdByIntakeId.get(item.intake.id) ?? null;
    const matchedStudent = matchedStudentId ? studentById.get(matchedStudentId) ?? null : null;
    const resolvedClass = resolveAthleteIntakeClassId({
      row: item.row,
      intake: item.intake,
      fallbackClassId: matchedStudent?.classId ?? null,
      classes,
    });
    const resolvedClassId = resolvedClass.classId;

    const normalizedRa = normalizeRaDigits(item.intake.ra);
    const normalizedEmail = String(item.intake.email ?? "").trim().toLowerCase();
    const nameBirthKey = buildAthleteIntakeNameBirthKey(item.intake.fullName, item.intake.birthDate);

    const existing =
      (matchedStudentId ? existingByStudentId.get(matchedStudentId) : undefined) ??
      (normalizedRa ? existingByRa.get(normalizedRa) : undefined) ??
      (normalizedEmail ? existingByEmail.get(normalizedEmail) : undefined) ??
      (nameBirthKey ? existingByNameBirth.get(nameBirthKey) : undefined) ??
      null;

    const nowIso = new Date().toISOString();
    const payload = {
      organization_id: organizationId,
      class_id: resolvedClassId,
      student_id: matchedStudentId,
      full_name: item.intake.fullName,
      ra: normalizedRa || null,
      sex: item.intake.sex,
      birth_date: item.intake.birthDate,
      email: normalizedEmail || null,
      modalities: item.intake.modalities,
      parq_positive: item.intake.parqPositive,
      cardio_risk: item.intake.cardioRisk,
      ortho_risk: item.intake.orthoRisk,
      current_injury: item.intake.currentInjury,
      smoker: item.intake.smoker,
      allergies: item.intake.allergies,
      major_surgery: item.intake.majorSurgery,
      family_history_risk: item.intake.familyHistoryRisk,
      dizziness_or_syncope: item.intake.dizzinessOrSyncope,
      needs_medical_clearance: item.intake.needsMedicalClearance,
      needs_individual_attention: item.intake.needsIndividualAttention,
      jump_restriction: item.intake.jumpRestriction,
      risk_status: item.intake.riskStatus,
      tags: item.intake.tags,
      notes: item.intake.notes,
      updated_at: nowIso,
    };

    if (matchedStudentId) result.matchedStudents += 1;
    if (resolvedClassId) result.linkedClasses += 1;
    if (resolvedClass.source === "suggested" && resolvedClassId) result.suggestedClasses += 1;

    if (existing) {
      await supabasePatch(
        `/athlete_intakes?id=eq.${encodeURIComponent(existing.id)}&organization_id=eq.${encodeURIComponent(
          organizationId
        )}`,
        payload
      );
      registerExistingIntake({
        ...existing,
        classId: resolvedClassId,
        studentId: matchedStudentId,
        fullName: item.intake.fullName,
        ra: normalizedRa || null,
        sex: item.intake.sex,
        birthDate: item.intake.birthDate,
        email: normalizedEmail || null,
        modalities: item.intake.modalities,
        parqPositive: item.intake.parqPositive,
        cardioRisk: item.intake.cardioRisk,
        orthoRisk: item.intake.orthoRisk,
        currentInjury: item.intake.currentInjury,
        smoker: item.intake.smoker,
        allergies: item.intake.allergies,
        majorSurgery: item.intake.majorSurgery,
        familyHistoryRisk: item.intake.familyHistoryRisk,
        dizzinessOrSyncope: item.intake.dizzinessOrSyncope,
        needsMedicalClearance: item.intake.needsMedicalClearance,
        needsIndividualAttention: item.intake.needsIndividualAttention,
        jumpRestriction: item.intake.jumpRestriction,
        riskStatus: item.intake.riskStatus,
        tags: item.intake.tags,
        notes: item.intake.notes,
        updatedAt: nowIso,
      });
      result.updated += 1;
      continue;
    }

    await supabasePost("/athlete_intakes", [
      {
        id: item.intake.id,
        ...payload,
        created_at: nowIso,
      },
    ]);
    registerExistingIntake({
      ...item.intake,
      classId: resolvedClassId,
      studentId: matchedStudentId,
      ra: normalizedRa || null,
      email: normalizedEmail || null,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    result.created += 1;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export async function saveAttendanceRecords(
  classId: string,
  date: string,
  records: AttendanceRecord[],
  options?: { allowQueue?: boolean; organizationId?: string }
) {
  const allowQueue = options?.allowQueue !== false;
  try {
    const organizationId = options?.organizationId ?? (await getActiveOrganizationId());

    await supabaseDelete(
      "/attendance_logs?classid=eq." +
        encodeURIComponent(classId) +
        "&date=eq." +
        encodeURIComponent(date) +
        (organizationId
          ? "&organization_id=eq." + encodeURIComponent(organizationId)
          : "")
    );

    const rows: AttendanceRow[] = records.map((record) => ({
      id: record.id,
      classid: record.classId,
      studentid: record.studentId,
      date: record.date,
      status: record.status,
      note: record.note,
      organization_id: organizationId ?? undefined,
      pain_score:
        typeof record.painScore === "number" && Number.isFinite(record.painScore)
          ? record.painScore
          : null,
      createdat: record.createdAt,
    }));

    if (rows.length > 0) {
      await supabasePost("/attendance_logs", rows);
    }
  } catch (error) {
    if (allowQueue && isNetworkError(error)) {
      await enqueueWrite({
        id: "queue_att_" + Date.now(),
        kind: "attendance_records",
        payload: { classId, date, records },
        createdAt: new Date().toISOString(),
      });
      return;
    }
    throw error;
  }
}

export async function getAttendanceByClass(
  classId: string,
  options: { organizationId?: string | null } = {}
): Promise<AttendanceRecord[]> {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  const rows = await supabaseGet<AttendanceRow[]>(
    organizationId
      ? `/attendance_logs?select=*&classid=eq.${encodeURIComponent(classId)}&organization_id=eq.${encodeURIComponent(organizationId)}&order=date.desc`
      : `/attendance_logs?select=*&classid=eq.${encodeURIComponent(classId)}&order=date.desc`
  );
  return rows.map((row) => ({
    id: row.id,
    classId: row.classid,
    studentId: row.studentid,
    date: row.date,
    status: row.status === "faltou" ? "faltou" : "presente",
    note: row.note ?? "",
    painScore: row.pain_score ?? 0,
    createdAt: row.createdat,
  }));
}

export async function getAttendanceByDate(
  classId: string,
  date: string,
  options: { organizationId?: string | null } = {}
): Promise<AttendanceRecord[]> {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  const rows = await supabaseGet<AttendanceRow[]>(
    organizationId
      ? `/attendance_logs?select=*&classid=eq.${encodeURIComponent(classId)}&date=eq.${encodeURIComponent(date)}&organization_id=eq.${encodeURIComponent(organizationId)}`
      : `/attendance_logs?select=*&classid=eq.${encodeURIComponent(classId)}&date=eq.${encodeURIComponent(date)}`
  );
  return rows.map((row) => ({
    id: row.id,
    classId: row.classid,
    studentId: row.studentid,
    date: row.date,
    status: row.status === "faltou" ? "faltou" : "presente",
    note: row.note ?? "",
    painScore: row.pain_score ?? 0,
    createdAt: row.createdat,
  }));
}

export async function getAttendanceByStudent(
  studentId: string,
  options: { organizationId?: string | null } = {}
): Promise<AttendanceRecord[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const rows = await supabaseGet<AttendanceRow[]>(
      organizationId
        ? `/attendance_logs?select=*&studentid=eq.${encodeURIComponent(studentId)}&organization_id=eq.${encodeURIComponent(organizationId)}&order=date.desc`
        : `/attendance_logs?select=*&studentid=eq.${encodeURIComponent(studentId)}&order=date.desc`
    );
    return rows.map((row) => ({
      id: row.id,
      classId: row.classid,
      studentId: row.studentid,
      date: row.date,
      status: row.status === "faltou" ? "faltou" : "presente",
      note: row.note ?? "",
      painScore: row.pain_score ?? 0,
      createdAt: row.createdat,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("22P02") || message.includes("invalid input syntax for type uuid")) return [];
    throw error;
  }
}

export async function getAttendanceAll(
  options: { organizationId?: string | null } = {}
): Promise<AttendanceRecord[]> {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  const rows = await supabaseGet<AttendanceRow[]>(
    organizationId
      ? `/attendance_logs?select=*&organization_id=eq.${encodeURIComponent(organizationId)}&order=date.desc`
      : "/attendance_logs?select=*&order=date.desc"
  );
  return rows.map((row) => ({
    id: row.id,
    classId: row.classid,
    studentId: row.studentid,
    date: row.date,
    status: row.status === "faltou" ? "faltou" : "presente",
    note: row.note ?? "",
    painScore: row.pain_score ?? 0,
    createdAt: row.createdat,
  }));
}

// ---------------------------------------------------------------------------
// Absence notices
// ---------------------------------------------------------------------------

export async function getAbsenceNotices(
  options: { organizationId?: string | null } = {}
): Promise<AbsenceNotice[]> {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  const rows = await supabaseGet<AbsenceNoticeRow[]>(
    organizationId
      ? `/absence_notices?select=*&organization_id=eq.${encodeURIComponent(organizationId)}&order=created_at.desc`
      : "/absence_notices?select=*&order=created_at.desc"
  );
  return rows.map(mapAbsenceNotice);
}

export async function createAbsenceNotice(notice: AbsenceNoticeInput, options?: { organizationId?: string }) {
  const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
  await supabasePost("/absence_notices", [
    {
      student_id: notice.studentId,
      class_id: notice.classId,
      organization_id: organizationId ?? undefined,
      session_date: notice.date,
      reason: notice.reason,
      note: notice.note?.trim() || null,
      status: notice.status ?? "pending",
    },
  ]);
}

export async function updateAbsenceNoticeStatus(
  id: string,
  status: AbsenceNotice["status"]
) {
  const organizationId = await getActiveOrganizationId();
  await supabasePatch(
    organizationId
      ? "/absence_notices?id=eq." +
          encodeURIComponent(id) +
          "&organization_id=eq." +
          encodeURIComponent(organizationId)
      : "/absence_notices?id=eq." + encodeURIComponent(id),
    {
      status,
    }
  );
}

// ---------------------------------------------------------------------------
// Weekly autopilot proposals
// ---------------------------------------------------------------------------

export async function listWeeklyAutopilotProposals(options: {
  classId?: string;
  organizationId?: string | null;
  limit?: number;
} = {}) {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  const limit = Math.max(1, options.limit ?? 12);

  const rows = await supabaseGet<WeeklyAutopilotProposalRow[]>(
    organizationId
      ? options.classId
        ? `/weekly_autopilot_proposals?select=*&organization_id=eq.${encodeURIComponent(
            organizationId
          )}&class_id=eq.${encodeURIComponent(options.classId)}&order=updated_at.desc&limit=${limit}`
        : `/weekly_autopilot_proposals?select=*&organization_id=eq.${encodeURIComponent(
            organizationId
          )}&order=updated_at.desc&limit=${limit}`
      : "/weekly_autopilot_proposals?select=*&order=updated_at.desc&limit=" + String(limit)
  );

  return rows.map(mapWeeklyAutopilotProposal);
}

export async function saveWeeklyAutopilotProposal(proposal: WeeklyAutopilotProposal) {
  await supabasePost("/weekly_autopilot_proposals", [
    {
      id: proposal.id,
      organization_id: proposal.organizationId,
      class_id: proposal.classId,
      week_start: proposal.weekStart,
      summary: proposal.summary,
      actions: JSON.stringify(proposal.actions ?? []),
      proposed_plan_ids: JSON.stringify(proposal.proposedPlanIds ?? []),
      status: proposal.status,
      created_by: proposal.createdBy,
      created_at: proposal.createdAt,
      updated_at: proposal.updatedAt,
    },
  ]);
}

export async function updateWeeklyAutopilotProposalStatus(
  id: string,
  status: WeeklyAutopilotProposal["status"]
) {
  const organizationId = await getActiveOrganizationId();
  const nowIso = new Date().toISOString();
  await supabasePatch(
    organizationId
      ? "/weekly_autopilot_proposals?id=eq." +
          encodeURIComponent(id) +
          "&organization_id=eq." +
          encodeURIComponent(organizationId)
      : "/weekly_autopilot_proposals?id=eq." + encodeURIComponent(id),
    {
      status,
      updated_at: nowIso,
    }
  );
}
