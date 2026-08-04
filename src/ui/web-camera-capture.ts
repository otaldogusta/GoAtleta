import type { CameraCapturedPicture } from "expo-camera";

export type WebCameraCaptureResult = {
  uri: string;
  mimeType: string;
};

export function normalizeWebCameraPicture(
  picture: Pick<CameraCapturedPicture, "base64" | "format" | "uri">,
): WebCameraCaptureResult {
  const mimeType = picture.format === "png" ? "image/png" : "image/jpeg";
  const uri = picture.uri.startsWith("data:")
    ? picture.uri
    : `data:${mimeType};base64,${picture.base64 ?? picture.uri}`;

  return { uri, mimeType };
}
