import {
  getStudentPhotoAccessUrl,
  getStudentPhotoObjectPath,
} from "../student-photo-storage";

const mockGetValidAccessToken = jest.fn();

jest.mock("../../auth/session", () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}));

jest.mock("../config", () => ({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
}));

describe("student photo storage access", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetValidAccessToken.mockResolvedValue("access-token");
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("extracts the object path from legacy public URLs", () => {
    expect(
      getStudentPhotoObjectPath(
        "https://project.supabase.co/storage/v1/object/public/student-photos/org-1/student-1/avatar?v=123"
      )
    ).toBe("org-1/student-1/avatar");
  });

  it("keeps external photos unchanged", async () => {
    await expect(getStudentPhotoAccessUrl("https://images.example.com/avatar.jpg")).resolves.toBe(
      "https://images.example.com/avatar.jpg"
    );
  });

  it("creates an authorized signed URL for the private student bucket", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        signedURL: "/object/sign/student-photos/org-1/student-1/avatar?token=signed-token",
      }),
    }) as typeof fetch;

    const result = await getStudentPhotoAccessUrl(
      "https://project.supabase.co/storage/v1/object/public/student-photos/org-1/student-1/avatar?v=456"
    );

    expect(result).toBe(
      "https://project.supabase.co/storage/v1/object/sign/student-photos/org-1/student-1/avatar?token=signed-token&v=456"
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "https://project.supabase.co/storage/v1/object/sign/student-photos/org-1/student-1/avatar",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "anon-key",
          Authorization: "Bearer access-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ expiresIn: 3600 }),
      })
    );
  });
});
