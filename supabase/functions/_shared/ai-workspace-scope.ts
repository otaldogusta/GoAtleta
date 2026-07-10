export type AIWorkspaceScopeErrorCode =
  | "MISSING_WORKSPACE_CONTEXT"
  | "WORKSPACE_ACCESS_DENIED";

export class AIWorkspaceScopeError extends Error {
  readonly status: 400 | 403;
  readonly code: AIWorkspaceScopeErrorCode;

  constructor(status: 400 | 403, code: AIWorkspaceScopeErrorCode, message: string) {
    super(message);
    this.name = "AIWorkspaceScopeError";
    this.status = status;
    this.code = code;
  }
}

export function requireActiveWorkspaceId(
  requestedWorkspaceId: unknown,
  allowedWorkspaceIds: readonly string[]
): string {
  const workspaceId = String(requestedWorkspaceId ?? "").trim();

  if (!workspaceId) {
    throw new AIWorkspaceScopeError(
      400,
      "MISSING_WORKSPACE_CONTEXT",
      "O workspace ativo e obrigatorio para usar a IA."
    );
  }

  if (!allowedWorkspaceIds.includes(workspaceId)) {
    throw new AIWorkspaceScopeError(
      403,
      "WORKSPACE_ACCESS_DENIED",
      "O usuario nao possui acesso ao workspace informado."
    );
  }

  return workspaceId;
}
