import { supabaseRestGet } from "./rest";

type InstitutionLocationRow = { city: string | null; state: string | null };
type MembershipRow = { created_at: string };

export async function getInstitutionLocation(organizationId: string): Promise<string | null> {
  if (!organizationId) return null;
  const rows = await supabaseRestGet<InstitutionLocationRow[]>(
    `/institutional_profiles?select=city,state&organization_id=eq.${encodeURIComponent(organizationId)}&scope_type=eq.workspace&active=is.true&limit=1`,
  );
  const city = rows[0]?.city?.trim();
  const state = rows[0]?.state?.trim();
  return city ? [city, state].filter(Boolean).join(", ") : null;
}

export async function getMemberJoinedAt(organizationId: string, userId: string): Promise<string | null> {
  if (!organizationId || !userId) return null;
  const rows = await supabaseRestGet<MembershipRow[]>(
    `/organization_members?select=created_at&organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  return rows[0]?.created_at ?? null;
}
