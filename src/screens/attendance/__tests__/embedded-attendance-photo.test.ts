import type { Student } from "../../../core/models";
import { resolveEmbeddedAttendanceStudentPhotos } from "../use-embedded-class-attendance";

describe("embedded attendance student photos", () => {
  const student = {
    id: "student-1",
    name: "Alyce dos Santos da Silva",
    photoUrl: "https://storage.example.com/private/alyce.jpg",
  } as Student;

  it("uses the authorized photo URL returned by storage", async () => {
    const resolvePhotoAccessUrl = jest.fn().mockResolvedValue("https://storage.example.com/signed/alyce.jpg");

    await expect(resolveEmbeddedAttendanceStudentPhotos([student], resolvePhotoAccessUrl)).resolves.toEqual([
      { ...student, photoUrl: "https://storage.example.com/signed/alyce.jpg" },
    ]);
    expect(resolvePhotoAccessUrl).toHaveBeenCalledWith(student.photoUrl);
  });

  it("removes an inaccessible photo so the avatar can show initials", async () => {
    const resolvePhotoAccessUrl = jest.fn().mockRejectedValue(new Error("expired"));

    await expect(resolveEmbeddedAttendanceStudentPhotos([student], resolvePhotoAccessUrl)).resolves.toEqual([
      { ...student, photoUrl: undefined },
    ]);
  });
});
