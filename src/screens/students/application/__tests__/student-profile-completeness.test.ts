import {
  buildIncompleteStudentConfirmationMessage,
  formatImportantStudentFields,
  getMissingImportantStudentFields,
} from "../student-profile-completeness";

describe("student profile completeness", () => {
  it("identifies the important fields that are still missing", () => {
    expect(getMissingImportantStudentFields({ name: "", birthDate: "", phone: "", cpfMasked: "" })).toEqual([
      "name",
      "phone",
      "birthDate",
      "cpf",
    ]);
    expect(
      getMissingImportantStudentFields({
        name: "Gustavo Ribeiro",
        birthDate: "2012-08-09",
        phone: "+55 (41) 99999-9999",
        cpfMasked: "***.***.***-42",
      })
    ).toEqual([]);
  });

  it("formats a clear confirmation before saving an incomplete profile", () => {
    const fields = getMissingImportantStudentFields({
      name: "Gustavo Ribeiro",
      birthDate: "",
      phone: "",
      cpfMasked: "",
    });

    expect(formatImportantStudentFields(fields)).toBe(
      "celular, data de nascimento e CPF"
    );
    expect(buildIncompleteStudentConfirmationMessage(fields)).toContain(
      "Cadastro incompleto"
    );
  });
});
