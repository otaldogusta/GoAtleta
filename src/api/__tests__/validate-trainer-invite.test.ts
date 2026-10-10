import { validateTrainerInvite } from "../trainer-invite";
jest.mock("../../auth/session", () => ({ getValidAccessToken: jest.fn(), forceRefreshAccessToken: jest.fn() }));

describe("public invitation validation", () => {
  beforeEach(() => { global.fetch = jest.fn(); });
  it("normalizes the code without sending an authenticated session", async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "valid" }) });
    await validateTrainerInvite(" abcd-efgh ");
    const [url, request] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/functions/v1/validate-trainer-invite");
    expect(JSON.parse(request.body)).toEqual({ code: "ABCD-EFGH" });
    expect(request.headers.Authorization).toBeUndefined();
  });
  it("distinguishes unavailable service from an invalid invitation", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ code: "INVITE_INVALID" }) });
    await expect(validateTrainerInvite("ABCD-EFGH")).rejects.toThrow("Convite inválido");
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    await expect(validateTrainerInvite("ABCD-EFGH")).rejects.toThrow("Não foi possível verificar");
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: "ok" }) });
    await expect(validateTrainerInvite("ABCD-EFGH")).rejects.toThrow("Não foi possível verificar");
  });
  it("rejects malformed codes without a request", async () => {
    await expect(validateTrainerInvite("<bad>")).rejects.toThrow("Código inválido");
    expect(fetch).not.toHaveBeenCalled();
  });
});
