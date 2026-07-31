import AsyncStorage from "@react-native-async-storage/async-storage";

export type SessionReportDraftValues = {
  PSE: number;
  technique: "boa" | "ok" | "ruim" | "nenhum";
  activity: string;
  conclusion: string;
  participantsCount: string;
  photos: string;
};

export type SessionReportDraft = {
  version: 1;
  savedAt: string;
  values: SessionReportDraftValues;
};

type SessionReportDraftScope = {
  userId: string | null | undefined;
  organizationId: string | null | undefined;
  classId: string;
  sessionDate: string;
};

const SESSION_REPORT_DRAFT_PREFIX = "@goatleta/session-report-draft/v1";

const isTechnique = (
  value: unknown
): value is SessionReportDraftValues["technique"] =>
  value === "boa" || value === "ok" || value === "ruim" || value === "nenhum";

const sanitizeSegment = (value: string) => encodeURIComponent(value.trim());

export function buildSessionReportDraftKey({
  userId,
  organizationId,
  classId,
  sessionDate,
}: SessionReportDraftScope): string | null {
  const safeUserId = String(userId ?? "").trim();
  const safeClassId = classId.trim();
  const safeSessionDate = sessionDate.trim();
  if (!safeUserId || !safeClassId || !safeSessionDate) return null;

  return [
    SESSION_REPORT_DRAFT_PREFIX,
    sanitizeSegment(safeUserId),
    sanitizeSegment(String(organizationId ?? "legacy")),
    sanitizeSegment(safeClassId),
    sanitizeSegment(safeSessionDate),
  ].join("/");
}

const parseSessionReportDraft = (raw: string | null): SessionReportDraft | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SessionReportDraft>;
    const values = parsed.values as Partial<SessionReportDraftValues> | undefined;
    if (
      parsed.version !== 1 ||
      typeof parsed.savedAt !== "string" ||
      !values ||
      typeof values.PSE !== "number" ||
      !Number.isFinite(values.PSE) ||
      !isTechnique(values.technique) ||
      typeof values.activity !== "string" ||
      typeof values.conclusion !== "string" ||
      typeof values.participantsCount !== "string" ||
      typeof values.photos !== "string"
    ) {
      return null;
    }

    return {
      version: 1,
      savedAt: parsed.savedAt,
      values: {
        PSE: values.PSE,
        technique: values.technique,
        activity: values.activity,
        conclusion: values.conclusion,
        participantsCount: values.participantsCount,
        photos: values.photos,
      },
    };
  } catch {
    return null;
  }
};

export async function loadSessionReportDraft(
  key: string | null
): Promise<SessionReportDraft | null> {
  if (!key) return null;
  return parseSessionReportDraft(await AsyncStorage.getItem(key));
}

export async function saveSessionReportDraft(
  key: string | null,
  values: SessionReportDraftValues
): Promise<SessionReportDraft | null> {
  if (!key) return null;
  const draft: SessionReportDraft = {
    version: 1,
    savedAt: new Date().toISOString(),
    values,
  };
  await AsyncStorage.setItem(key, JSON.stringify(draft));
  return draft;
}

export async function clearSessionReportDraft(key: string | null): Promise<void> {
  if (!key) return;
  await AsyncStorage.removeItem(key);
}

export const serializeSessionReportDraftValues = (
  values: SessionReportDraftValues
) => JSON.stringify(values);
