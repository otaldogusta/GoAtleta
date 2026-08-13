import { verifySignupEmailCode } from "../email-verification";

describe("verifySignupEmailCode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("sends only the email and OTP to the trusted verification function", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          user: { id: "user-id", email: "qa@example.com" },
        }),
    }) as jest.Mock;

    await expect(
      verifySignupEmailCode("qa@example.com", "123456")
    ).resolves.toMatchObject({ access_token: "access-token" });

    const [url, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/functions/v1/verify-signup-email-code");
    expect(request.headers).not.toHaveProperty("Authorization");
    expect(JSON.parse(String(request.body))).toEqual({
      email: "qa@example.com",
      code: "123456",
    });
  });

  test("preserves the server error without accepting an empty success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          code: "OTP_INVALID",
          error: "Invalid or expired verification code",
        }),
    }) as jest.Mock;

    await expect(
      verifySignupEmailCode("qa@example.com", "000000")
    ).rejects.toThrow("Invalid or expired verification code");
  });
});
