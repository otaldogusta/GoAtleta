import { InviteApiError, type InviteErrorCode } from "../../../../api/invite-errors";
import {
  buildStudentInviteLink,
  getStudentInviteActionErrorMessage,
} from "../student-invite-sharing";

describe("student invite sharing", () => {
  it("builds a safe canonical invite URL", () => {
    expect(buildStudentInviteLink("token/with spaces")).toBe(
      "https://goatleta.com/invite/token%2Fwith%20spaces"
    );
  });

  it.each([
    ["UNAUTHORIZED", "Sessão expirada. Entre novamente para gerar o convite."],
    ["FORBIDDEN", "Sem permissão para gerar o convite."],
    ["STUDENT_ALREADY_LINKED", "Esse aluno já tem acesso ao app."],
    ["STUDENT_NOT_FOUND", "Aluno não encontrado."],
  ])("maps %s to an operational message", (code, expected) => {
    expect(
      getStudentInviteActionErrorMessage(
        new InviteApiError("request failed", code as InviteErrorCode)
      )
    ).toBe(expected);
  });
});
