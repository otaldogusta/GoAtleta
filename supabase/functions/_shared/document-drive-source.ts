import { normalizeAcademicText } from "./academic-knowledge.ts";

export const DRIVE_SOURCE_PROFILES = [
  "academic",
  "institutional_actions",
  "monthly_plan",
  "report",
  "lesson_plan",
  "unknown",
] as const;

export const DRIVE_ACADEMIC_SCOPES = ["user", "workspace"] as const;

export type DriveSourceProfile = (typeof DRIVE_SOURCE_PROFILES)[number];
export type DriveFolderRole = DriveSourceProfile;
export type DriveAcademicScope = (typeof DRIVE_ACADEMIC_SCOPES)[number];
export type DriveConnectionScope =
  "user_academic" | "workspace_academic" | "workspace";
export type DriveDocumentSourceScope =
  | "user_academic"
  | "workspace_academic"
  | "workspace_institutional"
  | "class_planning"
  | "class_history";
export type DriveDocumentType =
  | "academic_support"
  | "institutional_guidance"
  | "monthly_plan"
  | "report"
  | "lesson_plan"
  | "unknown";

export type DriveSourceProfilePolicy = {
  sourceProfile: DriveSourceProfile;
  academicScope: DriveAcademicScope | null;
  connectionScope: DriveConnectionScope;
  sourceScope: DriveDocumentSourceScope;
  minimumRoleLevel: number;
  classBindingAllowed: boolean;
  ownerUserRequired: boolean;
};

export type AllowedDriveSourceProfile = {
  folderId: string;
  sourceProfile: DriveSourceProfile;
  academicScope: DriveAcademicScope | null;
};

export type DriveMonthResolution = {
  monthNumber: number;
  monthKey: string;
  year: number | null;
  matchedValue: string;
};

export type DriveDocumentDateResolution = {
  dateKey: string;
  matchedValue: string;
};

const MONTH_NAMES = [
  ["janeiro", "jan"],
  ["fevereiro", "fev"],
  ["marco", "mar"],
  ["abril", "abr"],
  ["maio", "mai"],
  ["junho", "jun"],
  ["julho", "jul"],
  ["agosto", "ago"],
  ["setembro", "set"],
  ["outubro", "out"],
  ["novembro", "nov"],
  ["dezembro", "dez"],
] as const;

const isDriveFolderId = (value: string) => /^[A-Za-z0-9_-]{20,}$/.test(value);
const isAllowedGoogleDriveFetchHost = (hostname: string) =>
  hostname === "www.googleapis.com" ||
  hostname.endsWith(".googleapis.com") ||
  hostname === "googleusercontent.com" ||
  hostname.endsWith(".googleusercontent.com") ||
  hostname === "drive.usercontent.google.com" ||
  hostname.endsWith(".usercontent.google.com");

export const isDriveSourceProfile = (
  value: unknown,
): value is DriveSourceProfile =>
  DRIVE_SOURCE_PROFILES.includes(String(value ?? "") as DriveSourceProfile);

export const isDriveAcademicScope = (
  value: unknown,
): value is DriveAcademicScope =>
  DRIVE_ACADEMIC_SCOPES.includes(String(value ?? "") as DriveAcademicScope);

export function assertSafeGoogleDriveFetchUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("URL de leitura do Google Drive inválida.");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== "443") ||
    !isAllowedGoogleDriveFetchHost(parsed.hostname.toLowerCase())
  ) {
    throw new Error("Destino de leitura do Google Drive não permitido.");
  }
  return parsed;
}

export function resolveSafeGoogleDriveRedirect(
  currentUrl: string,
  location: string,
) {
  const current = assertSafeGoogleDriveFetchUrl(currentUrl);
  const redirect = new URL(location, current);
  return assertSafeGoogleDriveFetchUrl(redirect.toString()).toString();
}

export function resolveDriveSourceProfile(params: {
  sourceProfile?: unknown;
  academicScope?: unknown;
}): DriveSourceProfilePolicy {
  const sourceProfile = params.sourceProfile
    ? String(params.sourceProfile)
    : "academic";
  if (!isDriveSourceProfile(sourceProfile)) {
    throw new Error("Perfil da fonte documental inválido.");
  }

  if (sourceProfile === "academic") {
    const academicScope = params.academicScope
      ? String(params.academicScope)
      : "user";
    if (!isDriveAcademicScope(academicScope)) {
      throw new Error("Escopo da fonte acadêmica inválido.");
    }
    return academicScope === "workspace"
      ? {
          sourceProfile,
          academicScope,
          connectionScope: "workspace_academic",
          sourceScope: "workspace_academic",
          minimumRoleLevel: 40,
          classBindingAllowed: false,
          ownerUserRequired: false,
        }
      : {
          sourceProfile,
          academicScope,
          connectionScope: "user_academic",
          sourceScope: "user_academic",
          minimumRoleLevel: 10,
          classBindingAllowed: false,
          ownerUserRequired: true,
        };
  }

  const sourceScope: DriveDocumentSourceScope =
    sourceProfile === "report"
      ? "class_history"
      : sourceProfile === "monthly_plan" || sourceProfile === "lesson_plan"
        ? "class_planning"
        : "workspace_institutional";

  return {
    sourceProfile,
    academicScope: null,
    connectionScope: "workspace",
    sourceScope,
    minimumRoleLevel: 40,
    classBindingAllowed: true,
    ownerUserRequired: false,
  };
}

export function documentTypeForFolderRole(
  role: DriveFolderRole,
): DriveDocumentType {
  if (role === "academic") return "academic_support";
  if (role === "institutional_actions") return "institutional_guidance";
  return role;
}

export function resolveDriveMonth(
  values: Array<string | null | undefined>,
): DriveMonthResolution | null {
  const candidates = values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const sharedYearMatch = normalizeAcademicText(candidates.join(" ")).match(
    /\b(20\d{2})\b/,
  );
  const sharedYear = sharedYearMatch ? Number(sharedYearMatch[1]) : null;

  for (const candidate of candidates) {
    const normalized = normalizeAcademicText(candidate);
    const dayMonthYear = normalized.match(
      /(?:^|[^0-9])(?:[0-2]?\d|3[01])[\s./-]+(0?[1-9]|1[0-2])(?:[\s./-]+(20\d{2}|\d{2}))?(?:[^0-9]|$)/,
    );
    if (dayMonthYear) {
      const monthNumber = Number(dayMonthYear[1]);
      const rawYear = dayMonthYear[2];
      const year = rawYear
        ? rawYear.length === 2
          ? 2000 + Number(rawYear)
          : Number(rawYear)
        : sharedYear;
      return {
        monthNumber,
        monthKey: year
          ? `${year}-${String(monthNumber).padStart(2, "0")}`
          : String(monthNumber).padStart(2, "0"),
        year,
        matchedValue: candidate,
      };
    }
    const yearMonth = normalized.match(
      /(?:^|[^0-9])(20\d{2})[\s._/-]+(0?[1-9]|1[0-2])(?:[^0-9]|$)/,
    );
    if (yearMonth) {
      const year = Number(yearMonth[1]);
      const monthNumber = Number(yearMonth[2]);
      return {
        monthNumber,
        monthKey: `${year}-${String(monthNumber).padStart(2, "0")}`,
        year,
        matchedValue: candidate,
      };
    }

    const yearMatch = normalized.match(/\b(20\d{2})\b/);
    for (let index = 0; index < MONTH_NAMES.length; index += 1) {
      const [fullName, abbreviation] = MONTH_NAMES[index];
      const monthPattern = new RegExp(
        `(?:^|[^a-z])(?:${fullName}|${abbreviation})(?:[^a-z]|$)`,
      );
      if (!monthPattern.test(normalized)) continue;
      const monthNumber = index + 1;
      const year = yearMatch ? Number(yearMatch[1]) : sharedYear;
      return {
        monthNumber,
        monthKey: year
          ? `${year}-${String(monthNumber).padStart(2, "0")}`
          : String(monthNumber).padStart(2, "0"),
        year,
        matchedValue: candidate,
      };
    }
  }

  return null;
}

const buildValidDateKey = (year: number, month: number, day: number) => {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  const dateKey = `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === dateKey
    ? dateKey
    : null;
};

export function resolveDriveDocumentDate(
  values: Array<string | null | undefined>,
): DriveDocumentDateResolution | null {
  const candidates = values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeAcademicText(candidate);
    const isoMatch = normalized.match(
      /(?:^|[^0-9])(20\d{2})[\s./-]+(0?[1-9]|1[0-2])[\s./-]+([0-2]?\d|3[01])(?:[^0-9]|$)/,
    );
    if (isoMatch) {
      const dateKey = buildValidDateKey(
        Number(isoMatch[1]),
        Number(isoMatch[2]),
        Number(isoMatch[3]),
      );
      if (dateKey) return { dateKey, matchedValue: candidate };
    }

    const dayMonthYearMatch = normalized.match(
      /(?:^|[^0-9])([0-2]?\d|3[01])[\s./-]+(0?[1-9]|1[0-2])[\s./-]+(20\d{2}|\d{2})(?:[^0-9]|$)/,
    );
    if (dayMonthYearMatch) {
      const rawYear = dayMonthYearMatch[3];
      const year =
        rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
      const dateKey = buildValidDateKey(
        year,
        Number(dayMonthYearMatch[2]),
        Number(dayMonthYearMatch[1]),
      );
      if (dateKey) return { dateKey, matchedValue: candidate };
    }
  }

  return null;
}

export function classifyDriveFolderRole(params: {
  sourceProfile: DriveSourceProfile;
  name: string;
  path: string[];
  content?: string;
}): DriveFolderRole {
  if (params.sourceProfile === "academic") return "academic";

  const normalized = normalizeAcademicText(
    `${params.path.join(" ")} ${params.name} ${(params.content ?? "").slice(
      0,
      8_000,
    )}`,
  );
  if (
    /\b(relatorio|relato de aula|registro realizado|devolutiva|avaliacao da aula)\b/.test(
      normalized,
    )
  ) {
    return "report";
  }
  if (
    /\b(acoes da turma|acoes\b.*\bprimeiros saques|orientacao institucional|diretrizes institucionais)\b/.test(
      normalized,
    )
  ) {
    return "institutional_actions";
  }
  if (
    /\b(plano de aula|roteiro de aula|planejamento da aula)\b/.test(normalized)
  ) {
    return "lesson_plan";
  }
  if (
    /\b(planejamento mensal|plano mensal)\b/.test(normalized) ||
    resolveDriveMonth([...params.path, params.name])
  ) {
    return "monthly_plan";
  }
  return params.sourceProfile;
}

export function parseConfiguredDriveSourceProfiles(
  value: string | null | undefined,
): AllowedDriveSourceProfile[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const profiles: AllowedDriveSourceProfile[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const folderId = String(record.folderId ?? "").trim();
    if (
      !isDriveFolderId(folderId) ||
      !isDriveSourceProfile(record.sourceProfile)
    ) {
      continue;
    }
    const academicScope =
      record.sourceProfile === "academic"
        ? isDriveAcademicScope(record.academicScope)
          ? record.academicScope
          : "user"
        : null;
    profiles.push({
      folderId,
      sourceProfile: record.sourceProfile,
      academicScope,
    });
  }
  return profiles;
}

export function resolveAllowedDriveSource(params: {
  folderId: string;
  requestedSourceProfile?: unknown;
  requestedAcademicScope?: unknown;
  defaultAcademicFolderId: string;
  configuredAcademicFolderIds?: string[];
  configuredProfiles?: AllowedDriveSourceProfile[];
}): AllowedDriveSourceProfile | null {
  const configured = new Map<string, AllowedDriveSourceProfile>();
  for (const profile of params.configuredProfiles ?? []) {
    configured.set(profile.folderId, profile);
  }
  for (const folderId of params.configuredAcademicFolderIds ?? []) {
    if (!isDriveFolderId(folderId)) continue;
    configured.set(folderId, {
      folderId,
      sourceProfile: "academic",
      academicScope: "user",
    });
  }
  configured.set(params.defaultAcademicFolderId, {
    folderId: params.defaultAcademicFolderId,
    sourceProfile: "academic",
    academicScope: "user",
  });

  const allowed = configured.get(params.folderId);
  if (!allowed) return null;
  if (
    params.requestedSourceProfile &&
    params.requestedSourceProfile !== allowed.sourceProfile
  ) {
    return null;
  }
  if (
    allowed.sourceProfile === "academic" &&
    params.requestedAcademicScope &&
    params.requestedAcademicScope !== allowed.academicScope
  ) {
    return null;
  }
  return allowed;
}

export function resolveExplicitClassBinding(params: {
  policy: DriveSourceProfilePolicy;
  classId?: unknown;
  classBindingConfirmed?: unknown;
}) {
  const classId = String(params.classId ?? "").trim();
  const confirmation = params.classBindingConfirmed === true;

  if (!classId && confirmation) {
    throw new Error("A confirmação de turma exige classId.");
  }
  if (!classId) {
    return {
      classId: null,
      status: "unresolved" as const,
    };
  }
  if (!params.policy.classBindingAllowed) {
    throw new Error(
      "Fontes acadêmicas não podem ser vinculadas diretamente a turmas.",
    );
  }
  if (!confirmation) {
    throw new Error("O vínculo com a turma exige confirmação explícita.");
  }
  return {
    classId,
    status: "confirmed" as const,
  };
}
