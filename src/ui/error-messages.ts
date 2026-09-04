type SupabaseErrorPayload = {
  code?: string | number;
  error_code?: string;
  error?: string;
  message?: string;
  msg?: string;
  details?: string | null;
  hint?: string | null;
};

export const extractErrorText = (error: unknown): string => {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const maybe = error as Record<string, unknown>;
    if (typeof maybe.message === "string" && maybe.message) return maybe.message;
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
  const parsedMessage = parsed?.message || parsed?.msg || parsed?.error || raw;
  const parsedCode = parsed?.code || parsed?.error_code || "";
  return `${parsedMessage} ${parsedCode}`.toLowerCase();
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

export const isRequestCancellationError = (error: unknown) => {
  if (error instanceof Error && error.name === "AbortError") return true;
  const lower = getComparableErrorText(error);
  return (
    lower.includes("fetch request has been canceled") ||
    lower.includes("fetch request has been cancelled") ||
    lower.includes("operation was aborted") ||
    lower.trim() === "aborted"
  );
};

export const isNotFoundError = (error: unknown) => {
  const lower = getComparableErrorText(error);
  if (lower.includes("pgrst202") || lower.includes("pgrst204")) return false;
  return lower.includes("not found") || lower.includes("404");
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
  const message = parsed?.message || parsed?.msg || parsed?.error || raw;
  const lower = message.toLowerCase();
  const comparable = getComparableErrorText(error);

  if (isAuthSessionError(error)) {
    return "Sessão expirada. Entre novamente.";
  }

  if (
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("forbidden") ||
    lower.includes("not_authorized") ||
    lower.includes("not authorized") ||
    parsed?.code === "42501"
  ) {
    return "Você não tem permissão para essa ação.";
  }

  if (isNetworkConnectionError(error)) {
    return "Falha de conexão. Verifique sua internet.";
  }

  if (comparable.includes("same_password") || lower.includes("same password")) {
    return "A nova senha precisa ser diferente da anterior.";
  }

  if (comparable.includes("weak_password") || lower.includes("weak password")) {
    return "A nova senha não atende aos requisitos de segurança.";
  }

  if (
    comparable.includes("current_password")
    || lower.includes("current password")
    || lower.includes("senha atual")
  ) {
    return "A senha atual está incorreta.";
  }

  if (comparable.includes("reauthentication") || comparable.includes("reauthenticate")) {
    return "Por segurança, saia e entre novamente antes de alterar a senha.";
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Tempo esgotado. Tente novamente.";
  }

  if (lower.includes("duplicate key") || lower.includes("unique constraint")) {
    return "Já existe um registro com esse dado.";
  }

  if (comparable.includes("pgrst202")) {
    return "Serviço de atualização indisponível. Recarregue a página e tente novamente.";
  }

  if (comparable.includes("pgrst204")) {
    return "Atualize o app para continuar.";
  }

  if (lower.includes("member not found")) {
    return "Esta pessoa não está mais disponível nesta organização. Atualize a lista e tente novamente.";
  }

  if (lower.includes("cannot disable own org_members permission")) {
    return "Sua própria permissão de Gestão de membros deve permanecer ativa.";
  }

  if (isNotFoundError(error)) {
    return "Não encontrado.";
  }

  return message || fallback;
};
