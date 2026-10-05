import {
  assertSessionIdentity,
  getSessionIdentity,
  isSessionIdentityCurrent,
  SessionIdentityChangedError,
  type SessionIdentity,
} from "../auth/session";
import { getActiveOrganizationId, getReadCacheGeneration, supabaseGet } from "./client";

export type ConsultationContext = Readonly<{
  identity: SessionIdentity;
  organizationId: string;
  cacheGeneration: number;
  student?: Readonly<{ id: string; workspaceOrganizationId: string | null }>;
}>;

export const isConsultationContextCurrent = (context: ConsultationContext) =>
  Boolean(context.identity.userId && context.organizationId) &&
  isSessionIdentityCurrent(context.identity) &&
  context.cacheGeneration === getReadCacheGeneration();

export async function assertConsultationContext(context: ConsultationContext) {
  if (!isConsultationContextCurrent(context)) throw new SessionIdentityChangedError();
  const organizationId = (await getActiveOrganizationId())?.trim() || null;
  const expectedOrganizationId = context.student
    ? context.student.workspaceOrganizationId : context.organizationId;
  if (!isConsultationContextCurrent(context) || organizationId !== expectedOrganizationId) {
    throw new SessionIdentityChangedError();
  }
}

export async function captureConsultationContext(expectedOrganizationId?: string): Promise<ConsultationContext> {
  const identity = getSessionIdentity();
  const cacheGeneration = getReadCacheGeneration();
  if (!identity.userId) throw new Error("Entre novamente para abrir a consultoria.");
  const organizationId = (await getActiveOrganizationId())?.trim();
  assertSessionIdentity(identity);
  if (cacheGeneration !== getReadCacheGeneration()) throw new SessionIdentityChangedError();
  if (!organizationId) throw new Error("Selecione uma organização para abrir a consultoria.");
  if (expectedOrganizationId !== undefined && organizationId !== expectedOrganizationId.trim()) {
    throw new SessionIdentityChangedError();
  }
  return { identity, organizationId, cacheGeneration };
}

// Athletes can own a student record without staff membership or an active workspace.
// Verify that binding under their session, rather than treating an arbitrary org ID as authority.
export async function captureStudentConsultationContext(
  studentId: string,
  organizationId: string,
): Promise<ConsultationContext> {
  const identity = getSessionIdentity();
  const cacheGeneration = getReadCacheGeneration();
  if (!identity.userId) throw new Error("Entre novamente para abrir a consultoria.");
  if (!studentId.trim() || !organizationId.trim()) throw new Error("Vínculo do atleta indisponível.");
  const workspaceOrganizationId = (await getActiveOrganizationId())?.trim() || null;
  const verifiedStudentId = studentId.trim();
  const context: ConsultationContext = {
    identity, cacheGeneration, organizationId: organizationId.trim(),
    student: { id: verifiedStudentId, workspaceOrganizationId },
  };
  await assertConsultationContext(context);
  const rows = await supabaseGet<{ id: string }[]>(
    `/students?id=eq.${encodeURIComponent(verifiedStudentId)}` +
    `&organization_id=eq.${encodeURIComponent(context.organizationId)}` +
    `&student_user_id=eq.${encodeURIComponent(identity.userId)}&select=id&limit=1`,
    identity,
  );
  await assertConsultationContext(context);
  if (!rows.some((row) => row.id === verifiedStudentId)) {
    throw new Error("Vínculo do atleta indisponível para esta conta.");
  }
  return context;
}
