export type PendingInviteIssue =
  | "revoked"
  | "expired"
  | "already_used"
  | "failed"
  | null;

export type PendingInviteViewState =
  | "approved"
  | "validating"
  | "revoked"
  | "expired"
  | "already_used"
  | "failed"
  | "found"
  | "waiting";

export const resolvePendingInviteViewState = ({
  accessApproved,
  inviteBusy,
  issue,
  hasStoredInvite,
}: {
  accessApproved: boolean;
  inviteBusy: boolean;
  issue: PendingInviteIssue;
  hasStoredInvite: boolean;
}): PendingInviteViewState => {
  if (accessApproved) return "approved";
  if (inviteBusy) return "validating";
  if (issue) return issue;
  if (hasStoredInvite) return "found";
  return "waiting";
};

export const getPendingInviteCopy = (state: PendingInviteViewState) => {
  switch (state) {
    case "approved":
      return {
        title: "Acesso liberado!",
        subtitle: "Seu acesso foi confirmado. Redirecionando...",
      };
    case "validating":
      return {
        title: "Validando convite",
        subtitle: "Estamos vinculando sua conta à organização.",
      };
    case "revoked":
      return {
        title: "Convite cancelado",
        subtitle: "A organização cancelou este link. Solicite um novo convite.",
      };
    case "expired":
      return {
        title: "Convite expirado",
        subtitle: "Este link perdeu a validade. Solicite um novo convite.",
      };
    case "already_used":
      return {
        title: "Convite já utilizado",
        subtitle: "Este link já foi vinculado a uma conta.",
      };
    case "failed":
      return {
        title: "Não foi possível validar",
        subtitle: "Confira o aviso abaixo e tente novamente.",
      };
    case "found":
      return {
        title: "Convite encontrado",
        subtitle: "Valide o convite para concluir seu acesso.",
      };
    default:
      return {
        title: "Escolha como começar",
        subtitle: "Entre por convite ou crie uma instituição para coordenar.",
      };
  }
};

export const isTerminalPendingInviteIssue = (state: PendingInviteViewState) =>
  state === "revoked" || state === "expired" || state === "already_used";

export type ResolvedPendingRole = "trainer" | "student" | "family";

export const resolvePendingRoleHome = (
  role: ResolvedPendingRole | "pending" | null,
) => {
  if (role === "student") return "/student/home" as const;
  if (role === "family") return "/family/home" as const;
  if (role === "trainer") return "/prof/home" as const;
  return null;
};
