import { supabaseRestPost } from "./rest";
import type { AthleteRequestCandidate } from "./athlete-access-request";

export function familyAccessErrorMessage(error: unknown) {
  let message = error instanceof Error ? error.message : "";
  try {
    const parsed: unknown = JSON.parse(message);
    if (parsed && typeof parsed === "object" && "message" in parsed && typeof parsed.message === "string") message = parsed.message;
  } catch { /* plain error */ }
  const allowed = ["Já existe um pedido", "Selecione um cadastro", "Este atleta já", "Esta conta já", "Existe um vínculo", "Solicitação já revisada", "Selecione o cadastro", "Informe", "O servidor não confirmou"];
  if (allowed.some(prefix => message.startsWith(prefix))) return message;
  if (/authorized|AUTHENTICATION_REQUIRED|auth token/i.test(message)) return "Não foi possível autorizar esta ação. Confira sua sessão e o vínculo com a instituição.";
  return "Não foi possível concluir. Tente novamente; os dados preenchidos foram mantidos.";
}

export type FamilyAccessIntent = "athlete" | "guardian";
export async function correctFamilyRequestKind(requestId: string, kind: FamilyAccessIntent) {
  const receipt = await supabaseRestPost<boolean>("/rpc/correct_family_request_kind", { p_request_id: requestId, p_kind: kind });
  if (typeof receipt !== "boolean") throw new Error("O servidor não confirmou a correção.");
}
export type FamilyAccessRequestInput = {
  organizationId: string;
  kind: FamilyAccessIntent;
  studentName: string;
  relationshipLabel?: string;
};

export async function requestFamilyAccess(input: FamilyAccessRequestInput) {
  if (!input.studentName.trim()) throw new Error("Informe o nome do atleta.");
  if (input.kind === "guardian" && !input.relationshipLabel?.trim()) throw new Error("Informe o parentesco.");
  const id = await supabaseRestPost<string>("/rpc/request_family_access", {
    p_org_id: input.organizationId, p_kind: input.kind,
    p_student_name: input.studentName.trim(),
    p_relationship_label: input.kind === "guardian" ? input.relationshipLabel!.trim() : null,
  });
  if (!id) throw new Error("O servidor não confirmou a solicitação.");
  return id;
}

export function listFamilyRequestCandidates(requestId: string) {
  return supabaseRestPost<AthleteRequestCandidate[]>("/rpc/list_family_request_candidates", { p_request_id: requestId });
}

export async function reviewFamilyAccessRequest(requestId: string, decision: "approved" | "rejected", studentId: string | null, key: string) {
  const receipt = await supabaseRestPost<boolean>("/rpc/review_family_access_request", {
    p_request_id: requestId, p_decision: decision, p_student_id: studentId, p_idempotency_key: key,
  });
  if (typeof receipt !== "boolean") throw new Error("O servidor não confirmou a revisão.");
}
