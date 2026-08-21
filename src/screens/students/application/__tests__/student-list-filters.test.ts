import type { ClassGroup, Student } from "../../../../core/models";
import {
  createEmptyStudentFilterExclusions,
  matchesStudentFilterExclusions,
  toggleStudentFilterExclusion,
} from "../student-list-filters";

const student = (overrides: Partial<Student> = {}) =>
  ({
    id: "student-1",
    name: "Ana",
    organizationId: "org-1",
    classId: "class-1",
    membershipStatus: "active",
    financialStatus: "regular",
    phone: "",
    guardianPhone: "",
    ...overrides,
  }) as Student;

const classGroup = (gender: ClassGroup["gender"]) =>
  ({ id: "class-1", gender }) as ClassGroup;

describe("student list filter exclusions", () => {
  it("includes every option by default", () => {
    expect(
      matchesStudentFilterExclusions({
        student: student(),
        classGroup: classGroup("feminino"),
        exclusions: createEmptyStudentFilterExclusions(),
      }),
    ).toBe(true);
  });

  it("removes unchecked genders while preserving selected ones", () => {
    const exclusions = createEmptyStudentFilterExclusions();
    exclusions.genders = ["masculino", "misto"];

    expect(
      matchesStudentFilterExclusions({
        student: student(),
        classGroup: classGroup("feminino"),
        exclusions,
      }),
    ).toBe(true);
    expect(
      matchesStudentFilterExclusions({
        student: student(),
        classGroup: classGroup("masculino"),
        exclusions,
      }),
    ).toBe(false);
    expect(
      matchesStudentFilterExclusions({
        student: student(),
        classGroup: classGroup("misto"),
        exclusions,
      }),
    ).toBe(false);
  });

  it("toggles an option between selected and excluded", () => {
    expect(toggleStudentFilterExclusion([], "masculino")).toEqual(["masculino"]);
    expect(toggleStudentFilterExclusion(["masculino"], "masculino")).toEqual([]);
  });
});
