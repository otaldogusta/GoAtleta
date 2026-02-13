export const PROFILE_PHOTO_SIZE = 512;
const PROFILE_PHOTO_COMPRESS = 0.78;

type NormalizedProfilePhoto = {
  uri: string;
  contentType: string | null;
  normalized: boolean;
};

const isNativeModuleUnavailableError = (message: string) => {
  const lower = message.toLowerCase();
  return (
    lower.includes("cannot find native module") ||
    lower.includes("expoimagemanipulator") ||
    lower.includes("imagemanipulator")
  );
};

export async function normalizeProfilePhotoForUpload(uri: string): Promise<NormalizedProfilePhoto> {
  const normalizedUri = (uri ?? "").trim();
  if (!normalizedUri) {
    throw new Error("Missing profile photo uri");
  }

  let manipulateAsync: ((...args: any[]) => Promise<{ uri: string }>) | null = null;
  let saveFormatJpeg: unknown = null;

  try {
    const module = await import("expo-image-manipulator");
    manipulateAsync = module.manipulateAsync;
    saveFormatJpeg = module.SaveFormat.JPEG;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error ?? "");
    if (isNativeModuleUnavailableError(detail)) {
      return {
        uri: normalizedUri,
        contentType: null,
        normalized: false,
      };
    }
    throw new Error(`Failed to load image manipulator: ${detail}`);
  }

  if (!manipulateAsync || !saveFormatJpeg) {
    return {
      uri: normalizedUri,
      contentType: null,
      normalized: false,
    };
  }

  try {
    const result = await manipulateAsync(
      normalizedUri,
      [{ resize: { width: PROFILE_PHOTO_SIZE, height: PROFILE_PHOTO_SIZE } }],
      {
        compress: PROFILE_PHOTO_COMPRESS,
        format: saveFormatJpeg,
        base64: false,
      }
    );

    return {
      uri: result.uri,
      contentType: "image/jpeg",
      normalized: true,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error ?? "");
    if (isNativeModuleUnavailableError(detail)) {
      return {
        uri: normalizedUri,
        contentType: null,
        normalized: false,
      };
    }
    throw new Error(`Failed to normalize profile photo: ${detail}`);
  }
}
