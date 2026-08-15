import {
  formatCameraZoomLabel,
  getDefaultCameraZoom,
  getOppositeCameraFacing,
  getWebCameraZoomOptions,
  normalizeCameraZoom,
  normalizeWebCameraPicture,
  selectPreferredRearCameraDevice,
} from "../web-camera-capture";

describe("normalizeWebCameraPicture", () => {
  it("switches between the front and back cameras", () => {
    expect(getOppositeCameraFacing("front")).toBe("back");
    expect(getOppositeCameraFacing("back")).toBe("front");
  });

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

  it("keeps the local file URI returned by native cameras", () => {
    expect(
      normalizeWebCameraPicture({
        format: "jpg",
        uri: "file:///camera/photo.jpg",
      }),
    ).toEqual({
      uri: "file:///camera/photo.jpg",
      mimeType: "image/jpeg",
    });
  });

  it("opens a rear camera range at the real 1x level", () => {
    const range = { min: 0.6, max: 3, step: 0.1 };

    expect(getDefaultCameraZoom(range)).toBe(1);
    expect(normalizeCameraZoom(1, range)).toBeCloseTo(1 / 6);
  });

  it("shows only zoom levels supported by the current camera", () => {
    expect(
      getWebCameraZoomOptions({ min: 0.6, max: 2, step: 0.1 }).map(
        ({ label, value }) => ({ label, value }),
      ),
    ).toEqual([
      { label: "0,6x", value: 0.6 },
      { label: "1x", value: 1 },
      { label: "2x", value: 2 },
    ]);
  });

  it("does not invent controls when the browser exposes no useful zoom range", () => {
    expect(getWebCameraZoomOptions({ min: 1, max: 1 })).toEqual([
      { label: "1x", normalized: 0, value: 1 },
    ]);
    expect(getWebCameraZoomOptions({ min: 0, max: 3 })).toEqual([]);
  });

  it("formats fractional zoom labels for pt-BR", () => {
    expect(formatCameraZoomLabel(0.5)).toBe("0,5x");
    expect(formatCameraZoomLabel(3)).toBe("3x");
  });

  it("prefers Android's main rear camera over ultra-wide and front lenses", () => {
    expect(
      selectPreferredRearCameraDevice(
        [
          { deviceId: "front", kind: "videoinput", label: "camera2 1, facing front" },
          { deviceId: "ultra", kind: "videoinput", label: "camera2 2, facing back ultra wide" },
          { deviceId: "main", kind: "videoinput", label: "camera2 0, facing back" },
        ],
        "ultra",
      )?.deviceId,
    ).toBe("main");
  });

  it("prefers a named standard rear camera over an ultra-wide lens", () => {
    expect(
      selectPreferredRearCameraDevice([
        { deviceId: "ultra", kind: "videoinput", label: "Back Ultra Wide Camera 0.6" },
        { deviceId: "main", kind: "videoinput", label: "Back Main Camera" },
      ])?.deviceId,
    ).toBe("main");
  });

  it("does not switch cameras blindly when the browser hides lens labels", () => {
    expect(
      selectPreferredRearCameraDevice(
        [
          { deviceId: "one", kind: "videoinput", label: "" },
          { deviceId: "two", kind: "videoinput", label: "" },
        ],
        "two",
      )?.deviceId,
    ).toBe("two");
  });
});
