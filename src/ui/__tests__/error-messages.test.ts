import {
  getFriendlyErrorMessage,
  isAuthSessionError,
  isExpectedSessionConnectivityError,
  isNetworkConnectionError,
  isNotFoundError,
  isRequestCancellationError,
} from "../error-messages";

describe("error-messages", () => {
  it("classifies expired auth tokens as session errors", () => {
    const error = new Error('Supabase GET error: 401 {"message":"Invalid JWT"}');

    expect(isAuthSessionError(error)).toBe(true);
    expect(isExpectedSessionConnectivityError(error)).toBe(true);
    expect(getFriendlyErrorMessage(error)).toBe("Sessão expirada. Entre novamente.");
  });

  it("classifies fetch failures as connection errors", () => {
    const error = new TypeError("Failed to fetch");

    expect(isNetworkConnectionError(error)).toBe(true);
    expect(isExpectedSessionConnectivityError(error)).toBe(true);
    expect(getFriendlyErrorMessage(error)).toBe("Falha de conexão. Verifique sua internet.");
  });

  it("recognizes React Native fetch cancellation errors", () => {
    expect(
      isRequestCancellationError(
        new TypeError("fetch failed: Fetch request has been canceled")
      )
    ).toBe(true);
    expect(isRequestCancellationError(new DOMException("Aborted", "AbortError"))).toBe(true);
  });

  it("classifies missing Supabase RPCs as expected provider availability errors", () => {
    const error = new Error("Failed to fetch organizations: Not found");

    expect(isNotFoundError(error)).toBe(true);
    expect(isExpectedSessionConnectivityError(error)).toBe(true);
  });

  it("explains when an RPC is not yet available instead of reporting a missing record", () => {
    const error = new Error(
      'Supabase POST error: 404 {"code":"PGRST202","message":"Could not find the function public.admin_apply_member_access_change in the schema cache"}'
    );

    expect(isNotFoundError(error)).toBe(false);
    expect(isExpectedSessionConnectivityError(error)).toBe(false);
    expect(getFriendlyErrorMessage(error)).toBe(
      "Serviço de atualização indisponível. Recarregue a página e tente novamente."
    );
  });

  it("explains when the selected organization member no longer exists", () => {
    const error = new Error('{"code":"P0001","message":"member not found"}');

    expect(getFriendlyErrorMessage(error)).toBe(
      "Esta pessoa não está mais disponível nesta organização. Atualize a lista e tente novamente."
    );
  });

  it("keeps permission errors out of expected session/connectivity errors", () => {
    const error = new Error('{"code":"42501","message":"row-level security policy"}');

    expect(isExpectedSessionConnectivityError(error)).toBe(false);
    expect(getFriendlyErrorMessage(error)).toBe("Você não tem permissão para essa ação.");
  });

  it("translates the protected own member management permission error", () => {
    const error = new Error("Cannot disable own org_members permission");

    expect(getFriendlyErrorMessage(error)).toBe(
      "Sua própria permissão de Gestão de membros deve permanecer ativa."
    );
  });

  it("translates Supabase password errors from GoTrue payloads", () => {
    expect(
      getFriendlyErrorMessage(
        new Error('{"error_code":"same_password","msg":"New password should be different"}'),
      ),
    ).toBe("A nova senha precisa ser diferente da anterior.");
    expect(
      getFriendlyErrorMessage(
        new Error('{"error_code":"current_password_invalid","msg":"Current password is incorrect"}'),
      ),
    ).toBe("A senha atual está incorreta.");
    expect(
      getFriendlyErrorMessage(
        new Error('{"error_code":"reauthentication_needed","msg":"Reauthentication needed"}'),
      ),
    ).toBe("Por segurança, saia e entre novamente antes de alterar a senha.");
  });
});
