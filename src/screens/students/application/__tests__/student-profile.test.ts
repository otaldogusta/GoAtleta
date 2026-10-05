import type { ClassGroup, Student } from "../../../../core/models";
import { resolveStudentProfile, studentProfileAge } from "../student-profile";

const student = { id: "athlete", organizationId: "org-a", classId: "class-a" } as Student;
const group = { id: "class-a", organizationId: "org-a" } as ClassGroup;

describe("student profile scope", () => {
  it("resolves only an athlete already in the current authorized directory", () => {
    const classes = new Map([[group.id, group]]);
    expect(resolveStudentProfile("athlete", "org-a", [student], classes)).toEqual({ student, classGroup: group });
    expect(resolveStudentProfile("athlete", "org-b", [student], classes)).toBeNull();
    expect(resolveStudentProfile("athlete", undefined, [student], classes)).toBeNull();
    expect(resolveStudentProfile("unknown", "org-a", [student], classes)).toBeNull();
    expect(resolveStudentProfile(["athlete", "other"], "org-a", [student], classes)).toBeNull();
    expect(resolveStudentProfile("athlete", "org-a", [], classes)).toBeNull();
  });
  it("does not attach stale classes from a previous organization", () => {
    const classes = new Map([[group.id, { ...group, organizationId: "org-b" }]]);
    expect(resolveStudentProfile("athlete", "org-a", [student], classes)?.classGroup).toBeNull();
  });
  it("uses birthday boundaries instead of a stale stored age", () => {
    const athlete = { birthDate: "2014-08-22", age: 10 };
    expect(studentProfileAge(athlete, new Date(2026, 7, 21))).toBe(11);
    expect(studentProfileAge(athlete, new Date(2026, 7, 22))).toBe(12);
    expect(studentProfileAge({ birthDate: "", age: 10 })).toBe(10);
    expect(studentProfileAge({ birthDate: "2024-02-31", age: 10 })).toBeNull();
    expect(studentProfileAge({ birthDate: "2099-01-01", age: 10 })).toBeNull();
  });
});
