import type { NormalizedImportRow, StudentImportRow } from "./types.ts";

const headerAliases: Record<string, string[]> = {
  externalId: ["externalid", "external_id", "id_externo", "id externo", "id legado"],
  name: ["name", "nome", "nome aluno", "aluno", "atleta"],
  ra: ["ra", "registroacademico", "matricula", "matriculaaluno"],
  birthDate: [
    "birthdate",
    "birth_date",
    "nascimento",
    "data nasc",
    "data nascimento",
    "dt nascimento",
  ],
  rg: ["rg", "rg aluno", "doc", "documento"],
  classId: ["classid", "class_id", "id turma", "id_turma"],
  className: ["classname", "class_name", "turma", "nome turma", "categoria"],
  unit: ["unit", "unidade", "polo", "local"],
  guardianName: ["guardianname", "guardian_name", "responsavel", "nome responsavel"],
  guardianPhone: [
    "guardianphone",
    "guardian_phone",
    "telefone responsavel",
    "fone responsavel",
    "celular responsavel",
  ],
  guardianCpf: ["guardiancpf", "guardian_cpf", "cpf responsavel", "cpf mae", "cpf pai"],
  phone: ["phone", "telefone", "celular"],
  loginEmail: ["loginemail", "login_email", "email", "e-mail", "email aluno"],
};

const normalizeHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizeUnit = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length === 13 && digits.startsWith("55")) return digits.slice(2);
  return digits;
};

const normalizeRg = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

const normalizeRa = (value: string) => value.replace(/\D+/g, "").trim();

const normalizeCpf = (value: string) => value.replace(/\D+/g, "").trim();

const normalizeIsoDate = (value: string): string | null => {
  const raw = value.trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const date = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    return raw;
  }
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const converted = `${br[3]}-${br[2]}-${br[1]}`;
    const date = new Date(`${converted}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    return converted;
  }
  return null;
};

const resolveRawValue = (
  row: Record<string, unknown>,
  canonicalKey: keyof StudentImportRow
): string => {
  const canonicalDirect = row[canonicalKey];
  if (typeof canonicalDirect === "string") return canonicalDirect.trim();

  const aliases = headerAliases[canonicalKey] ?? [];
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    if (!aliases.includes(normalizedKey)) continue;
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
};

const toHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

const encoder = new TextEncoder();

export const computeGuardianCpfHmac = async (
  cpfRaw: string,
  secret: string
): Promise<string | null> => {
  const normalized = normalizeCpf(cpfRaw);
  if (normalized.length !== 11) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(normalized));
  return toHex(signature);
};

export const hashSourceRows = async (rows: NormalizedImportRow[]): Promise<string> => {
  const canonicalRows = rows.map((item) => ({
    sourceRowNumber: item.sourceRowNumber,
    externalId: item.externalId ?? "",
    name: item.name,
    ra: item.ra ?? "",
    birthDate: item.birthDate ?? "",
    rgNormalized: item.rgNormalized ?? "",
    classId: item.classId ?? "",
    className: item.className ?? "",
    unit: item.unit ?? "",
    guardianName: item.guardianName ?? "",
    guardianPhone: item.guardianPhone ?? "",
    guardianCpfHmac: item.guardianCpfHmac ?? "",
    phone: item.phone ?? "",
    loginEmail: item.loginEmail ?? "",
  }));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(JSON.stringify(canonicalRows))
  );
  return toHex(digest);
};

export const normalizeImportRows = async (
  rows: Record<string, unknown>[],
  secret: string
): Promise<NormalizedImportRow[]> => {
  const normalizedRows: NormalizedImportRow[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const source = rows[index] ?? {};
    const sourceRowNumberRaw = resolveRawValue(source, "sourceRowNumber");
    const sourceRowNumberParsed = Number(sourceRowNumberRaw);
    const sourceRowNumber =
      Number.isFinite(sourceRowNumberParsed) && sourceRowNumberParsed > 0
        ? Math.floor(sourceRowNumberParsed)
        : index + 1;

    const externalIdRaw = resolveRawValue(source, "externalId");
    const nameRaw = resolveRawValue(source, "name");
    const raRaw = resolveRawValue(source, "ra");
    const birthDateRaw = resolveRawValue(source, "birthDate");
    const rgRaw = resolveRawValue(source, "rg");
    const classIdRaw = resolveRawValue(source, "classId");
    const classNameRaw = resolveRawValue(source, "className");
    const unitRaw = resolveRawValue(source, "unit");
    const guardianNameRaw = resolveRawValue(source, "guardianName");
    const guardianPhoneRaw = resolveRawValue(source, "guardianPhone");
    const guardianCpfRaw = resolveRawValue(source, "guardianCpf");
    const phoneRaw = resolveRawValue(source, "phone");
    const loginEmailRaw = resolveRawValue(source, "loginEmail");

    const normalized: NormalizedImportRow = {
      sourceRowNumber,
      externalId: externalIdRaw || null,
      name: nameRaw,
      nameNormalized: normalizeName(nameRaw),
      ra: normalizeRa(raRaw) || null,
      birthDate: normalizeIsoDate(birthDateRaw),
      rgNormalized: normalizeRg(rgRaw) || null,
      classId: classIdRaw || null,
      className: classNameRaw || null,
      unit: normalizeUnit(unitRaw) || null,
      guardianName: guardianNameRaw || null,
      guardianPhone: normalizePhone(guardianPhoneRaw) || null,
      guardianCpfHmac: await computeGuardianCpfHmac(guardianCpfRaw, secret),
      phone: normalizePhone(phoneRaw) || null,
      loginEmail: loginEmailRaw ? normalizeEmail(loginEmailRaw) : null,
      incomingForLog: {
        sourceRowNumber,
        externalId: externalIdRaw || null,
        name: nameRaw || null,
        ra: normalizeRa(raRaw) || null,
        birthDate: normalizeIsoDate(birthDateRaw),
        rg: normalizeRg(rgRaw) || null,
        classId: classIdRaw || null,
        className: classNameRaw || null,
        unit: unitRaw || null,
        guardianName: guardianNameRaw || null,
        guardianPhone: normalizePhone(guardianPhoneRaw) || null,
        guardianCpfHmac: await computeGuardianCpfHmac(guardianCpfRaw, secret),
        phone: normalizePhone(phoneRaw) || null,
        loginEmail: loginEmailRaw ? normalizeEmail(loginEmailRaw) : null,
      },
      identityKey: null,
    };

    const birthKey = normalized.birthDate ?? "";
    if (normalized.externalId) {
      normalized.identityKey = `external:${normalized.externalId}`;
    } else if (normalized.ra) {
      normalized.identityKey = `ra:${normalized.ra}`;
    } else if (normalized.rgNormalized) {
      normalized.identityKey = `rg:${normalized.rgNormalized}`;
    } else if (normalized.guardianCpfHmac && normalized.nameNormalized && birthKey) {
      normalized.identityKey = `cpf:${normalized.guardianCpfHmac}:${normalized.nameNormalized}:${birthKey}`;
    } else if (normalized.guardianPhone && normalized.nameNormalized && birthKey) {
      normalized.identityKey = `phone:${normalized.guardianPhone}:${normalized.nameNormalized}:${birthKey}`;
    } else if (normalized.nameNormalized && birthKey) {
      normalized.identityKey = `name:${normalized.nameNormalized}:${birthKey}`;
    } else {
      normalized.identityKey = null;
    }

    normalizedRows.push(normalized);
  }

  return normalizedRows;
};
