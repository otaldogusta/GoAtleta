import type { CameraCapturedPicture, CameraType } from "expo-camera";

export type WebCameraCaptureResult = {
  uri: string;
  mimeType: string;
};

export type WebCameraZoomRange = {
  min: number;
  max: number;
  step?: number;
};

export type WebCameraZoomOption = {
  label: string;
  normalized: number;
  value: number;
};

const STANDARD_CAMERA_ZOOM_LEVELS = [1, 2, 3] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snapCameraZoom(value: number, range: WebCameraZoomRange): number {
  const clamped = clamp(value, range.min, range.max);
  const step = range.step && range.step > 0 ? range.step : 0.1;
  const snapped = range.min + Math.round((clamped - range.min) / step) * step;

  return Number(clamp(snapped, range.min, range.max).toFixed(4));
}

export function formatCameraZoomLabel(value: number): string {
  const rounded = Number(value.toFixed(1));
  return `${String(rounded).replace(".", ",")}x`;
}

export function normalizeCameraZoom(
  value: number,
  range: WebCameraZoomRange,
): number {
  if (range.max <= range.min) return 0;

  return clamp((value - range.min) / (range.max - range.min), 0, 1);
}

export function getDefaultCameraZoom(range: WebCameraZoomRange): number {
  return snapCameraZoom(1, range);
}

export function getWebCameraZoomOptions(
  range: WebCameraZoomRange,
): WebCameraZoomOption[] {
  if (
    !Number.isFinite(range.min) ||
    !Number.isFinite(range.max) ||
    range.min <= 0 ||
    range.max < range.min
  ) {
    return [];
  }

  const candidates = [
    ...(range.min < 0.95 ? [range.min] : []),
    ...STANDARD_CAMERA_ZOOM_LEVELS,
  ];
  const values = candidates
    .filter((value) => value >= range.min - 0.001 && value <= range.max + 0.001)
    .map((value) => snapCameraZoom(value, range))
    .filter((value, index, all) =>
      all.findIndex((candidate) => Math.abs(candidate - value) < 0.01) === index
    );

  return values.map((value) => ({
    label: formatCameraZoomLabel(value),
    normalized: normalizeCameraZoom(value, range),
    value,
  }));
}

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
