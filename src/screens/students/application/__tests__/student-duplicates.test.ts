import type { Student } from "../../../../core/models";
import {
  buildPossibleDuplicateStudentIdSet,
  buildPossibleDuplicateReviewSignature,
  findPossibleDuplicateStudentGroups,
  findStudentsWithSameNormalizedName,
} from "../student-duplicates";

const student = (id: string, name: string) => ({ id, name }) as Student;

describe("student duplicate selectors", () => {
  it("groups exact names ignoring accents, casing and extra spaces", () => {
    const groups = findPossibleDuplicateStudentGroups([
      student("s1", "Isadora Prost Gonçalves da Silva"),
      student("s2", " isadora  prost goncalves da silva "),
    ]);

    expect(groups).toEqual([
      {
        normalizedName: "isadora prost goncalves da silva",
        displayName: "Isadora Prost Gonçalves da Silva",
        studentIds: ["s1", "s2"],
      },
    ]);
  });

  it("does not group different or empty names", () => {
    expect(
      findPossibleDuplicateStudentGroups([
        student("s1", "Isadora Prost Gonçalves da Silva"),
        student("s2", "Isadora Lima"),
        student("s3", "  "),
      ])
    ).toEqual([]);
  });

  it("marks every record involved in a possible duplicate", () => {
    const ids = buildPossibleDuplicateStudentIdSet(
      findPossibleDuplicateStudentGroups([
        student("s1", "Ana Lima"),
        student("s2", "Ana Lima"),
        student("s3", "Ana Lima"),
        student("s4", "Bia Lima"),
      ])
    );

    expect(Array.from(ids)).toEqual(["s1", "s2", "s3"]);
  });

  it("finds an existing same-name record before creating another", () => {
    const matches = findStudentsWithSameNormalizedName(
      [student("s1", "Isadora Prost Gonçalves"), student("s2", "Isabela Gonçalves")],
      "isadora prost goncalves"
    );

    expect(matches.map((item) => item.id)).toEqual(["s1"]);
  });

  it("builds a stable review signature from the name and involved records", () => {
    expect(
      buildPossibleDuplicateReviewSignature({
        normalizedName: "ana lima",
        displayName: "Ana Lima",
        studentIds: ["s2", "s1"],
      })
    ).toBe("ana lima:s1,s2");
  });
});
