import type {
  ExistingStudentRow,
  MatchResult,
  NormalizedImportRow,
} from "./types.ts";

const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizePhone = (value: string | null | undefined) => {
  const digits = String(value ?? "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length === 13 && digits.startsWith("55")) return digits.slice(2);
  return digits;
};

const dateKey = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.includes("T") ? raw.split("T")[0] : raw;
};

type Matcher = {
  byExternalId: Map<string, ExistingStudentRow>;
  byRg: Map<string, ExistingStudentRow>;
  byCpfNameBirth: Map<string, ExistingStudentRow>;
  byPhoneNameBirth: Map<string, ExistingStudentRow>;
  byNameBirth: Map<string, ExistingStudentRow>;
};

const buildCpfKey = (cpfHmac: string, nameNorm: string, birthDate: string) =>
  `cpf:${cpfHmac}:${nameNorm}:${birthDate}`;

const buildPhoneKey = (phone: string, nameNorm: string, birthDate: string) =>
  `phone:${phone}:${nameNorm}:${birthDate}`;

const buildNameBirthKey = (nameNorm: string, birthDate: string) =>
  `name:${nameNorm}:${birthDate}`;

export const buildMatcher = (students: ExistingStudentRow[]): Matcher => {
  const matcher: Matcher = {
    byExternalId: new Map(),
    byRg: new Map(),
    byCpfNameBirth: new Map(),
    byPhoneNameBirth: new Map(),
    byNameBirth: new Map(),
  };

  for (const student of students) {
    const externalId = String(student.external_id ?? "").trim();
    if (externalId && !matcher.byExternalId.has(externalId)) {
      matcher.byExternalId.set(externalId, student);
    }

    const rg = String(student.rg_normalized ?? "").trim();
    if (rg && !matcher.byRg.has(rg)) {
      matcher.byRg.set(rg, student);
    }

    const nameNorm = normalizeName(student.name);
    const birth = dateKey(student.birthdate);
    if (!nameNorm || !birth) continue;

    const cpfHmac = String(student.guardian_cpf_hmac ?? "").trim();
    if (cpfHmac) {
      const key = buildCpfKey(cpfHmac, nameNorm, birth);
      if (!matcher.byCpfNameBirth.has(key)) matcher.byCpfNameBirth.set(key, student);
    }

    const phone = normalizePhone(student.guardian_phone);
    if (phone) {
      const key = buildPhoneKey(phone, nameNorm, birth);
      if (!matcher.byPhoneNameBirth.has(key)) matcher.byPhoneNameBirth.set(key, student);
    }

    const nameBirth = buildNameBirthKey(nameNorm, birth);
    if (!matcher.byNameBirth.has(nameBirth)) {
      matcher.byNameBirth.set(nameBirth, student);
    }
  }

  return matcher;
};

export const registerStudentInMatcher = (matcher: Matcher, student: ExistingStudentRow) => {
  const externalId = String(student.external_id ?? "").trim();
  if (externalId) matcher.byExternalId.set(externalId, student);

  const rg = String(student.rg_normalized ?? "").trim();
  if (rg) matcher.byRg.set(rg, student);

  const nameNorm = normalizeName(student.name);
  const birth = dateKey(student.birthdate);
  if (!nameNorm || !birth) return;

  const cpfHmac = String(student.guardian_cpf_hmac ?? "").trim();
  if (cpfHmac) {
    matcher.byCpfNameBirth.set(buildCpfKey(cpfHmac, nameNorm, birth), student);
  }

  const phone = normalizePhone(student.guardian_phone);
  if (phone) {
    matcher.byPhoneNameBirth.set(buildPhoneKey(phone, nameNorm, birth), student);
  }

  matcher.byNameBirth.set(buildNameBirthKey(nameNorm, birth), student);
};

export const findExistingStudent = (
  row: NormalizedImportRow,
  matcher: Matcher
): MatchResult => {
  if (row.externalId) {
    const student = matcher.byExternalId.get(row.externalId) ?? null;
    if (student) return { student, matchedBy: "external_id", confidence: "high" };
  }

  if (row.rgNormalized) {
    const student = matcher.byRg.get(row.rgNormalized) ?? null;
    if (student) return { student, matchedBy: "rg_normalized", confidence: "high" };
  }

  if (row.guardianCpfHmac && row.nameNormalized && row.birthDate) {
    const key = buildCpfKey(row.guardianCpfHmac, row.nameNormalized, row.birthDate);
    const student = matcher.byCpfNameBirth.get(key) ?? null;
    if (student) return { student, matchedBy: "guardian_cpf_hmac+name+birthdate", confidence: "high" };
  }

  if (row.guardianPhone && row.nameNormalized && row.birthDate) {
    const key = buildPhoneKey(row.guardianPhone, row.nameNormalized, row.birthDate);
    const student = matcher.byPhoneNameBirth.get(key) ?? null;
    if (student) return { student, matchedBy: "guardian_phone+name+birthdate", confidence: "medium" };
  }

  if (row.nameNormalized && row.birthDate) {
    const key = buildNameBirthKey(row.nameNormalized, row.birthDate);
    const student = matcher.byNameBirth.get(key) ?? null;
    if (student) return { student, matchedBy: "name+birthdate", confidence: "low" };
  }

  return { student: null, matchedBy: null, confidence: "low" };
};
