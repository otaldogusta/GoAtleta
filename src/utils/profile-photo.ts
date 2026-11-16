import { NativeModulesProxy } from "expo-modules-core";
import { Platform } from "react-native";

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

const normalizeWebProfilePhoto = async (uri: string): Promise<NormalizedProfilePhoto> => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const source = new window.Image();
    source.crossOrigin = "anonymous";
    source.onload = () => resolve(source);
    source.onerror = () => reject(new Error("Failed to decode profile photo"));
    source.src = uri;
  });
  const { naturalWidth, naturalHeight } = image;
  if (!naturalWidth || !naturalHeight) throw new Error("Invalid profile photo dimensions");

  const scale = Math.min(1, PROFILE_PHOTO_SIZE / Math.max(naturalWidth, naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Failed to create profile photo canvas");

  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const photo = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", PROFILE_PHOTO_COMPRESS);
  });
  if (!photo?.size || photo.type !== "image/jpeg") throw new Error("Failed to encode profile photo");

  return {
    uri: URL.createObjectURL(photo),
    contentType: photo.type,
    normalized: true,
  };
};

const hasNativeImageManipulator = () => {
  try {
    const proxy = NativeModulesProxy as Record<string, unknown> | null | undefined;
    return Boolean(
      proxy?.ExpoImageManipulator ||
        proxy?.NativeImageManipulatorModule ||
        proxy?.ImageManipulator
    );
  } catch {
    return false;
  }
};

export async function normalizeProfilePhotoForUpload(uri: string): Promise<NormalizedProfilePhoto> {
  const normalizedUri = (uri ?? "").trim();
  if (!normalizedUri) {
    throw new Error("Missing profile photo uri");
  }

  if (Platform.OS === "web") {
    try {
      return await normalizeWebProfilePhoto(normalizedUri);
    } catch (error) {
      if (__DEV__) {
        console.warn("[profile-photo] web normalization failed, using original image", toErrorDetail(error));
      }
      return fallbackOriginalPhoto(normalizedUri);
    }
  }

  let manipulateAsync: ((...args: any[]) => Promise<{ uri: string }>) | null = null;
  let saveFormatJpeg: unknown = null;

  if (!hasNativeImageManipulator()) {
    if (__DEV__) {
      console.warn("[profile-photo] native image manipulator module not available, using original image");
    }
    return fallbackOriginalPhoto(normalizedUri);
  }

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
