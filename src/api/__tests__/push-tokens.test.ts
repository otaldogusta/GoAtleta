/* eslint-disable import/first */
const mockSupabaseRestRequest = jest.fn();

jest.mock("../rest", () => ({
  supabaseRestRequest: (...args: unknown[]) => mockSupabaseRestRequest(...args),
}));

import { upsertMyPushToken } from "../push-tokens";

describe("push tokens api", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("upsertMyPushToken sends merge-duplicates upsert", async () => {
    mockSupabaseRestRequest.mockResolvedValue([]);

    await upsertMyPushToken({
      organizationId: "org_1",
      expoPushToken: "ExponentPushToken[abc]",
      platform: "android",
      deviceId: "device-1",
    });

    expect(mockSupabaseRestRequest).toHaveBeenCalledTimes(1);
    const [path, options] = mockSupabaseRestRequest.mock.calls[0];

    expect(path).toBe("/push_tokens?on_conflict=organization_id,user_id,expo_push_token");
    expect(options.method).toBe("POST");
    expect(options.prefer).toBe("return=minimal");
    expect(options.additionalHeaders).toEqual({ Prefer: "resolution=merge-duplicates" });

    expect(Array.isArray(options.body)).toBe(true);
    expect(options.body[0]).toMatchObject({
      organization_id: "org_1",
      expo_push_token: "ExponentPushToken[abc]",
      platform: "android",
      device_id: "device-1",
    });
    expect(typeof options.body[0].updated_at).toBe("string");
  });

  test("upsertMyPushToken validates required fields", async () => {
    await expect(
      upsertMyPushToken({
        organizationId: "",
        expoPushToken: "",
      })
    ).rejects.toThrow("organizationId e expoPushToken são obrigatórios.");
  });
});

