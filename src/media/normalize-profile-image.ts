import * as ImageManipulator from "expo-image-manipulator";

export type NormalizeProfileImageInput = {
  uri: string;
  width?: number;
  height?: number;
  fileName?: string | null;
  mimeType?: string | null;
};

export type NormalizeProfileImageResult = {
  uri: string;
  width: number;
  height: number;
  fileName: string;
  mimeType: "image/jpeg";
};

export const PROFILE_IMAGE_SIZE = 512;
export const PROFILE_IMAGE_COMPRESS = 0.82;
export const PROFILE_IMAGE_MIME_TYPE = "image/jpeg";

const toJpgFileName = (fileName?: string | null) => {
  const trimmed = fileName?.trim();
  if (!trimmed) return "profile-photo.jpg";

  const withoutExtension = trimmed.replace(/\.[^.\\/]+$/, "");
  const safeBaseName = withoutExtension.trim() || "profile-photo";
  return `${safeBaseName}.jpg`;
};

export async function normalizeProfileImage(
  input: NormalizeProfileImageInput
): Promise<NormalizeProfileImageResult> {
  const uri = input.uri?.trim();
  if (!uri) {
    throw new Error("Imagem sem endereço para normalização.");
  }

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: PROFILE_IMAGE_SIZE, height: PROFILE_IMAGE_SIZE } }],
    {
      compress: PROFILE_IMAGE_COMPRESS,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  return {
    uri: result.uri,
    width: PROFILE_IMAGE_SIZE,
    height: PROFILE_IMAGE_SIZE,
    fileName: toJpgFileName(input.fileName),
    mimeType: PROFILE_IMAGE_MIME_TYPE,
  };
}
