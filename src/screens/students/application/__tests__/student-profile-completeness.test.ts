import {
  buildIncompleteStudentConfirmationMessage,
  formatImportantStudentFields,
  getMissingImportantStudentFields,
} from "../student-profile-completeness";

describe("student profile completeness", () => {
  it("identifies the important fields that are still missing", () => {
    expect(getMissingImportantStudentFields({ birthDate: "", phone: "" })).toEqual([
      "birthDate",
      "phone",
    ]);
    expect(
      getMissingImportantStudentFields({
        birthDate: "2012-08-09",
        phone: "+55 (41) 99999-9999",
      })
    ).toEqual([]);
  });

  it("formats a clear confirmation before saving an incomplete profile", () => {
    const fields = getMissingImportantStudentFields({ birthDate: "", phone: "" });

    expect(formatImportantStudentFields(fields)).toBe(
      "data de nascimento e telefone de contato"
    );
    expect(buildIncompleteStudentConfirmationMessage(fields)).toContain(
      "Cadastro incompleto"
    );
  });
});
