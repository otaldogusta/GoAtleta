import type { CameraCapturedPicture, CameraType } from "expo-camera";

export type WebCameraCaptureResult = {
  uri: string;
  mimeType: string;
};

export function getOppositeCameraFacing(facing: CameraType): CameraType {
  return facing === "front" ? "back" : "front";
}

export function normalizeWebCameraPicture(
  picture: Pick<CameraCapturedPicture, "base64" | "format" | "uri">,
): WebCameraCaptureResult {
  const mimeType = picture.format === "png" ? "image/png" : "image/jpeg";
  const uri = picture.uri.startsWith("data:") || !picture.base64
    ? picture.uri
    : `data:${mimeType};base64,${picture.base64}`;

  return { uri, mimeType };
}
