import type { SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";
import { requireActiveWorkspaceId } from "./ai-workspace-scope.ts";
import {
  AIInstitutionalProfile,
  buildInstitutionalProfilePrompt,
  resolveHierarchicalInstitutionalProfile,
} from "./ai-institutional-profile.ts";

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

export interface AIActionContext {
  classId?: string;
  date: string;
}

export interface AIContext {
  user: AIUserContext;
  navigation: AINavigationContext;
  action: AIActionContext;
  institutionalProfile: AIInstitutionalProfile;
}

export const normalizeAIActionDate = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (!match) return null;
  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    return null;
  }
  return normalized;
};

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
  
  // 1. Resolve the explicit active workspace. Never infer one from another membership.
  const requestedOrganizationId = body.organizationId || body.organization_id;
  
  const { data: memberOrgs, error: orgsError } = await supabase
    .from("organization_members")
    .select("organization_id, role_level");

  if (orgsError || !memberOrgs || memberOrgs.length === 0) {
    throw new Error("User belongs to no organization or access is denied.");
  }

  const allowedOrgIds = memberOrgs.map(m => String(m.organization_id));
  const organizationId = requireActiveWorkspaceId(requestedOrganizationId, allowedOrgIds);

  // Resolve user role
  const activeMembership = memberOrgs.find(m => String(m.organization_id) === organizationId);
  const roleLevel = activeMembership?.role_level ?? 0;
  const role = roleLevel >= 50 ? "admin" : roleLevel >= 30 ? "coach" : "member";

  const navRaw = body.navigation || {};
  const navigation: AINavigationContext = {
    screen: String(navRaw.screen || body.screen || "home").trim(),
    entityType: navRaw.entityType
      ? String(navRaw.entityType).trim()
      : undefined,
    entityId: navRaw.entityId ? String(navRaw.entityId).trim() : undefined,
  };
  const navigationEntityType = String(navigation.entityType ?? "")
    .trim()
    .toLowerCase();
  const navigationClassId =
    ["class", "class_detail", "training_class"].includes(
      navigationEntityType
    ) && navigation.entityId
      ? navigation.entityId
      : "";
  const classId =
    (typeof body.classId === "string"
      ? body.classId.trim()
      : typeof body.class_id === "string"
        ? body.class_id.trim()
        : "") ||
    navigationClassId;
  const appSnapshot =
    body.appSnapshot && typeof body.appSnapshot === "object"
      ? body.appSnapshot as Record<string, unknown>
      : {};
  const actionDate =
    [
      body.actionDate,
      body.action_date,
      body.sessionDate,
      body.session_date,
      body.lessonDate,
      body.lesson_date,
      body.date,
      appSnapshot.sessionDate,
      appSnapshot.lessonDate,
      appSnapshot.date,
    ]
      .map(normalizeAIActionDate)
      .find(Boolean) ?? new Date().toISOString().slice(0, 10);

  const [
    { data: organization },
    { data: classRow, error: classError },
    { data: institutionalRows, error: institutionalError },
    { data: legacyInstitutionalRow, error: legacyInstitutionalError },
  ] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name")
        .eq("id", organizationId)
        .maybeSingle(),
      classId
        ? supabase
          .from("classes")
          .select("id, unit_id, unit, modality")
          .eq("id", classId)
          .eq("organization_id", organizationId)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("institutional_profiles")
        .select(
          "scope_type, scope_id, scope_label, organization_type, city, state, priorities, pedagogical_bias, pillar_weights, philosophy, constraints, goals, equipment_notes, communication_preferences, active"
        )
        .eq("organization_id", organizationId)
        .eq("active", true),
      supabase
        .from("organization_ai_profiles")
        .select(
          "organization_type, city, state, priorities, pedagogical_bias, pillar_weights, philosophy, constraints, goals, equipment_notes"
        )
        .eq("organization_id", organizationId)
        .maybeSingle(),
    ]);

  if (classId && (classError || !classRow)) {
    throw new Error("Class does not belong to the active organization or access is denied.");
  }

  if (institutionalError && institutionalError.code !== "42P01") {
    console.error("[AIContext]: Failed to load hierarchical institutional profiles", institutionalError);
  }
  if (legacyInstitutionalError && legacyInstitutionalError.code !== "42P01") {
    console.error("[AIContext]: Failed to load legacy institutional profile", legacyInstitutionalError);
  }

  const usesLegacyInstitutionalProfile =
    (!institutionalRows || institutionalRows.length === 0 || Boolean(institutionalError)) &&
    Boolean(legacyInstitutionalRow) &&
    !legacyInstitutionalError;
  if (usesLegacyInstitutionalProfile) {
    console.info("[AIContext]: Legacy institutional profile fallback used", {
      organizationId,
    });
  }

  const institutionalProfile = resolveHierarchicalInstitutionalProfile({
    organizationName: String(organization?.name ?? "Workspace ativo"),
    rows: institutionalError
      ? []
      : institutionalRows as Array<Record<string, unknown>> | null,
    classContext: classRow
      ? {
        id: String(classRow.id),
        unitId: classRow.unit_id,
        unit: classRow.unit,
        modality: classRow.modality,
      }
      : null,
    legacyRow: legacyInstitutionalRow as Record<string, unknown> | null,
  });

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

  return {
    user: {
      id: userId,
      role,
      organizationId,
      permissions
    },
    navigation,
    action: {
      classId: classId || undefined,
      date: actionDate,
    },
    institutionalProfile,
  };
}

export function buildSystemAIContextPrompt(ctx: AIContext): string {
  return [
    `AI_CONTEXT: You are assisting ${ctx.user.role === 'admin' ? 'an administrator' : 'a coach'} with ID "${ctx.user.id}".`,
    `They are in Organization "${ctx.user.organizationId}".`,
    `Their explicit permissions are: [${ctx.user.permissions.join(", ")}].`,
    `Current navigation context: Screen is "${ctx.navigation.screen}".` + 
      (ctx.navigation.entityType ? ` Viewing entity "${ctx.navigation.entityType}" with ID "${ctx.navigation.entityId}".` : ""),
    `Current action context: classId="${ctx.action.classId ?? ""}", date="${ctx.action.date}".`,
    buildInstitutionalProfilePrompt(ctx.institutionalProfile),
  ].join("\n");
}
