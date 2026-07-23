import {
  getValidationFieldStyle,
  nextFormValidationIssue,
} from "../form-validation-feedback";

describe("form validation feedback", () => {
  it("increments the attempt even when the same error is submitted again", () => {
    const first = nextFormValidationIssue(null, "birthDate", "Informe a data de nascimento.");
    const second = nextFormValidationIssue(first, "birthDate", "Informe a data de nascimento.");

    expect(first).toEqual({
      field: "birthDate",
      message: "Informe a data de nascimento.",
      attempt: 1,
    });
    expect(second.attempt).toBe(2);
  });

  it("uses a stronger border only for invalid fields", () => {
    expect(getValidationFieldStyle(false, "#ef4444")).toBeNull();
    expect(getValidationFieldStyle(true, "#ef4444")).toEqual({
      borderColor: "#ef4444",
      borderWidth: 2,
    });
  });
});
