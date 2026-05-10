jest.mock("qrcode/lib/browser", () => ({
  toDataURL: jest.fn(async () => "data:image/png;base64,mock-qr"),
}));

import { generateQrDataUri, isValidQrValue } from "../qr-code";

describe("qr-code", () => {
  const originalDocument = (globalThis as { document?: typeof document }).document;

  beforeEach(() => {
    (globalThis as { document?: { createElement: (tagName: string) => unknown } }).document = {
      createElement: jest.fn((tagName: string) => {
        if (tagName !== "canvas") {
          throw new Error(`Unexpected tag: ${tagName}`);
        }

        return {
          getContext: () => ({
            createImageData: () => ({}),
          }),
          toDataURL: () => "data:image/png;base64,canvas",
        };
      }),
    } as any;
  });

  afterEach(() => {
    if (originalDocument) {
      (globalThis as { document?: typeof document }).document = originalDocument;
      return;
    }

    delete (globalThis as { document?: typeof document }).document;
  });

  it("returns null for empty values", async () => {
    await expect(generateQrDataUri("")).resolves.toBeNull();
    expect(isValidQrValue("")).toBe(false);
  });

  it("returns data uri for valid urls", async () => {
    const result = await generateQrDataUri("https://example.com/demo.mp4");

    expect(isValidQrValue("https://example.com/demo.mp4")).toBe(true);
    expect(result).toMatch(/^data:image\/png;base64,/);
  });
});
