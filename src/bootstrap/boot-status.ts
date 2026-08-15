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

export function shouldMaskBootContent(status: BootStatus) {
  return status.blocking;
}

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
    // The navigator only becomes ready after its route tree has rendered.
    // Keep route guards waiting on navReady, but never hide that tree behind
    // the global loader or a direct URL refresh can deadlock indefinitely.
    return { phase: "navigation", label: "Preparando navegação...", blocking: false };
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
