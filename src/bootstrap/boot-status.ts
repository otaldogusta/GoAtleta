export type BootPhase =
  | "bootstrap"
  | "auth"
  | "navigation"
  | "role"
  | "organization"
  | "permissions"
  | "ready";

export type BootStatus = {
  phase: BootPhase;
  label: string;
  blocking: boolean;
};

export function resolveBootStatus(params: {
  bootstrapLoading: boolean;
  authLoading: boolean;
  navReady: boolean;
  roleLoading: boolean;
  organizationLoading: boolean;
  permissionsLoading: boolean;
  hasSession: boolean;
  role: string | null;
}): BootStatus {
  if (params.bootstrapLoading) {
    return { phase: "bootstrap", label: "Carregando configuração...", blocking: true };
  }
  if (params.authLoading) {
    return { phase: "auth", label: "Carregando sessão...", blocking: true };
  }
  if (!params.navReady) {
    return { phase: "navigation", label: "Preparando navegação...", blocking: true };
  }
  if (params.roleLoading) {
    return { phase: "role", label: "Carregando perfil...", blocking: false };
  }
  if (params.hasSession && params.role === "trainer" && params.organizationLoading) {
    return { phase: "organization", label: "Carregando organização...", blocking: false };
  }
  if (params.hasSession && params.role === "trainer" && params.permissionsLoading) {
    return { phase: "permissions", label: "Carregando permissões...", blocking: false };
  }
  return { phase: "ready", label: "Pronto", blocking: false };
}
