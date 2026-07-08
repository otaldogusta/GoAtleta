import { SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";

export interface AIUserContext {
  id: string;
  role: string;
  organizationId: string;
  permissions: string[];
}

export interface AINavigationContext {
  screen: string;
  entityType?: string;
  entityId?: string;
}

export interface AIContext {
  user: AIUserContext;
  navigation: AINavigationContext;
}

/**
 * Safely builds the AIContext for a given request.
 * Querying the database with the user's JWT client (RLS) ensures they only fetch their actual access scope.
 */
export async function resolveAIContext(
  supabase: SupabaseClient,
  user: User,
  body: any
): Promise<AIContext> {
  const userId = user.id;
  
  // 1. Resolve Organization ID
  // If not provided in the body, try to resolve the first organization the user is a member of.
  let organizationId = String(body.organizationId || body.organization_id || "").trim();
  
  const { data: memberOrgs, error: orgsError } = await supabase
    .from("organization_members")
    .select("organization_id, role_level");

  if (orgsError || !memberOrgs || memberOrgs.length === 0) {
    throw new Error("User belongs to no organization or access is denied.");
  }

  // Fallback to first membership if none specified or requested is invalid
  const allowedOrgIds = memberOrgs.map(m => String(m.organization_id));
  if (!organizationId || !allowedOrgIds.includes(organizationId)) {
    organizationId = String(memberOrgs[0].organization_id);
  }

  // Resolve user role
  const activeMembership = memberOrgs.find(m => String(m.organization_id) === organizationId);
  const roleLevel = activeMembership?.role_level ?? 0;
  const role = roleLevel >= 50 ? "admin" : roleLevel >= 30 ? "coach" : "member";

  // 2. Resolve Active Permissions
  const { data: permsData, error: permsError } = await supabase.rpc("get_my_member_permissions", {
    p_org_id: organizationId
  });

  const permissions: string[] = [];
  if (!permsError && Array.isArray(permsData)) {
    permsData.forEach((p: { permission_key: string; is_allowed: boolean }) => {
      if (p.is_allowed) {
        permissions.push(p.permission_key);
      }
    });
  }

  // 3. Resolve Navigation Context (default fallback if client doesn't send it)
  const navRaw = body.navigation || {};
  const navigation: AINavigationContext = {
    screen: String(navRaw.screen || body.screen || "home").trim(),
    entityType: navRaw.entityType ? String(navRaw.entityType).trim() : undefined,
    entityId: navRaw.entityId ? String(navRaw.entityId).trim() : undefined
  };

  return {
    user: {
      id: userId,
      role,
      organizationId,
      permissions
    },
    navigation
  };
}

export function buildSystemAIContextPrompt(ctx: AIContext): string {
  return [
    `AI_CONTEXT: You are assisting ${ctx.user.role === 'admin' ? 'an administrator' : 'a coach'} with ID "${ctx.user.id}".`,
    `They are in Organization "${ctx.user.organizationId}".`,
    `Their explicit permissions are: [${ctx.user.permissions.join(", ")}].`,
    `Current navigation context: Screen is "${ctx.navigation.screen}".` + 
      (ctx.navigation.entityType ? ` Viewing entity "${ctx.navigation.entityType}" with ID "${ctx.navigation.entityId}".` : "")
  ].join("\n");
}
