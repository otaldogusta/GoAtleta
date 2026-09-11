import { supabaseRestPost } from "./rest";

export type PlatformInstitutionLifecycle =
  "evaluation" | "active" | "paused" | "cancelled";
export type PlatformCommercialStatus = "ok" | "attention";
export type PlatformProduct = "goatleta" | "goatleta_pro";

export type PlatformInstitution = {
  organizationId: string;
  organizationName: string;
  responsibleUserId: string | null;
  responsibleName: string;
  responsibleEmail: string;
  product: PlatformProduct;
  lifecycleStatus: PlatformInstitutionLifecycle;
  commercialStatus: PlatformCommercialStatus;
  evaluationEndsAt: string | null;
  activatedAt: string | null;
  renewsAt: string | null;
  commercialNote: string;
  usersCount: number;
  updatedAt: string;
};

type PlatformInstitutionRow = {
  organization_id: string;
  organization_name: string;
  responsible_user_id: string | null;
  responsible_name: string;
  responsible_email: string;
  product: PlatformProduct;
  lifecycle_status: PlatformInstitutionLifecycle;
  commercial_status: PlatformCommercialStatus;
  evaluation_ends_at: string | null;
  activated_at: string | null;
  renews_at: string | null;
  commercial_note: string;
  users_count: number | string;
  updated_at: string;
};

const mapInstitution = (row: PlatformInstitutionRow): PlatformInstitution => ({
  organizationId: row.organization_id,
  organizationName: row.organization_name,
  responsibleUserId: row.responsible_user_id,
  responsibleName: row.responsible_name,
  responsibleEmail: row.responsible_email,
  product: row.product,
  lifecycleStatus: row.lifecycle_status,
  commercialStatus: row.commercial_status,
  evaluationEndsAt: row.evaluation_ends_at,
  activatedAt: row.activated_at,
  renewsAt: row.renews_at,
  commercialNote: row.commercial_note,
  usersCount: Number(row.users_count) || 0,
  updatedAt: row.updated_at,
});

export async function platformListInstitutions(): Promise<
  PlatformInstitution[]
> {
  const rows = await supabaseRestPost<PlatformInstitutionRow[]>(
    "/rpc/platform_list_institutions",
    {},
  );
  return (rows ?? []).map(mapInstitution);
}

export async function platformUpdateInstitutionAccount(input: {
  organizationId: string;
  product: PlatformProduct;
  lifecycleStatus: PlatformInstitutionLifecycle;
  commercialStatus: PlatformCommercialStatus;
  evaluationEndsAt: string | null;
  activatedAt: string | null;
  renewsAt: string | null;
  commercialNote: string;
  idempotencyKey: string;
}): Promise<{ organizationId: string; changed: boolean; updatedAt: string }> {
  const rows = await supabaseRestPost<
    Array<{ organization_id: string; changed: boolean; updated_at: string }>
  >("/rpc/platform_update_institution_account", {
    p_organization_id: input.organizationId,
    p_product: input.product,
    p_lifecycle_status: input.lifecycleStatus,
    p_commercial_status: input.commercialStatus,
    p_evaluation_ends_at: input.evaluationEndsAt,
    p_activated_at: input.activatedAt,
    p_renews_at: input.renewsAt,
    p_commercial_note: input.commercialNote,
    p_idempotency_key: input.idempotencyKey,
  });
  const receipt = rows?.[0];
  if (!receipt)
    throw new Error("O servidor não confirmou a atualização da instituição.");
  return {
    organizationId: receipt.organization_id,
    changed: Boolean(receipt.changed),
    updatedAt: receipt.updated_at,
  };
}
