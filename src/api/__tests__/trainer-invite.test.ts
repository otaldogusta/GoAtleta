import { createTrainerInvite, revokeTrainerInvite } from "../trainer-invite";
import { getValidAccessToken } from "../../auth/session";

jest.mock("../../auth/session", () => ({
  getValidAccessToken: jest.fn(),
  forceRefreshAccessToken: jest.fn(),
}));

describe("createTrainerInvite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getValidAccessToken as jest.Mock).mockResolvedValue("access-token");
    const responsePayload = {
      code: "ABCD-EFGH",
      signup_link: "https://goatleta.com/signup?inviteCode=ABCD-EFGH",
      email_sent: true,
      invite: {},
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(responsePayload),
    }) as jest.Mock;
  });

  test("sends recipient, role and selected permissions through the email channel", async () => {
    await createTrainerInvite({
      organizationId: "11111111-1111-1111-1111-111111111111",
      role: "intern",
      invitedTo: "qa@example.com",
      permissionKeys: ["classes", "calendar"],
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(request.body))).toEqual({
      organizationId: "11111111-1111-1111-1111-111111111111",
      role: "intern",
      invitedTo: "qa@example.com",
      invitedVia: "email",
      permissionKeys: ["classes", "calendar"],
      maxUses: 1,
    });
  });

  test("uses link channel when no recipient was provided", async () => {
    await createTrainerInvite({
      organizationId: "11111111-1111-1111-1111-111111111111",
      role: "professor",
      permissionKeys: [],
    });

    const [, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(request.body))).toMatchObject({
      invitedVia: "link",
      permissionKeys: [],
    });
  });

  test("keeps selected permissions without requiring a recipient for a manual link", async () => {
    await createTrainerInvite({
      organizationId: "11111111-1111-1111-1111-111111111111",
      role: "professor",
      invitedVia: "link",
      permissionKeys: ["classes"],
    });

    const [, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({
      invitedVia: "link",
      permissionKeys: ["classes"],
    });
    expect(body).not.toHaveProperty("invitedTo");
  });

  test("revokes only the selected invite inside its organization", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok" }),
    }) as jest.Mock;

    await revokeTrainerInvite(
      "22222222-2222-2222-2222-222222222222",
      "11111111-1111-1111-1111-111111111111"
    );

    const [url, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/functions/v1/revoke-trainer-invite");
    expect(JSON.parse(String(request.body))).toEqual({
      inviteId: "22222222-2222-2222-2222-222222222222",
      organizationId: "11111111-1111-1111-1111-111111111111",
    });
  });
});
