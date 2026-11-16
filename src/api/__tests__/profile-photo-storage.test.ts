import { Blob as NodeBlob } from "node:buffer";
import { getValidAccessToken } from "../../auth/session";
import { encodeProfileJxl } from "../../utils/profile-jxl";
import { normalizeProfilePhotoForUpload } from "../../utils/profile-photo";
import { getProfilePhotoStorageErrorMessage, removeMyProfilePhotoObject, uploadMyProfilePhoto } from "../profile-photo-storage";

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

jest.mock("../../utils/profile-jxl", () => ({
  encodeProfileJxl: jest.fn(),
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

describe("optional JPEG XL profile photos", () => {
  const source = "file:///selected-image.jpg";
  const object = "https://project.supabase.co/storage/v1/object/profile-photos/my-user/avatar";
  const jpeg = new NodeBlob([new Uint8Array(40)], { type: "image/jpeg" });
  const jxl = new NodeBlob([new Uint8Array([0xff, 0x0a, 1])], { type: "image/jxl" }) as unknown as Blob;
  const input = { userId: "my-user", uri: source };
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    jest.mocked(getValidAccessToken).mockResolvedValue("token");
    jest.mocked(normalizeProfilePhotoForUpload).mockResolvedValue({
      uri: source,
      contentType: "image/jpeg",
      normalized: true,
    });
    jest.mocked(encodeProfileJxl).mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the canonical JPEG URL with a JXL marker only after both writes succeed", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, blob: async () => jpeg })
      .mockResolvedValue({ ok: true });
    jest.mocked(encodeProfileJxl).mockResolvedValue(jxl);

    const result = new URL(await uploadMyProfilePhoto(input));
    expect(result.pathname).toBe("/storage/v1/object/public/profile-photos/my-user/avatar");
    expect(result.searchParams.get("jxl")).toBe("1");
    expect(fetchMock).toHaveBeenNthCalledWith(2, object, expect.objectContaining({
      method: "POST", headers: expect.objectContaining({ "Content-Type": "image/jpeg" }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, `${object}.jxl`, expect.objectContaining({
      method: "POST", headers: expect.objectContaining({ "Content-Type": "image/jxl" }),
    }));
  });

  it("clears the previous variant when Storage rejects the new variant", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, blob: async () => jpeg })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, status: 400 })
      .mockResolvedValueOnce({ ok: true });
    jest.mocked(encodeProfileJxl).mockResolvedValue(jxl);

    expect(new URL(await uploadMyProfilePhoto(input)).searchParams.has("jxl")).toBe(false);
    expect(fetchMock).toHaveBeenNthCalledWith(4, `${object}.jxl`, expect.objectContaining({ method: "DELETE" }));
  });

  it.each([
    new Uint8Array([0xff, 0xd8, 1]),
    Uint8Array.from({ length: 41 }, (_, index) => index === 0 ? 0xff : index === 1 ? 0x0a : 0),
  ])("keeps the JPEG when the encoder returns a mislabeled or larger file", async (bytes) => {
    fetchMock.mockResolvedValueOnce({ ok: true, blob: async () => jpeg }).mockResolvedValue({ ok: true });
    jest.mocked(encodeProfileJxl).mockResolvedValue(
      new NodeBlob([Uint8Array.from(bytes)], { type: "image/jxl" }) as unknown as Blob
    );

    expect(new URL(await uploadMyProfilePhoto(input)).searchParams.has("jxl")).toBe(false);
    expect(fetchMock).toHaveBeenNthCalledWith(3, `${object}.jxl`, expect.objectContaining({ method: "DELETE" }));
  });

  it("leaves the JPEG available for retry when deleting the variant fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(removeMyProfilePhotoObject(input.userId)).rejects.toThrow("Não foi possível remover a foto.");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce({ ok: true });
    await removeMyProfilePhotoObject(input.userId);
    expect(fetchMock).toHaveBeenNthCalledWith(3, object, expect.objectContaining({ method: "DELETE" }));
  });

  it("queues removal until an in-flight variant write settles", async () => {
    let finishVariant: ((value: { ok: boolean }) => void) | undefined;
    let startVariant: (() => void) | undefined;
    const variantStarted = new Promise<void>((resolve) => { startVariant = resolve; });
    fetchMock.mockResolvedValueOnce({ ok: true, blob: async () => jpeg })
      .mockResolvedValueOnce({ ok: true })
      .mockImplementationOnce(() => new Promise(resolve => {
        finishVariant = resolve;
        startVariant?.();
      }))
      .mockResolvedValue({ ok: true });
    jest.mocked(encodeProfileJxl).mockResolvedValue(jxl);

    const upload = uploadMyProfilePhoto(input);
    await variantStarted;
    const remove = removeMyProfilePhotoObject(input.userId);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    finishVariant?.({ ok: true });
    await Promise.all([upload, remove]);

    expect(fetchMock).toHaveBeenNthCalledWith(4, `${object}.jxl`, expect.objectContaining({ method: "DELETE" }));
    expect(fetchMock).toHaveBeenNthCalledWith(5, object, expect.objectContaining({ method: "DELETE" }));
  });
});
