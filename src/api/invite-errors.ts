export type InviteErrorCode =
  | "INVITE_INVALID"
  | "INVITE_EXPIRED"
  | "INVITE_ALREADY_USED"
  | "INVITE_REVOKED"
  | "INVITE_LIMIT_REACHED"
  | "STUDENT_ALREADY_LINKED"
  | "STUDENT_NOT_FOUND"
  | "TRAINER_NOT_FOUND"
  | "ORG_NOT_FOUND"
  | "ORG_FORBIDDEN"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "MISSING_AUTH_TOKEN"
  | "INVALID_REQUEST"
  | "SERVER_ERROR";

type InviteErrorPayload = {
  error?: string;
  message?: string;
  code?: InviteErrorCode | string;
};

const mapMessageToCode = (message: string): InviteErrorCode => {
  const lower = message.toLowerCase();
  if (lower.includes("missing auth token")) return "MISSING_AUTH_TOKEN";
  if (lower.includes("unauthorized") || lower.includes("invalid jwt")) return "UNAUTHORIZED";
  if (lower.includes("forbidden") || lower.includes("permission")) return "FORBIDDEN";
  if (lower.includes("expired")) return "INVITE_EXPIRED";
  if (lower.includes("already used") || lower.includes("ja utilizado") || lower.includes("já utilizado")) {
    return "INVITE_ALREADY_USED";
  }
  if (lower.includes("revoked")) return "INVITE_REVOKED";
  if (lower.includes("limit reached")) return "INVITE_LIMIT_REACHED";
  if (lower.includes("already linked") || lower.includes("ja esta vinculado") || lower.includes("já está vinculado")) {
    return "STUDENT_ALREADY_LINKED";
  }
  if (lower.includes("student not found")) return "STUDENT_NOT_FOUND";
  if (lower.includes("invite") && lower.includes("invalid")) return "INVITE_INVALID";
  if (lower.includes("invalid")) return "INVALID_REQUEST";
  return "SERVER_ERROR";
};

export class InviteApiError extends Error {
  code: InviteErrorCode;
  status?: number;

  constructor(message: string, code: InviteErrorCode, status?: number) {
    super(message);
    this.name = "InviteApiError";
    this.code = code;
    this.status = status;
  }
}

const parsePayload = (text: string): InviteErrorPayload => {
  try {
    return JSON.parse(text) as InviteErrorPayload;
  } catch {
    return {};
  }
};

export const parseInviteApiResponse = async <T>(
  res: Response,
  fallbackMessage: string
): Promise<T> => {
  const text = await res.text();
  const payload = text ? parsePayload(text) : {};
  if (!res.ok) {
    const message = payload.error || payload.message || text || fallbackMessage;
    const code =
      typeof payload.code === "string"
        ? (payload.code as InviteErrorCode)
        : mapMessageToCode(message);
    throw new InviteApiError(message, code, res.status);
  }
  return (payload as T) ?? ({} as T);
};

export const getInviteErrorCode = (error: unknown): InviteErrorCode => {
  if (error instanceof InviteApiError) {
    return error.code;
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return mapMessageToCode(message);
};
