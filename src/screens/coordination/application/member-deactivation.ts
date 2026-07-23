import type { OrgMember } from "../../../api/members";

export type MemberDeactivationIssue = {
  message: string;
  blocking: boolean;
};

const parseRpcErrorMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  try {
    const parsed = JSON.parse(raw) as { message?: string; error?: string };
    return parsed.message || parsed.error || raw;
  } catch {
    return raw;
  }
};

export function getMemberDeactivationBlockReason(
  member: OrgMember,
  members: OrgMember[],
  assignedClassCount: number
) {
  if (assignedClassCount > 0) {
    return "Reatribua as turmas desta pessoa antes de desativar o acesso.";
  }

  const otherCoordinators = members.filter(
    (candidate) => candidate.userId !== member.userId && candidate.roleLevel >= 50
  );
  if (member.roleLevel >= 50 && otherCoordinators.length === 0) {
    return "Defina outra pessoa como coordenação antes de desativar este acesso.";
  }

  return null;
}

export function formatMemberDeactivationError(error: unknown): MemberDeactivationIssue {
  const message = parseRpcErrorMessage(error);

  if (message.includes("Member has responsible classes")) {
    return {
      message: "Reatribua as turmas desta pessoa antes de desativar o acesso.",
      blocking: true,
    };
  }
  if (message.includes("Cannot remove last admin")) {
    return {
      message: "Defina outra pessoa como coordenação antes de desativar este acesso.",
      blocking: true,
    };
  }
  if (message.includes("Cannot remove yourself")) {
    return {
      message: "Seu próprio acesso não pode ser desativado por aqui.",
      blocking: true,
    };
  }
  if (message.includes("Not authorized")) {
    return {
      message: "Você não tem permissão para desativar acessos.",
      blocking: true,
    };
  }
  if (message.includes("Member not found")) {
    return {
      message: "Este acesso já não está ativo. Atualize a lista.",
      blocking: true,
    };
  }

  return {
    message: "Não foi possível desativar agora. Tente novamente.",
    blocking: false,
  };
}
