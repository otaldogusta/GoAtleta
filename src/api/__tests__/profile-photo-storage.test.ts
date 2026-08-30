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

import { getProfilePhotoStorageErrorMessage } from "../profile-photo-storage";

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
