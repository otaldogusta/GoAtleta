import {
  getFriendlyErrorMessage,
  isAuthSessionError,
  isExpectedSessionConnectivityError,
  isNetworkConnectionError,
  isNotFoundError,
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

  it("classifies missing Supabase RPCs as expected provider availability errors", () => {
    const error = new Error("Failed to fetch organizations: Not found");

    expect(isNotFoundError(error)).toBe(true);
    expect(isExpectedSessionConnectivityError(error)).toBe(true);
  });

  it("keeps permission errors out of expected session/connectivity errors", () => {
    const error = new Error('{"code":"42501","message":"row-level security policy"}');

    expect(isExpectedSessionConnectivityError(error)).toBe(false);
    expect(getFriendlyErrorMessage(error)).toBe("Você não tem permissão para essa ação.");
  });
});
