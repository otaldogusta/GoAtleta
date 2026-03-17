import type {
  ExistingStudentRow,
  ImportPolicy,
  MatchConfidence,
  MergeResult,
  NormalizedImportRow,
} from "./types.ts";

const currentYear = () => new Date().getFullYear();

const parseBirthYear = (value: string | null | undefined): number | null => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-\d{2}-\d{2}$/);
  if (!match) return null;
  const year = Number(match[1]);
  if (!Number.isFinite(year)) return null;
  return year;
};

const isBirthDateSuspect = (value: string | null | undefined) => {
  const year = parseBirthYear(value);
  if (!year) return true;
  const age = currentYear() - year;
  return age < 5 || age > 60;
};

const normalizeString = (value: string | null | undefined) => String(value ?? "").trim();

const sameValue = (a: string | null | undefined, b: string | null | undefined) =>
  normalizeString(a) === normalizeString(b);

const hasExisting = (value: string | null | undefined) => normalizeString(value).length > 0;

const isSafeAutoField = (field: string) =>
  field === "external_id" ||
  field === "rg_normalized" ||
  field === "phone" ||
  field === "login_email" ||
  field === "guardian_name" ||
  field === "guardian_phone" ||
  field === "guardian_cpf_hmac";

type MergeInput = {
  existing: ExistingStudentRow | null;
  incoming: NormalizedImportRow;
  policy: ImportPolicy;
  confidence: MatchConfidence;
  resolvedClassId: string | null;
  classFound: boolean;
  duplicateInput: boolean;
};

export const computeMergePatch = (params: MergeInput): MergeResult => {
  const { existing, incoming, policy, confidence, resolvedClassId, classFound, duplicateInput } = params;
  const flags: string[] = [];
  const patch: Record<string, unknown> = {};
  const conflicts: Record<string, unknown> = {};

  if (duplicateInput) {
    flags.push("DUPLICATE_INPUT_ROW");
    return {
      action: "conflict",
      patch: null,
      conflicts: { identityKey: incoming.identityKey ?? null },
      flags,
    };
  }

  if (!incoming.nameNormalized) {
    flags.push("NAME_REQUIRED");
    return {
      action: "conflict",
      patch: null,
      conflicts: { name: "Nome vazio ou inválido." },
      flags,
    };
  }

  if (incoming.birthDate && isBirthDateSuspect(incoming.birthDate)) {
    flags.push("BIRTHDATE_SUSPECT");
  }

  if (!existing && !resolvedClassId) {
    flags.push("CLASS_NOT_FOUND");
    return {
      action: "conflict",
      patch: null,
      conflicts: { classId: incoming.classId ?? incoming.className ?? null },
      flags,
    };
  }

  if (policy === "misto" && existing && (confidence === "medium" || confidence === "low")) {
    flags.push("LOW_CONFIDENCE_MATCH");
    return {
      action: "conflict",
      patch: null,
      conflicts: {
        matchedBy: confidence,
        reason: "Match de confiança insuficiente para atualização automática.",
      },
      flags,
    };
  }

  const setCreateDefaults = () => {
    patch.name = incoming.name;
    patch.ra = incoming.ra;
    patch.classid = resolvedClassId;
    patch.birthdate = incoming.birthDate;
    patch.age = incoming.birthDate && !isBirthDateSuspect(incoming.birthDate)
      ? Math.max(0, currentYear() - Number(incoming.birthDate.slice(0, 4)))
      : 0;
    patch.phone = incoming.phone ?? "";
    patch.login_email = incoming.loginEmail;
    patch.guardian_name = incoming.guardianName;
    patch.guardian_phone = incoming.guardianPhone;
    patch.external_id = incoming.externalId;
    patch.rg_normalized = incoming.rgNormalized;
    patch.guardian_cpf_hmac = incoming.guardianCpfHmac;
    patch.guardian_relation = null;
    patch.createdat = new Date().toISOString();
  };

  if (!existing) {
    setCreateDefaults();
    return { action: "create", patch, conflicts: null, flags };
  }

  const considerField = (
    key: string,
    incomingValue: string | null | undefined,
    existingValue: string | null | undefined,
    conflictFlag: string
  ) => {
    const incomingTrimmed = normalizeString(incomingValue);
    if (!incomingTrimmed) return;

    const existingHasValue = hasExisting(existingValue);
    const valuesEqual = sameValue(incomingTrimmed, existingValue);
    if (valuesEqual) return;

    const isSensitive = key === "name" || key === "birthdate" || key === "classid";
    const canOverwrite =
      policy === "agressivo" ||
      (policy === "misto" && confidence === "high" && !isSensitive && isSafeAutoField(key));

    if (!existingHasValue || canOverwrite) {
      patch[key] = incomingTrimmed;
      return;
    }

    conflicts[key] = { existing: existingValue ?? null, incoming: incomingTrimmed };
    flags.push(conflictFlag);
  };

  considerField("external_id", incoming.externalId, existing.external_id, "EXTERNAL_ID_CONFLICT");
  considerField("ra", incoming.ra, existing.ra, "RA_CONFLICT");
  considerField("rg_normalized", incoming.rgNormalized, existing.rg_normalized, "RG_CONFLICT");
  considerField("guardian_cpf_hmac", incoming.guardianCpfHmac, existing.guardian_cpf_hmac, "GUARDIAN_CPF_CONFLICT");
  considerField("guardian_name", incoming.guardianName, existing.guardian_name, "GUARDIAN_NAME_CONFLICT");
  considerField("guardian_phone", incoming.guardianPhone, existing.guardian_phone, "PHONE_CONFLICT");
  considerField("phone", incoming.phone, existing.phone, "PHONE_CONFLICT");
  considerField("login_email", incoming.loginEmail, existing.login_email, "LOGIN_EMAIL_CONFLICT");
  considerField("name", incoming.name, existing.name, "NAME_CONFLICT");

  if (incoming.birthDate) {
    if (isBirthDateSuspect(incoming.birthDate)) {
      conflicts.birthdate = { existing: existing.birthdate ?? null, incoming: incoming.birthDate };
      if (!flags.includes("BIRTHDATE_SUSPECT")) flags.push("BIRTHDATE_SUSPECT");
      if (!flags.includes("BIRTHDATE_CONFLICT")) flags.push("BIRTHDATE_CONFLICT");
    } else {
      considerField("birthdate", incoming.birthDate, existing.birthdate, "BIRTHDATE_CONFLICT");
      if ("birthdate" in patch) {
        patch.age = Math.max(0, currentYear() - Number(incoming.birthDate.slice(0, 4)));
      }
    }
  }

  if (resolvedClassId && classFound) {
    considerField("classid", resolvedClassId, existing.classid, "CLASS_CONFLICT");
  } else if (incoming.classId || incoming.className) {
    flags.push("CLASS_NOT_FOUND");
    conflicts.classid = { existing: existing.classid, incoming: incoming.classId ?? incoming.className ?? null };
  }

  const hasPatch = Object.keys(patch).length > 0;
  const hasConflicts = Object.keys(conflicts).length > 0;
  if (!hasPatch && hasConflicts) {
    return { action: "conflict", patch: null, conflicts, flags };
  }
  if (!hasPatch && !hasConflicts) {
    return { action: "skip", patch: null, conflicts: null, flags };
  }

  return {
    action: "update",
    patch,
    conflicts: hasConflicts ? conflicts : null,
    flags,
  };
};
