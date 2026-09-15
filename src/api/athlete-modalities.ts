import { supabaseRestGet, supabaseRestPost } from "./rest";
import type { ClassModality } from "../core/class-modality";

export type AthleteModalities = { automatic: ClassModality[]; personal: ClassModality[] };
export const getMyAthleteModalities = () => supabaseRestPost<AthleteModalities>("/rpc/get_my_athlete_modalities", {});
export const saveMyAthleteModalities = (modalities: ClassModality[]) =>
  supabaseRestPost<void>("/rpc/save_my_athlete_modalities", { p_modalities: modalities });
export const getPlanModalities = (organizationId: string) =>
  supabaseRestGet<{ id: string; modality: ClassModality | null }[]>(`/tuition_plans?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,modality`);
export const setPlanModality = (organizationId: string, planId: string, modality: ClassModality | null) =>
  supabaseRestPost<void>("/rpc/set_tuition_plan_modality", { p_org_id: organizationId, p_plan_id: planId, p_modality: modality });
