export type WhatsAppEmbeddedSignupResult =
  | { kind: "idle" }
  | { kind: "returned" }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

type SearchParamValue = string | string[] | undefined;

const firstValue = (value: SearchParamValue) =>
  typeof value === "string" ? value.trim() : value?.[0]?.trim() ?? "";

export const parseWhatsAppEmbeddedSignupResult = (params: {
  code?: SearchParamValue;
  error?: SearchParamValue;
  error_code?: SearchParamValue;
  error_reason?: SearchParamValue;
  error_description?: SearchParamValue;
}): WhatsAppEmbeddedSignupResult => {
  if (firstValue(params.code)) return { kind: "returned" };

  const error = firstValue(params.error);
  const errorCode = firstValue(params.error_code);
  const errorReason = firstValue(params.error_reason);
  const errorDescription = firstValue(params.error_description);
  if (!error && !errorCode && !errorReason && !errorDescription) return { kind: "idle" };

  const normalized = `${error} ${errorCode} ${errorReason}`.toLowerCase();
  if (normalized.includes("cancel") || normalized.includes("access_denied")) {
    return { kind: "cancelled" };
  }

  return {
    kind: "error",
    message: "A Meta não concluiu a conexão. Tente novamente quando a verificação empresarial estiver aprovada.",
  };
};

export const hasWhatsAppEmbeddedSignupParams = (params: {
  code?: SearchParamValue;
  error?: SearchParamValue;
  error_code?: SearchParamValue;
  error_reason?: SearchParamValue;
  error_description?: SearchParamValue;
}) => Object.values(params).some((value) => Boolean(firstValue(value)));
