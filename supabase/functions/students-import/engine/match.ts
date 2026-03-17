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
  byExternalId: Map<string, ExistingStudentRow[]>;
  byRa: Map<string, ExistingStudentRow[]>;
  byRg: Map<string, ExistingStudentRow[]>;
  byCpfNameBirth: Map<string, ExistingStudentRow[]>;
  byPhoneNameBirth: Map<string, ExistingStudentRow[]>;
  byNameBirth: Map<string, ExistingStudentRow[]>;
};

const buildCpfKey = (cpfHmac: string, nameNorm: string, birthDate: string) =>
  `cpf:${cpfHmac}:${nameNorm}:${birthDate}`;

const buildPhoneKey = (phone: string, nameNorm: string, birthDate: string) =>
  `phone:${phone}:${nameNorm}:${birthDate}`;

const buildNameBirthKey = (nameNorm: string, birthDate: string) =>
  `name:${nameNorm}:${birthDate}`;

const pushToMatcher = (
  map: Map<string, ExistingStudentRow[]>,
  key: string,
  student: ExistingStudentRow
) => {
  if (!key) return;
  const current = map.get(key) ?? [];
  if (current.some((item) => item.id === student.id)) return;
  current.push(student);
  map.set(key, current);
};

const matchFromCandidates = (
  candidates: ExistingStudentRow[] | undefined,
  matchedBy: string,
  confidence: "high" | "medium" | "low"
): MatchResult | null => {
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) {
    return {
      student: candidates[0],
      matchedBy,
      confidence,
      ambiguousBy: null,
      candidateIds: [candidates[0].id],
    };
  }
  return {
    student: null,
    matchedBy,
    confidence: "low",
    ambiguousBy: matchedBy,
    candidateIds: candidates.map((item) => item.id),
  };
};

export const buildMatcher = (students: ExistingStudentRow[]): Matcher => {
  const matcher: Matcher = {
    byExternalId: new Map(),
    byRa: new Map(),
    byRg: new Map(),
    byCpfNameBirth: new Map(),
    byPhoneNameBirth: new Map(),
    byNameBirth: new Map(),
  };

  for (const student of students) {
    const externalId = String(student.external_id ?? "").trim();
    if (externalId) pushToMatcher(matcher.byExternalId, externalId, student);

    const ra = String(student.ra ?? "").replace(/\D+/g, "").trim();
    if (ra) pushToMatcher(matcher.byRa, ra, student);

    const rg = String(student.rg_normalized ?? "").trim();
    if (rg) pushToMatcher(matcher.byRg, rg, student);

    const nameNorm = normalizeName(student.name);
    const birth = dateKey(student.birthdate);
    if (!nameNorm || !birth) continue;

    const cpfHmac = String(student.guardian_cpf_hmac ?? "").trim();
    if (cpfHmac) {
      const key = buildCpfKey(cpfHmac, nameNorm, birth);
      pushToMatcher(matcher.byCpfNameBirth, key, student);
    }

    const phone = normalizePhone(student.guardian_phone);
    if (phone) {
      const key = buildPhoneKey(phone, nameNorm, birth);
      pushToMatcher(matcher.byPhoneNameBirth, key, student);
    }

    const nameBirth = buildNameBirthKey(nameNorm, birth);
    pushToMatcher(matcher.byNameBirth, nameBirth, student);
  }

  return matcher;
};

export const registerStudentInMatcher = (matcher: Matcher, student: ExistingStudentRow) => {
  const externalId = String(student.external_id ?? "").trim();
  if (externalId) pushToMatcher(matcher.byExternalId, externalId, student);

  const ra = String(student.ra ?? "").replace(/\D+/g, "").trim();
  if (ra) pushToMatcher(matcher.byRa, ra, student);

  const rg = String(student.rg_normalized ?? "").trim();
  if (rg) pushToMatcher(matcher.byRg, rg, student);

  const nameNorm = normalizeName(student.name);
  const birth = dateKey(student.birthdate);
  if (!nameNorm || !birth) return;

  const cpfHmac = String(student.guardian_cpf_hmac ?? "").trim();
  if (cpfHmac) {
    pushToMatcher(matcher.byCpfNameBirth, buildCpfKey(cpfHmac, nameNorm, birth), student);
  }

  const phone = normalizePhone(student.guardian_phone);
  if (phone) {
    pushToMatcher(matcher.byPhoneNameBirth, buildPhoneKey(phone, nameNorm, birth), student);
  }

  pushToMatcher(matcher.byNameBirth, buildNameBirthKey(nameNorm, birth), student);
};

export const findExistingStudent = (
  row: NormalizedImportRow,
  matcher: Matcher
): MatchResult => {
  if (row.externalId) {
    const match = matchFromCandidates(matcher.byExternalId.get(row.externalId), "external_id", "high");
    if (match) return match;
  }

  if (row.ra) {
    const match = matchFromCandidates(matcher.byRa.get(row.ra), "ra", "high");
    if (match) return match;
  }

  if (row.rgNormalized) {
    const match = matchFromCandidates(matcher.byRg.get(row.rgNormalized), "rg_normalized", "high");
    if (match) return match;
  }

  if (row.guardianCpfHmac && row.nameNormalized && row.birthDate) {
    const key = buildCpfKey(row.guardianCpfHmac, row.nameNormalized, row.birthDate);
    const match = matchFromCandidates(matcher.byCpfNameBirth.get(key), "guardian_cpf_hmac+name+birthdate", "high");
    if (match) return match;
  }

  if (row.guardianPhone && row.nameNormalized && row.birthDate) {
    const key = buildPhoneKey(row.guardianPhone, row.nameNormalized, row.birthDate);
    const match = matchFromCandidates(matcher.byPhoneNameBirth.get(key), "guardian_phone+name+birthdate", "medium");
    if (match) return match;
  }

  if (row.nameNormalized && row.birthDate) {
    const key = buildNameBirthKey(row.nameNormalized, row.birthDate);
    const match = matchFromCandidates(matcher.byNameBirth.get(key), "name+birthdate", "low");
    if (match) return match;
  }

  return { student: null, matchedBy: null, confidence: "low", ambiguousBy: null, candidateIds: [] };
};
