import {
  assertSessionIdentity,
  getSessionIdentity,
  SessionIdentityChangedError,
  type SessionIdentity,
} from "../auth/session";
import type { Student } from "../core/models";
import { getActiveOrganizationId, getReadCacheGeneration, supabaseRequest } from "./client";

export type StudentFinancialStatusReadRow = {
  student_id: string;
  status: Student["financialStatus"];
};

export type StudentFinancialReadContext = {
  identity: SessionIdentity;
  assertCurrent: () => Promise<void>;
};

// Keep each scalar response bounded while covering larger directories in full.
// This is an RPC input bound, not PostgREST's table-row cap or a product limit.
export const STUDENT_FINANCIAL_RPC_MAX_IDS = 5000;
const RPC_PATH = "/rpc/get_student_financial_statuses_v1";
const validStatuses = new Set<Student["financialStatus"]>([
  "regular", "delinquent", "exempt", "pending", "unknown",
]);
const invalidResponse = () => new Error("A leitura financeira retornou dados inválidos.");

async function defaultContext(): Promise<StudentFinancialReadContext> {
  const identity = getSessionIdentity();
  const generation = getReadCacheGeneration();
  const initialOrganizationId = await getActiveOrganizationId();
  const assertCurrent = async () => {
    assertSessionIdentity(identity);
    if (generation !== getReadCacheGeneration()) throw new SessionIdentityChangedError();
    const organizationId = await getActiveOrganizationId();
    assertSessionIdentity(identity);
    if (generation !== getReadCacheGeneration() || organizationId !== initialOrganizationId) {
      throw new SessionIdentityChangedError();
    }
  };
  await assertCurrent();
  return { identity, assertCurrent };
}

/** null means only this exact RPC signature is absent: caller may use legacy GETs. */
export async function readStudentFinancialStatuses(
  organizationId: string,
  studentIds: string[],
  context?: StudentFinancialReadContext,
): Promise<StudentFinancialStatusReadRow[] | null> {
  if (typeof organizationId !== "string" || !organizationId.trim()
    || !Array.isArray(studentIds) || studentIds.some(id => typeof id !== "string")) {
    throw new Error("Organização e atletas são obrigatórios para a leitura financeira.");
  }
  const ids = [...new Set(studentIds.map(id => id.trim()).filter(Boolean))];
  if (!ids.length) return [];
  const captured = context ?? await defaultContext();
  if (!captured.identity.userId) throw new Error("Sessão expirada. Entre novamente.");
  const assertCurrent = async () => {
    assertSessionIdentity(captured.identity);
    await captured.assertCurrent();
    assertSessionIdentity(captured.identity);
  };
  const rows: StudentFinancialStatusReadRow[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += STUDENT_FINANCIAL_RPC_MAX_IDS) {
    await assertCurrent();
    const chunk = ids.slice(offset, offset + STUDENT_FINANCIAL_RPC_MAX_IDS);
    let text: string;
    try {
      text = await supabaseRequest("POST", RPC_PATH, {
        p_org_id: organizationId.trim(),
        p_student_ids: chunk,
      }, undefined, captured.identity);
    } catch (error) {
      await assertCurrent();
      // The canonical client keeps only the HTTP status and safe PostgREST code.
      // The fixed path and argument names above identify this exact signature.
      // Never treat denial, another 404/code, timeout or malformed data as absence.
      if (error instanceof Error && error.message === "Supabase POST error: 404 PGRST202") return null;
      throw error;
    }
    await assertCurrent();
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw invalidResponse(); }
    if (!Array.isArray(value) || value.length > chunk.length) throw invalidResponse();
    const requested = new Set(chunk);
    for (const item of value) {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw invalidResponse();
      const record = item as Record<string, unknown>;
      if (Object.keys(record).length !== 2 || typeof record.student_id !== "string"
        || !requested.has(record.student_id) || seen.has(record.student_id)
        || typeof record.status !== "string" || !validStatuses.has(record.status as Student["financialStatus"])) {
        throw invalidResponse();
      }
      seen.add(record.student_id);
      rows.push({ student_id: record.student_id, status: record.status as Student["financialStatus"] });
    }
  }
  await assertCurrent();
  return rows;
}
