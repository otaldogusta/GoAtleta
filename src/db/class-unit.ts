import { assertSessionIdentity, getSessionIdentity, SessionIdentityChangedError } from "../auth/session";
import { canonicalizeUnitLabel } from "../core/unit-label";
import { getActiveOrganizationId, getReadCacheGeneration, supabaseRequest } from "./client";

type ClassUnitUpdateOptions = { organizationId: string; assertCurrent?: () => void };

const invalidResponse = () => new Error("Não foi possível confirmar a alteração da unidade.");
const parseRows = (text: string): unknown[] => {
  let rows: unknown;
  try { rows = JSON.parse(text); } catch { throw invalidResponse(); }
  if (!Array.isArray(rows)) throw invalidResponse();
  return rows;
};

/** Updates only this class's unit; other class settings and global units are preserved. */
export async function updateClassUnit(
  classId: string,
  unitLabel: string,
  options: ClassUnitUpdateOptions,
): Promise<{ unit: string; unitId?: string }> {
  if (typeof classId !== "string" || !classId.trim()
    || typeof unitLabel !== "string" || !unitLabel.trim()
    || typeof options?.organizationId !== "string" || !options.organizationId.trim()) {
    throw new Error("Turma, organização e unidade são obrigatórias.");
  }
  const id = classId.trim(), organizationId = options.organizationId.trim();
  const unit = canonicalizeUnitLabel(unitLabel);
  const identity = getSessionIdentity(), generation = getReadCacheGeneration();
  if (!identity.userId) throw new Error("Sessão expirada. Entre novamente.");
  const assertCurrent = () => {
    assertSessionIdentity(identity);
    if (generation !== getReadCacheGeneration()) throw new SessionIdentityChangedError();
    options.assertCurrent?.();
  };
  const assertScope = async () => {
    assertCurrent();
    const activeOrganizationId = await getActiveOrganizationId();
    assertCurrent();
    if (activeOrganizationId !== organizationId) throw new SessionIdentityChangedError();
  };
  await assertScope();
  // Resolve existing relations only through classes visible in this organization.
  // A custom label can remain unlinked; never create or rename a global unit here.
  const existing = parseRows(await supabaseRequest("GET",
    `/classes?select=unit,unit_id&organization_id=eq.${encodeURIComponent(organizationId)}&unit=eq.${encodeURIComponent(unit)}&unit_id=not.is.null&order=id.asc&limit=1`,
    undefined, undefined, identity, assertCurrent));
  await assertScope();
  if (existing.length > 1) throw invalidResponse();
  if (existing.length && (!existing[0] || typeof existing[0] !== "object" || Array.isArray(existing[0]))) throw invalidResponse();
  const linked = existing[0] as { unit?: unknown; unit_id?: unknown } | undefined;
  if (linked && (linked.unit !== unit || typeof linked.unit_id !== "string" || !linked.unit_id.trim())) throw invalidResponse();
  const unitId = linked?.unit_id as string | undefined;
  const saved = parseRows(await supabaseRequest("PATCH",
    `/classes?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(organizationId)}&select=id,organization_id,unit,unit_id`,
    { unit, unit_id: unitId ?? null }, { Prefer: "return=representation" }, identity, assertCurrent));
  await assertScope();
  if (saved.length !== 1) throw invalidResponse();
  const row = saved[0] as Record<string, unknown> | null;
  if (!row || row.id !== id || row.organization_id !== organizationId || row.unit !== unit || row.unit_id !== (unitId ?? null)) throw invalidResponse();
  return { unit, unitId };
}
