import { getInviteErrorCode } from "../../../api/invite-errors";

export const buildStudentInviteLink = (token: string) =>
  `https://goatleta.com/invite/${encodeURIComponent(token)}`;

export const getStudentInviteActionErrorMessage = (error: unknown) => {
  const code = getInviteErrorCode(error);
  if (code === "UNAUTHORIZED" || code === "MISSING_AUTH_TOKEN") {
    return "Sessão expirada. Entre novamente para gerar o convite.";
  }
  if (code === "FORBIDDEN" || code === "ORG_FORBIDDEN") {
    return "Sem permissão para gerar o convite.";
  }
  if (code === "STUDENT_ALREADY_LINKED") {
    return "Esse aluno já tem acesso ao app.";
  }
  if (code === "STUDENT_NOT_FOUND") {
    return "Aluno não encontrado.";
  }
  return "Não foi possível gerar o convite.";
};
