import { Platform } from "react-native";

const ENCODE_TIMEOUT_MS = 4_000;
const MINIMUM_JPEG_BYTES = 8 * 1024;

export async function encodeProfileJxl(photo: Blob): Promise<Blob | null> {
  if (
    Platform.OS !== "web" ||
    typeof Worker === "undefined" ||
    photo.type !== "image/jpeg" ||
    photo.size < MINIMUM_JPEG_BYTES
  ) return null;

  let worker: Worker | undefined;
  try {
    worker = new Worker("/profile-image-codec/worker.mjs", { type: "module" });
    const encoder = worker;
    return await new Promise<Blob | null>((resolve) => {
      const finish = (result: Blob | null) => {
        clearTimeout(timeout);
        resolve(result);
      };
      const timeout = setTimeout(() => finish(null), ENCODE_TIMEOUT_MS);
      encoder.onmessage = ({ data }) => {
        const valid = data instanceof ArrayBuffer && data.byteLength > 0 && data.byteLength < photo.size;
        finish(valid ? new Blob([data], { type: "image/jxl" }) : null);
      };
      encoder.onerror = () => finish(null);
      encoder.onmessageerror = () => finish(null);
      try {
        encoder.postMessage(photo);
      } catch {
        finish(null);
      }
    });
  } catch {
    return null;
  } finally {
    worker?.terminate();
  }
}
