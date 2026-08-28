export type StudentInviteAuthMode = "signup" | "login";

type StudentInviteAuthFields = {
  mode: StudentInviteAuthMode;
  email: string;
  password: string;
  confirm: string;
};

export const canSubmitStudentInviteAuth = ({
  mode,
  email,
  password,
  confirm,
}: StudentInviteAuthFields) => {
  if (!email.trim() || !password.trim()) return false;
  if (mode === "login") return true;
  return password.trim().length >= 6 && Boolean(confirm) && confirm === password;
};

export const getStudentInviteAuthValidationMessage = ({
  mode,
  email,
  password,
  confirm,
}: StudentInviteAuthFields): string | null => {
  if (!email.trim()) return "Informe seu email.";
  if (!password.trim()) return "Informe sua senha.";
  if (mode === "login") return null;
  if (password.trim().length < 6) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (!confirm) return "Confirme sua senha.";
  if (confirm !== password) return "As senhas não conferem.";
  return null;
};
