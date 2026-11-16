import { normalizeProfilePhotoForUpload } from "../../utils/profile-photo";
import { getProfilePhotoStorageErrorMessage, uploadMyProfilePhoto } from "../profile-photo-storage";

jest.mock("../../auth/session", () => ({
  getValidAccessToken: jest.fn(),
}));

jest.mock("../config", () => ({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
}));

jest.mock("../../utils/profile-photo", () => ({
  normalizeProfilePhotoForUpload: jest.fn(),
}));

describe("profile photo storage errors", () => {
  it("does not expose the raw Storage response for denied uploads", () => {
    const message = getProfilePhotoStorageErrorMessage(403);

    expect(message).toBe(
      "Não foi possível alterar esta foto. Atualize a página e tente novamente."
    );
    expect(message).not.toContain("row-level security");
  });

  it("asks the user to sign in again when the token is no longer valid", () => {
    expect(getProfilePhotoStorageErrorMessage(401)).toBe(
      "Sua sessão expirou. Entre novamente."
    );
  });

  it("uses an action-specific message when removing a photo fails", () => {
    expect(getProfilePhotoStorageErrorMessage(500, "remove")).toBe(
      "Não foi possível remover a foto. Tente novamente."
    );
  });
});

it("rejects a photo that is still above the bucket limit before contacting Storage", async () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    blob: async () => ({ size: 2 * 1024 * 1024 + 1 }),
  });
  global.fetch = fetchMock;
  jest.mocked(normalizeProfilePhotoForUpload).mockResolvedValueOnce({
    uri: "file:///selected-image.jpg",
    contentType: null,
    normalized: false,
  });

  try {
    await expect(uploadMyProfilePhoto({ userId: "my-user", uri: "file:///selected-image.jpg" }))
      .rejects.toThrow("A foto excede o limite de 2 MB. Escolha uma imagem menor.");
    expect(fetchMock.mock.calls).toEqual([["file:///selected-image.jpg"]]);
  } finally {
    global.fetch = originalFetch;
  }
});
