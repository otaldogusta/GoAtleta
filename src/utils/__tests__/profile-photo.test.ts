import { normalizeProfilePhotoForUpload } from "../profile-photo";

jest.mock("expo-modules-core", () => ({ NativeModulesProxy: {} }));
jest.mock("react-native", () => ({ Platform: { OS: "web" } }));

it("draws the decoded photo at its original proportions before encoding a JPEG", async () => {
  class TestImage {
    naturalWidth = 2400;
    naturalHeight = 3000;
    onload?: () => void;

    set src(_uri: string) {
      this.onload?.();
    }
  }

  const context = { drawImage: jest.fn(), fillRect: jest.fn() };
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => context),
    toBlob: jest.fn((callback: (photo: Blob) => void) => {
      expect(context.drawImage).toHaveBeenCalledWith(expect.any(TestImage), 0, 0, 410, 512);
      callback({ size: 1000, type: "image/jpeg" } as Blob);
    }),
  };
  const globals = {
    window: { Image: TestImage },
    document: { createElement: jest.fn(() => canvas) },
    URL: { createObjectURL: jest.fn(() => "blob:normalized-photo") },
  };
  const original = Object.fromEntries(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }

  try {
    await expect(normalizeProfilePhotoForUpload("blob:selected-photo")).resolves.toEqual({
      uri: "blob:normalized-photo",
      contentType: "image/jpeg",
      normalized: true,
    });
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.78);
  } finally {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
