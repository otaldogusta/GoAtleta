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

const toErrorDetail = (error: unknown) => {
  if (error instanceof Error) {
    const cause =
      typeof (error as { cause?: unknown }).cause === "string"
        ? (error as { cause?: string }).cause
        : "";
    const code =
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code?: string }).code
        : "";
    return [error.name, error.message, cause, code].filter(Boolean).join(" | ");
  }

  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error ?? "");
  }
};

const fallbackOriginalPhoto = (uri: string): NormalizedProfilePhoto => ({
  uri,
  contentType: null,
  normalized: false,
});

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
    const detail = toErrorDetail(error);
    if (__DEV__) {
      console.warn("[profile-photo] image manipulator unavailable, using original image", detail);
    }
    return fallbackOriginalPhoto(normalizedUri);
  }

  if (!manipulateAsync || !saveFormatJpeg) {
    return fallbackOriginalPhoto(normalizedUri);
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
    const detail = toErrorDetail(error);
    if (__DEV__) {
      const reason = isNativeModuleUnavailableError(detail)
        ? "native module unavailable"
        : "normalization failed";
      console.warn(`[profile-photo] ${reason}, using original image`, detail);
    }
    return fallbackOriginalPhoto(normalizedUri);
  }
}
