import { updatePasswordWithAccessToken } from "../auth-password";

describe("updatePasswordWithAccessToken", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("sends the current password only when the user provides it", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    });
    global.fetch = fetchMock as typeof fetch;

    await updatePasswordWithAccessToken("token", "NovaSenha1!", "SenhaAtual1!");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/v1/user"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          password: "NovaSenha1!",
          current_password: "SenhaAtual1!",
        }),
      }),
    );
  });

  it("allows password creation when there is no current password", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    });
    global.fetch = fetchMock as typeof fetch;

    await updatePasswordWithAccessToken("token", "NovaSenha1!");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ password: "NovaSenha1!" }),
      }),
    );
  });
});
