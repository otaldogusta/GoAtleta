import { normalizeWebCameraPicture } from "../web-camera-capture";

describe("normalizeWebCameraPicture", () => {
  it("keeps the data URI returned by the web camera", () => {
    expect(
      normalizeWebCameraPicture({
        format: "jpg",
        uri: "data:image/jpeg;base64,photo",
      }),
    ).toEqual({
      uri: "data:image/jpeg;base64,photo",
      mimeType: "image/jpeg",
    });
  });

  it("builds a data URI when only raw base64 is available", () => {
    expect(
      normalizeWebCameraPicture({
        base64: "photo",
        format: "png",
        uri: "photo",
      }),
    ).toEqual({
      uri: "data:image/png;base64,photo",
      mimeType: "image/png",
    });
  });
});
