type SupabaseErrorPayload = {
  code: string | number;
  message: string;
  details: string | null;
  hint: string | null;
};

export const extractErrorText = (error: unknown): string => {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const maybe = error as SupabaseErrorPayload & { error: unknown };
    if (maybe.message) return maybe.message;
    if (typeof maybe.error === "string") return maybe.error;
    if (maybe.error instanceof Error) return maybe.error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const parseJsonMessage = (text: string) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as SupabaseErrorPayload;
  } catch {
    return null;
  }
};

const getComparableErrorText = (error: unknown) => {
  const raw = extractErrorText(error).trim();
  const parsed = parseJsonMessage(raw);
  return `${parsed?.message ?? raw} ${parsed?.code ?? ""}`.toLowerCase();
};

export const isAuthSessionError = (error: unknown) => {
  const lower = getComparableErrorText(error);
  return (
    lower.includes("invalid jwt") ||
    lower.includes("jwt expired") ||
    lower.includes("missing auth token") ||
    lower.includes("invalid login credentials") ||
    lower.includes("unauthorized") ||
    lower.includes("sessao expirada") ||
    lower.includes("sessão expirada") ||
    lower.includes("sessao invalida") ||
    lower.includes("sessão inválida") ||
    lower.includes("faca login novamente") ||
    lower.includes("faça login novamente")
  );
};

export const isNetworkConnectionError = (error: unknown) => {
  const lower = getComparableErrorText(error);
  return (
    lower.includes("failed to fetch") ||
    lower.includes("network request failed") ||
    lower.includes("fetch failed") ||
    lower.includes("networkerror") ||
    lower.includes("timed out") ||
    lower.includes("timeout")
  );
};

export const isNotFoundError = (error: unknown) => {
  const lower = getComparableErrorText(error);
  return lower.includes("not found") || lower.includes("404") || lower.includes("pgrst202");
};

export const isExpectedSessionConnectivityError = (error: unknown) =>
  isAuthSessionError(error) || isNetworkConnectionError(error) || isNotFoundError(error);

export const getFriendlyErrorMessage = (
  error: unknown,
  fallback = "Não foi possível concluir a ação."
) => {
  const raw = extractErrorText(error).trim();
  if (!raw) return fallback;

  const parsed = parseJsonMessage(raw);
  const message = parsed?.message || raw;
  const lower = message.toLowerCase();

  if (isAuthSessionError(error)) {
    return "Sessão expirada. Entre novamente.";
  }

  if (
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("not authorized") ||
    parsed?.code === "42501"
  ) {
    return "Você não tem permissão para essa ação.";
  }

  if (isNetworkConnectionError(error)) {
    return "Falha de conexão. Verifique sua internet.";
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Tempo esgotado. Tente novamente.";
  }

  if (lower.includes("duplicate key") || lower.includes("unique constraint")) {
    return "Já existe um registro com esse dado.";
  }

  if (isNotFoundError(error)) {
    return "Não encontrado.";
  }

  if (lower.includes("pgrst204")) {
    return "Atualize o app para continuar.";
  }

  return message || fallback;
};
