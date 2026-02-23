import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isRegulationIntent } from "./regulation-intent.ts";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AssistantSource = {
  title: string;
  author: string;
  url: string;
};

type AssistantResponse = {
  reply: string;
  sources: AssistantSource[];
  draftTraining: null;
  confidence: number;
  citations: { sourceTitle: string; evidence: string }[];
  assumptions: string[];
  missingData: string[];
};

type AppSnapshotPayload = {
  screen?: string | null;
  contextTitle?: string | null;
  regulationContext?: {
    activeRuleSetId?: string | null;
    pendingRuleSetId?: string | null;
    latestUpdateIds?: string[];
    latestChangedTopics?: string[];
    impactAreas?: string[];
  } | null;
} | null;

type RuleSetRow = {
  id: string;
  sport: string;
  version_label: string;
  status: "draft" | "active" | "pending_next_cycle" | "archived";
  source_authority: string;
  updated_at: string;
};

type UpdateRow = {
  id: string;
  source_url: string;
  source_label: string;
  source_authority: string;
  diff_summary: string;
  changed_topics: string[] | null;
  published_at: string | null;
  created_at: string;
};

type ClauseRow = {
  clause_key: string;
  clause_label: string;
  clause_type: string;
  base_value: unknown;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const toDateLabel = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
};

const toClauseValueLabel = (value: unknown) => {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return "-";
};

const createSupabaseClientWithToken = (token: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};

const latestUserPrompt = (messages: ChatMessage[]) => {
  const latest =
    [...messages].reverse().find((item) => item.role === "user")?.content ?? "";
  return latest.trim();
};

const buildLacunaResponse = (params: {
  reason: string[];
  contextTitle?: string | null;
}): AssistantResponse => {
  return {
    reply: [
      "Não consegui confirmar a regra com segurança neste momento.",
      params.contextTitle ? `Contexto: ${params.contextTitle}.` : "",
      "Dados insuficientes para resposta regulatória definitiva.",
      "Próximo passo recomendado: revisar fontes em /regulation-sources e histórico em /regulation-history.",
    ]
      .filter(Boolean)
      .join(" "),
    sources: [],
    draftTraining: null,
    confidence: 0.4,
    citations: [],
    assumptions: [
      "Resposta determinística sem inferência generativa de regra.",
    ],
    missingData: params.reason,
  };
};

const pickRuleSet = (params: {
  prompt: string;
  ruleSets: RuleSetRow[];
  snapshot: AppSnapshotPayload;
}) => {
  const normalizedPrompt = normalize(params.prompt);
  const active = params.ruleSets.find((item) => item.status === "active") ?? null;
  const pending =
    params.ruleSets.find((item) => item.status === "pending_next_cycle") ?? null;

  const asksForNextCycle =
    normalizedPrompt.includes("proximo ciclo") ||
    normalizedPrompt.includes("novo ciclo") ||
    normalizedPrompt.includes("proxima temporada");
  if (asksForNextCycle) return pending ?? active;

  const asksForCurrent =
    normalizedPrompt.includes("vigente") ||
    normalizedPrompt.includes("atual") ||
    normalizedPrompt.includes("vale hoje");
  if (asksForCurrent) return active ?? pending;

  const snapshotRuleSetId =
    params.snapshot?.regulationContext?.activeRuleSetId ??
    params.snapshot?.regulationContext?.pendingRuleSetId ??
    null;
  if (snapshotRuleSetId) {
    const fromSnapshot =
      params.ruleSets.find((item) => item.id === snapshotRuleSetId) ?? null;
    if (fromSnapshot) return fromSnapshot;
  }

  return active ?? pending;
};

export const resolveRegulationAssistantResponse = async (params: {
  token: string;
  organizationId: string;
  sportHint: string;
  messages: ChatMessage[];
  appSnapshot: AppSnapshotPayload;
}): Promise<AssistantResponse | null> => {
  if (!isRegulationIntent(params.messages)) return null;
  if (!params.organizationId.trim()) {
    return buildLacunaResponse({
      reason: ["organizationId ausente para consulta regulatória."],
      contextTitle: params.appSnapshot?.contextTitle ?? null,
    });
  }

  const supabase = createSupabaseClientWithToken(params.token);
  if (!supabase) {
    return buildLacunaResponse({
      reason: ["Cliente Supabase não inicializado na function assistant."],
      contextTitle: params.appSnapshot?.contextTitle ?? null,
    });
  }

  const prompt = latestUserPrompt(params.messages);
  const sport = params.sportHint?.trim() || "volleyball";

  const [ruleSetsResult, updatesResult] = await Promise.all([
    supabase.rpc("list_regulation_rule_sets", {
      p_organization_id: params.organizationId,
      p_sport: sport,
      p_limit: 20,
    }),
    supabase.rpc("list_regulation_updates", {
      p_organization_id: params.organizationId,
      p_unread_only: false,
      p_limit: 10,
      p_created_before: null,
    }),
  ]);

  if (ruleSetsResult.error) {
    return buildLacunaResponse({
      reason: [`Falha ao listar rulesets: ${ruleSetsResult.error.message}`],
      contextTitle: params.appSnapshot?.contextTitle ?? null,
    });
  }

  const ruleSets = Array.isArray(ruleSetsResult.data)
    ? (ruleSetsResult.data as RuleSetRow[])
    : [];
  const updates = Array.isArray(updatesResult.data)
    ? (updatesResult.data as UpdateRow[])
    : [];

  if (!ruleSets.length) {
    return buildLacunaResponse({
      reason: ["Nenhum ruleset encontrado para a organização/esporte informado."],
      contextTitle: params.appSnapshot?.contextTitle ?? null,
    });
  }

  const selectedRuleSet = pickRuleSet({
    prompt,
    ruleSets,
    snapshot: params.appSnapshot,
  });

  if (!selectedRuleSet) {
    return buildLacunaResponse({
      reason: ["Não foi possível resolver o ruleset aplicável para este ciclo."],
      contextTitle: params.appSnapshot?.contextTitle ?? null,
    });
  }

  const clausesResult = await supabase
    .from("regulation_clauses")
    .select("clause_key, clause_label, clause_type, base_value")
    .eq("organization_id", params.organizationId)
    .eq("rule_set_id", selectedRuleSet.id)
    .order("clause_key", { ascending: true })
    .limit(30);

  const clauses = Array.isArray(clausesResult.data)
    ? (clausesResult.data as ClauseRow[])
    : [];
  const latestUpdate =
    [...updates].sort((left, right) =>
      String(right.created_at).localeCompare(String(left.created_at))
    )[0] ?? null;

  const sources: AssistantSource[] = [];
  if (latestUpdate?.source_url) {
    sources.push({
      title: latestUpdate.source_label || "Fonte regulatória",
      author: latestUpdate.source_authority || "Regulamento",
      url: latestUpdate.source_url,
    });
  }

  const clauseHighlights = clauses.slice(0, 4).map((item) => {
    const label = item.clause_label || item.clause_key;
    return `- ${label}: ${toClauseValueLabel(item.base_value)}`;
  });

  const citations = clauses.slice(0, 3).map((item) => ({
    sourceTitle: `clause:${item.clause_key}`,
    evidence: `${item.clause_label || item.clause_key} = ${toClauseValueLabel(item.base_value)}`,
  }));

  const missingData: string[] = [];
  if (!clauses.length) {
    missingData.push("Ruleset sem cláusulas cadastradas para resposta detalhada.");
  }
  if (!latestUpdate) {
    missingData.push("Nenhuma atualização recente de regulamento encontrada.");
  }

  const replyLines = [
    `Regra aplicável: ${selectedRuleSet.version_label} (${selectedRuleSet.status}).`,
    latestUpdate
      ? `Última atualização detectada em ${toDateLabel(latestUpdate.published_at ?? latestUpdate.created_at)}: ${latestUpdate.diff_summary}`
      : "Sem atualização recente registrada para esta organização.",
    clauseHighlights.length
      ? `Cláusulas relevantes:\n${clauseHighlights.join("\n")}`
      : "Não há cláusulas suficientes para detalhar esta resposta com precisão.",
    missingData.length
      ? "Lacuna identificada: complete fontes/cláusulas em /regulation-sources e /regulation-history."
      : "Resposta determinística validada com base no ruleset e cláusulas atuais.",
  ];

  return {
    reply: replyLines.join("\n\n"),
    sources,
    draftTraining: null,
    confidence: missingData.length ? 0.62 : 0.88,
    citations,
    assumptions: [
      "Consulta regulatória processada por motor determinístico.",
      "A decisão prioriza ruleset ativo e pending_next_cycle quando solicitado para próximo ciclo.",
    ],
    missingData,
  };
};
