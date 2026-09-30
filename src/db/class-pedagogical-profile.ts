import type { ProfileRecord } from "../core/class-pedagogical-profile";
import { isMissingRelation, supabaseGet } from "./client";

/** No local read cache: authorization and profile version must be refreshed together. */
export async function getClassPedagogicalProfiles(organizationId: string, classId?: string): Promise<ProfileRecord[]> {
  if (!organizationId) return [];
  try {
    return await supabaseGet<ProfileRecord[]>(`/class_pedagogical_profiles?select=*&organization_id=eq.${encodeURIComponent(organizationId)}${classId ? `&class_id=eq.${encodeURIComponent(classId)}` : ""}`);
  } catch (error) {
    // Additive rollout: old environments retain the old planning behavior, never a fake saved profile.
    if (isMissingRelation(error, "class_pedagogical_profiles")) return [];
    throw error;
  }
}
