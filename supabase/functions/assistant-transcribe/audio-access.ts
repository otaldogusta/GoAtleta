import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function canTranscribeLesson(supabase: SupabaseClient, userId: string, organizationId: string, classId?: string) {
  if (!userId || !organizationId) return false;
  const [membership, target] = await Promise.all([
    supabase.from("organization_members").select("role_level").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle(),
    classId ? supabase.from("classes").select("id").eq("organization_id", organizationId).eq("id", classId).maybeSingle() : Promise.resolve({data:null,error:null}),
  ]);
  return !membership.error && Number(membership.data?.role_level) >= 10
    && (!classId || (!target.error && target.data?.id === classId));
}
