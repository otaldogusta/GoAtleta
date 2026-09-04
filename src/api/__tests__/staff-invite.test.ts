import { refreshStaffSignupSession, type StaffInviteResult } from "../staff-invite";

const setup = (expiresAt: number): StaffInviteResult => ({
  setup_required: true,
  organization_id: "org-1",
  session: {
    access_token: "expired-access",
    refresh_token: "invite-refresh",
    expires_at: expiresAt,
    user: { id: "recipient-id", email: "recipient@example.com" },
  },
});

describe("staff invite temporary session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps a temporary session that still has enough lifetime", async () => {
    global.fetch = jest.fn() as jest.Mock;
    const current = setup(Math.floor(Date.now() / 1000) + 300);
    await expect(refreshStaffSignupSession(current)).resolves.toBe(current);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("renews an expired temporary session without publishing another account", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: "fresh-access",
      refresh_token: "fresh-refresh",
      expires_in: 3600,
      user: { id: "recipient-id", email: "recipient@example.com" },
    }), { status: 200 })) as jest.Mock;

    const result = await refreshStaffSignupSession(setup(1));
    expect(result.session).toMatchObject({
      access_token: "fresh-access",
      refresh_token: "fresh-refresh",
      user: { id: "recipient-id" },
    });
    const [url, request] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/auth/v1/token?grant_type=refresh_token");
    expect(JSON.parse(String(request.body))).toEqual({ refresh_token: "invite-refresh" });
    expect(request.headers).not.toHaveProperty("Authorization");
  });

  it("rejects a refresh that does not belong to the invited identity", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: "other-access",
      refresh_token: "other-refresh",
      expires_in: 3600,
      user: { id: "other-user", email: "other@example.com" },
    }), { status: 200 })) as jest.Mock;

    await expect(refreshStaffSignupSession(setup(1))).rejects.toThrow("Sua sessão expirou. Reabra o convite.");
  });
});
