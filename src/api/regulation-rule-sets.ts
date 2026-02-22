import { supabaseRestDelete, supabaseRestGet, supabaseRestPatch, supabaseRestPost } from "./rest";

type RegulationRuleSetRow = {
  id: string;
  organization_id: string;
  sport: string;
  version_label: string;
  status: "draft" | "active" | "pending_next_cycle" | "archived";
  activation_policy: "new_cycles_only" | "effective_from" | "immediate";
  effective_from: string | null;
  source_authority: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  clauses_count: number;
  updates_count: number;
};

type RegulationClauseRow = {
  id: string;
  organization_id: string;
  rule_set_id: string;
  clause_key: string;
  clause_label: string;
  clause_type: "number" | "boolean" | "text" | "json";
  base_value: unknown;
  overrides: unknown;
  source_reference: string | null;
  created_at: string;
  updated_at: string;
};

type RegulationRuleSetDiffRow = {
  clause_key: string;
  clause_label: string;
  left_clause_type: string | null;
  right_clause_type: string | null;
  left_value: unknown;
  right_value: unknown;
  left_overrides: unknown;
  right_overrides: unknown;
  diff_kind: "added" | "removed" | "changed" | "equal";
};

export type RegulationRuleSet = {
  id: string;
  organizationId: string;
  sport: string;
  versionLabel: string;
  status: "draft" | "active" | "pending_next_cycle" | "archived";
  activationPolicy: "new_cycles_only" | "effective_from" | "immediate";
  effectiveFrom: string | null;
  sourceAuthority: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clausesCount: number;
  updatesCount: number;
};

export type RegulationClause = {
  id: string;
  organizationId: string;
  ruleSetId: string;
  clauseKey: string;
  clauseLabel: string;
  clauseType: "number" | "boolean" | "text" | "json";
  baseValue: unknown;
  overrides: unknown[];
  sourceReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RegulationRuleSetDiff = {
  clauseKey: string;
  clauseLabel: string;
  leftClauseType: string | null;
  rightClauseType: string | null;
  leftValue: unknown;
  rightValue: unknown;
  leftOverrides: unknown[];
  rightOverrides: unknown[];
  diffKind: "added" | "removed" | "changed" | "equal";
};

const toCount = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapRuleSetRow = (row: RegulationRuleSetRow): RegulationRuleSet => ({
  id: row.id,
  organizationId: row.organization_id,
  sport: row.sport,
  versionLabel: row.version_label,
  status: row.status,
  activationPolicy: row.activation_policy,
  effectiveFrom: row.effective_from,
  sourceAuthority: row.source_authority,
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  clausesCount: toCount(row.clauses_count),
  updatesCount: toCount(row.updates_count),
});

const toArray = (value: unknown) => (Array.isArray(value) ? value : []);

const mapClauseRow = (row: RegulationClauseRow): RegulationClause => ({
  id: row.id,
  organizationId: row.organization_id,
  ruleSetId: row.rule_set_id,
  clauseKey: row.clause_key,
  clauseLabel: row.clause_label,
  clauseType: row.clause_type,
  baseValue: row.base_value,
  overrides: toArray(row.overrides),
  sourceReference: row.source_reference,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapDiffRow = (row: RegulationRuleSetDiffRow): RegulationRuleSetDiff => ({
  clauseKey: row.clause_key,
  clauseLabel: row.clause_label,
  leftClauseType: row.left_clause_type,
  rightClauseType: row.right_clause_type,
  leftValue: row.left_value,
  rightValue: row.right_value,
  leftOverrides: toArray(row.left_overrides),
  rightOverrides: toArray(row.right_overrides),
  diffKind: row.diff_kind,
});

export const listRegulationRuleSets = async (params: {
  organizationId: string;
  sport?: string | null;
  limit?: number;
}) => {
  const organizationId = params.organizationId?.trim();
  if (!organizationId) return [];
  const rows = await supabaseRestPost<RegulationRuleSetRow[]>(
    "/rpc/list_regulation_rule_sets",
    {
      p_organization_id: organizationId,
      p_sport: params.sport?.trim() || null,
      p_limit: Math.max(1, Math.min(params.limit ?? 80, 200)),
    },
    "return=representation"
  );
  return (rows ?? []).map(mapRuleSetRow);
};

export const peekRuleSetForNewCycle = async (params: {
  organizationId: string;
  eventSport: string;
}) => {
  const organizationId = params.organizationId?.trim();
  const eventSport = params.eventSport?.trim();
  if (!organizationId || !eventSport) return null;
  const response = await supabaseRestPost<string | null>(
    "/rpc/peek_rule_set_for_new_cycle",
    {
      p_organization_id: organizationId,
      p_event_sport: eventSport,
    },
    "return=representation"
  );
  if (!response) return null;
  return String(response).trim() || null;
};

export const listRegulationClauses = async (params: {
  organizationId: string;
  ruleSetId: string;
}) => {
  const organizationId = params.organizationId?.trim();
  const ruleSetId = params.ruleSetId?.trim();
  if (!organizationId || !ruleSetId) return [];
  const rows = await supabaseRestGet<RegulationClauseRow[]>(
    "/regulation_clauses?organization_id=eq." +
      encodeURIComponent(organizationId) +
      "&rule_set_id=eq." +
      encodeURIComponent(ruleSetId) +
      "&select=*" +
      "&order=clause_key.asc"
  );
  return (rows ?? []).map(mapClauseRow);
};

export const saveRegulationClause = async (params: {
  organizationId: string;
  ruleSetId: string;
  clauseKey: string;
  clauseLabel?: string;
  clauseType: "number" | "boolean" | "text" | "json";
  baseValue: unknown;
  overrides?: unknown[];
  sourceReference?: string | null;
}) => {
  const organizationId = params.organizationId.trim();
  const ruleSetId = params.ruleSetId.trim();
  const clauseKey = params.clauseKey.trim();
  if (!organizationId || !ruleSetId || !clauseKey) {
    throw new Error("Dados obrigatórios ausentes para salvar cláusula.");
  }

  const existing = await supabaseRestGet<RegulationClauseRow[]>(
    "/regulation_clauses?organization_id=eq." +
      encodeURIComponent(organizationId) +
      "&rule_set_id=eq." +
      encodeURIComponent(ruleSetId) +
      "&clause_key=eq." +
      encodeURIComponent(clauseKey) +
      "&select=*&limit=1"
  );

  const payload = {
    organization_id: organizationId,
    rule_set_id: ruleSetId,
    clause_key: clauseKey,
    clause_label: (params.clauseLabel?.trim() || clauseKey).slice(0, 120),
    clause_type: params.clauseType,
    base_value: params.baseValue,
    overrides: Array.isArray(params.overrides) ? params.overrides : [],
    source_reference: params.sourceReference?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.[0]?.id) {
    const rows = await supabaseRestPatch<RegulationClauseRow[]>(
      "/regulation_clauses?id=eq." + encodeURIComponent(existing[0].id),
      payload,
      "return=representation"
    );
    if (!rows[0]) throw new Error("Falha ao atualizar cláusula.");
    return mapClauseRow(rows[0]);
  }

  const rows = await supabaseRestPost<RegulationClauseRow[]>(
    "/regulation_clauses",
    [payload],
    "return=representation"
  );
  if (!rows[0]) throw new Error("Falha ao criar cláusula.");
  return mapClauseRow(rows[0]);
};

export const deleteRegulationClause = async (params: {
  organizationId: string;
  clauseId: string;
}) => {
  const organizationId = params.organizationId?.trim();
  const clauseId = params.clauseId?.trim();
  if (!organizationId || !clauseId) return;
  await supabaseRestDelete(
    "/regulation_clauses?id=eq." +
      encodeURIComponent(clauseId) +
      "&organization_id=eq." +
      encodeURIComponent(organizationId),
    "return=minimal"
  );
};

export const compareRegulationRuleSets = async (params: {
  organizationId: string;
  leftRuleSetId: string;
  rightRuleSetId: string;
}) => {
  const organizationId = params.organizationId?.trim();
  const leftRuleSetId = params.leftRuleSetId?.trim();
  const rightRuleSetId = params.rightRuleSetId?.trim();
  if (!organizationId || !leftRuleSetId || !rightRuleSetId) return [];
  const rows = await supabaseRestPost<RegulationRuleSetDiffRow[]>(
    "/rpc/compare_regulation_rule_sets",
    {
      p_organization_id: organizationId,
      p_left_rule_set_id: leftRuleSetId,
      p_right_rule_set_id: rightRuleSetId,
    },
    "return=representation"
  );
  return (rows ?? []).map(mapDiffRow);
};
