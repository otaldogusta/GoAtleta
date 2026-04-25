import type { ClassGroup, Student } from "../../models";
import {
  findPossibleExistingStudents,
  normalizeStudentLookupName,
} from "../find-possible-existing-students";

const classesById = new Map<string, ClassGroup>([
  [
    "c1",
    {
      id: "c1",
      name: "Sub-13 Masculino",
      unit: "Boa Cidadania",
      ageGroup: "sub13",
      modality: "voleibol",
      schedule: [],
      studentsCount: 0,
      professorId: "",
      createdAt: "",
      organizationId: "org_1",
      startTime: "",
      endTime: "",
      daysOfWeek: [],
      durationMinutes: 90,
      gender: "masculino",
    } as ClassGroup,
  ],
  [
    "c2",
    {
      id: "c2",
      name: "Sub-11 Feminino",
      unit: "Boa Cidadania",
      ageGroup: "sub11",
      modality: "voleibol",
      schedule: [],
      studentsCount: 0,
      professorId: "",
      createdAt: "",
      organizationId: "org_1",
      startTime: "",
      endTime: "",
      daysOfWeek: [],
      durationMinutes: 90,
      gender: "feminino",
    } as ClassGroup,
  ],
]);

const students: Student[] = [
  {
    id: "s1",
    name: "João Pedro Ávila",
    organizationId: "org_1",
    classId: "c1",
    age: 12,
    phone: "",
    loginEmail: "",
    guardianName: "",
    guardianPhone: "",
    guardianRelation: "",
    birthDate: "2012-04-10",
    healthIssue: false,
    healthIssueNotes: "",
    medicationUse: false,
    medicationNotes: "",
    healthObservations: "",
    positionPrimary: "indefinido",
    positionSecondary: "indefinido",
    athleteObjective: "base",
    learningStyle: "misto",
    createdAt: "",
  },
  {
    id: "s2",
    name: "Maria Eduarda S.",
    organizationId: "org_1",
    classId: "c2",
    age: 11,
    phone: "",
    loginEmail: "",
    guardianName: "",
    guardianPhone: "",
    guardianRelation: "",
    birthDate: "2013-02-01",
    healthIssue: false,
    healthIssueNotes: "",
    medicationUse: false,
    medicationNotes: "",
    healthObservations: "",
    positionPrimary: "indefinido",
    positionSecondary: "indefinido",
    athleteObjective: "base",
    learningStyle: "misto",
    createdAt: "",
  },
];

describe("findPossibleExistingStudents", () => {
  it("normalizes accents and spacing in names", () => {
    expect(normalizeStudentLookupName(" João   Pedro Ávila ")).toBe(
      "joao pedro avila"
    );
  });

  it("returns a high-confidence match for exact name and birthdate", () => {
    const matches = findPossibleExistingStudents({
      name: "joao pedro avila",
      birthDate: "2012-04-10",
      students,
      classesById,
    });

    expect(matches[0]?.matchType).toBe("exact_name_birthdate");
    expect(matches[0]?.confidence).toBe("high");
    expect(matches[0]?.className).toBe("Sub-13 Masculino");
  });

  it("returns a medium-confidence match for exact normalized name without birthdate", () => {
    const matches = findPossibleExistingStudents({
      name: "João Pedro Ávila",
      birthDate: "",
      students,
      classesById,
    });

    expect(matches[0]?.matchType).toBe("exact_name");
    expect(matches[0]?.confidence).toBe("medium");
  });

  it("returns a low-confidence match for similar names only when similarity is strong enough", () => {
    const matches = findPossibleExistingStudents({
      name: "Maria Eduarda Santos",
      birthDate: "",
      students,
      classesById,
    });

    expect(matches[0]?.matchType).toBe("similar_name");
    expect(matches[0]?.confidence).toBe("low");
  });

  it("ignores weak matches that only share the first name", () => {
    const matches = findPossibleExistingStudents({
      name: "João Lucas",
      birthDate: "",
      students,
      classesById,
    });

    expect(matches).toHaveLength(0);
  });
});
