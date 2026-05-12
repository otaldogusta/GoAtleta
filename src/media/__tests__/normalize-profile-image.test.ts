import * as ImageManipulator from "expo-image-manipulator";

import {
  normalizeProfileImage,
  PROFILE_IMAGE_COMPRESS,
  PROFILE_IMAGE_SIZE,
} from "../normalize-profile-image";

jest.mock("expo-image-manipulator", () => ({
  SaveFormat: {
    JPEG: "jpeg",
  },
  manipulateAsync: jest.fn(async () => ({
    uri: "file://normalized-profile.jpg",
    width: 512,
    height: 512,
  })),
}));

const manipulateAsyncMock = ImageManipulator.manipulateAsync as jest.MockedFunction<
  typeof ImageManipulator.manipulateAsync
>;

describe("normalizeProfileImage", () => {
  beforeEach(() => {
    manipulateAsyncMock.mockClear();
  });

  it("normalizes profile images as JPEG", async () => {
    const result = await normalizeProfileImage({
      uri: "file://input.heic",
      fileName: "foto.heic",
      mimeType: "image/heic",
    });

    expect(result.uri).toBe("file://normalized-profile.jpg");
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.fileName).toBe("foto.jpg");
    expect(result.width).toBe(PROFILE_IMAGE_SIZE);
    expect(result.height).toBe(PROFILE_IMAGE_SIZE);
  });

  it("uses a safe fallback file name", async () => {
    const result = await normalizeProfileImage({
      uri: "file://input",
      fileName: null,
      mimeType: null,
    });

    expect(result.fileName).toBe("profile-photo.jpg");
  });

  it("calls image manipulation with 512 square JPEG and compress 0.82", async () => {
    await normalizeProfileImage({
      uri: "file://input.png",
      fileName: "avatar.png",
      mimeType: "image/png",
    });

    expect(manipulateAsyncMock).toHaveBeenCalledWith(
      "file://input.png",
      [{ resize: { width: PROFILE_IMAGE_SIZE, height: PROFILE_IMAGE_SIZE } }],
      {
        compress: PROFILE_IMAGE_COMPRESS,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
  });

  it("throws when the image cannot be prepared", async () => {
    manipulateAsyncMock.mockRejectedValueOnce(new Error("invalid image"));

    await expect(
      normalizeProfileImage({
        uri: "file://broken.heif",
      })
    ).rejects.toThrow("invalid image");
  });
});
