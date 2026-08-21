import {
  PROFILE_SESSION_EXPIRED_MESSAGE,
  runWithFreshAuthToken,
} from "../auth-token-retry";

describe("auth token retry", () => {
  it("uses the currently valid access token", async () => {
    const request = jest.fn().mockResolvedValue("updated");

    await expect(
      runWithFreshAuthToken({
        getValidToken: async () => "valid-token",
        refreshToken: async () => "unused-token",
        request,
      })
    ).resolves.toBe("updated");

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("valid-token");
  });

  it("refreshes once when Supabase rejects an expired JWT", async () => {
    const request = jest
      .fn()
      .mockRejectedValueOnce(
        new Error(
          "invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired"
        )
      )
      .mockResolvedValueOnce("updated");
    const refreshToken = jest.fn().mockResolvedValue("refreshed-token");

    await expect(
      runWithFreshAuthToken({
        getValidToken: async () => "expired-token",
        refreshToken,
        request,
      })
    ).resolves.toBe("updated");

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenNthCalledWith(2, "refreshed-token");
  });

  it("returns an operational message when the session cannot be renewed", async () => {
    await expect(
      runWithFreshAuthToken({
        getValidToken: async () => "expired-token",
        refreshToken: async () => "",
        request: async () => {
          throw new Error("invalid JWT: token is expired");
        },
      })
    ).rejects.toThrow(PROFILE_SESSION_EXPIRED_MESSAGE);
  });

  it("does not retry non-authentication failures", async () => {
    const refreshToken = jest.fn().mockResolvedValue("refreshed-token");

    await expect(
      runWithFreshAuthToken({
        getValidToken: async () => "valid-token",
        refreshToken,
        request: async () => {
          throw new Error("Failed to fetch");
        },
      })
    ).rejects.toThrow("Failed to fetch");

    expect(refreshToken).not.toHaveBeenCalled();
  });
});
