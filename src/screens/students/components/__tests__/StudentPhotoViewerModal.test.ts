import { resolveStudentPhotoViewerState } from "../StudentPhotoViewerModal";

describe("resolveStudentPhotoViewerState", () => {
  it("shows the empty avatar immediately when the student has no photo", () => {
    expect(
      resolveStudentPhotoViewerState({
        uri: null,
        loading: false,
        imageFailed: false,
      }),
    ).toBe("empty");
  });

  it("only shows loading while a stored photo is being resolved", () => {
    expect(
      resolveStudentPhotoViewerState({
        uri: null,
        loading: true,
        imageFailed: false,
      }),
    ).toBe("loading");
  });

  it("falls back to the empty avatar after an image error", () => {
    expect(
      resolveStudentPhotoViewerState({
        uri: "https://example.com/student.jpg",
        loading: false,
        imageFailed: true,
      }),
    ).toBe("empty");
  });
});
