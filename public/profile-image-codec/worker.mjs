import createEncoder from "./jxl_enc.mjs";

self.onmessage = async ({ data: photo }) => {
  let bitmap;
  try {
    bitmap = await createImageBitmap(photo);
    const { width, height } = bitmap;
    if (width < 1 || height < 1 || width > 512 || height > 512) {
      self.postMessage(null);
      return;
    }
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) {
      self.postMessage(null);
      return;
    }
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, width, height);
    const encoder = await createEncoder();
    const result = encoder.encode(pixels.data, width, height, {
      effort: 4,
      quality: 85,
      progressive: false,
      epf: -1,
      lossyPalette: false,
      decodingSpeedTier: 0,
      photonNoiseIso: 0,
      lossyModular: false,
    });
    const bytes = result?.slice().buffer;
    if (!bytes || bytes.byteLength >= photo.size) {
      self.postMessage(null);
      return;
    }
    self.postMessage(bytes, [bytes]);
  } catch {
    self.postMessage(null);
  } finally {
    bitmap?.close();
  }
};
