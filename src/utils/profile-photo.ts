import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

export const PROFILE_PHOTO_SIZE = 512;
const PROFILE_PHOTO_COMPRESS = 0.78;

export async function normalizeProfilePhotoForUpload(uri: string) {
  const normalizedUri = (uri ?? "").trim();
  if (!normalizedUri) {
    throw new Error("Missing profile photo uri");
  }

  try {
    const result = await manipulateAsync(
      normalizedUri,
      [{ resize: { width: PROFILE_PHOTO_SIZE, height: PROFILE_PHOTO_SIZE } }],
      {
        compress: PROFILE_PHOTO_COMPRESS,
        format: SaveFormat.JPEG,
        base64: false,
      }
    );

    return {
      uri: result.uri,
      contentType: "image/jpeg" as const,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error ?? "");
    throw new Error(`Failed to normalize profile photo: ${detail}`);
  }
}
