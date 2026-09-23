import { mapStudentSelfProfile } from "../student-self-profile";

describe("student self profile mapping", () => {
  it("preserves editable personal fields after the role profile refreshes", () => {
    const student = mapStudentSelfProfile({
      id: "student-1",
      name: "Gustavo Ribeiro",
      organization_id: "org-1",
      student_user_id: "user-1",
      classid: "class-1",
      age: 23,
      phone: "5541988889999",
      cpf_masked: "***.***.***-42",
      rg: "12.345.678-9",
      address: "Rua das Flores, 10",
      gender_identity: "Masculino",
      guardian_name: "",
      guardian_phone: "",
      guardian_relation: "",
      health_issue: false,
      medication_use: false,
      position_primary: "levantador",
      position_secondary: "indefinido",
      birthdate: "2003-03-23",
      createdat: "2026-01-01T00:00:00.000Z",
    });

    expect(student).toMatchObject({
      cpfMasked: "***.***.***-42",
      rg: "12.345.678-9",
      address: "Rua das Flores, 10",
      genderIdentity: "Masculino",
      phone: "5541988889999",
      birthDate: "2003-03-23",
    });
  });
});
