import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AIContext } from "./ai-context.ts";

export interface AIFact {
  id: string;
  memory_scope: "user_global" | "workspace";
  subject_type: "user" | "student" | "class" | "coach" | "organization";
  subject_id: string;
  fact_type: "motor_skill" | "class_pattern" | "coach_preference" | "interface_preference" | "general";
  content: Record<string, any>;
  confidence: number;
}

/**
 * Resolves all non-expired facts mapped to the active context targets (Coach, Class, Student).
 */
export async function resolveAIMemory(
  supabase: SupabaseClient,
  context: AIContext
): Promise<AIFact[]> {
  const { user, navigation } = context;
  const nowIso = new Date().toISOString();

  // Build OR condition targets to query relevant scope in a single batch
  const targets: string[] = [];

  // 1. Coach Preferences
  targets.push(`and(subject_type.eq.coach,subject_id.eq.${user.id})`);

  // 2. Class Patterns
  if (navigation.screen === "class_detail" && navigation.entityId) {
    targets.push(`and(subject_type.eq.class,subject_id.eq.${navigation.entityId})`);
  }

  // 3. Student Motor Skills
  if (navigation.screen === "student_profile" && navigation.entityId) {
    targets.push(`and(subject_type.eq.student,subject_id.eq.${navigation.entityId})`);
  }

  if (targets.length === 0) return [];

  const { data, error } = await supabase
    .from("ai_facts")
    .select("id, subject_type, subject_id, fact_type, content, confidence")
    .eq("organization_id", user.organizationId)
    .or(targets.join(","))
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  if (error) {
    console.error("[AIMemory Error]: Failed to fetch facts:", error);
  }

  const factsList = ((data ?? []) as Omit<AIFact, "memory_scope">[]).map((fact) => ({
    ...fact,
    memory_scope: "workspace" as const,
  }));

  // User-global facts are intentionally stored outside ai_facts so operational
  // workspace data can never cross organizations through a broad query.
  const { data: globalData, error: globalError } = await supabase
    .from("ai_user_global_facts")
    .select("id, user_id, fact_type, content, confidence")
    .eq("user_id", user.id)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(12);

  if (globalError && globalError.code !== "42P01") {
    console.error("[AIMemory Error]: Failed to fetch user-global facts:", globalError);
  }

  if (Array.isArray(globalData)) {
    globalData.forEach((fact) => {
      factsList.push({
        id: String(fact.id),
        memory_scope: "user_global",
        subject_type: "user",
        subject_id: String(fact.user_id),
        fact_type: fact.fact_type,
        content: fact.content ?? {},
        confidence: Number(fact.confidence ?? 0.5),
      } as AIFact);
    });
  }

  // 4. Query recent Decision Outcomes to aggregate behavior/feedback
  const { data: outcomes, error: outcomesError } = await supabase
    .from("ai_decision_outcomes")
    .select(`
      coach_action,
      feedback,
      ai_decision_traces!inner (
        decision,
        user_id
      )
    `)
    .eq("organization_id", user.organizationId)
    .eq("ai_decision_traces.user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(15);

  if (!outcomesError && outcomes && outcomes.length > 0) {
    const total = outcomes.length;
    const accepted = outcomes.filter((o) => o.coach_action === "accepted").length;
    const modified = outcomes.filter((o) => o.coach_action === "modified").length;
    const ignored = outcomes.filter((o) => o.coach_action === "ignored").length;

    const feedbacks = outcomes
      .filter((o) => o.feedback && o.feedback.trim().length > 0)
      .slice(0, 3)
      .map((o) => `"${o.feedback}" (sobre a decisão de "${(o.ai_decision_traces as any)?.decision || "treino"}")`);

    factsList.push({
      id: "synthetic-coach-feedback-summary",
      memory_scope: "workspace",
      subject_type: "coach",
      subject_id: user.id,
      fact_type: "coach_preference",
      content: {
        summary: `Taxa de aceitação recente: Aceitou ${accepted}/${total}, Modificou ${modified}/${total}, Ignorou ${ignored}/${total} sugestões da IA.`,
        feedbacks_recentes: feedbacks.length > 0 ? feedbacks.join(" | ") : "Sem feedbacks textuais recentes.",
      },
      confidence: 0.90,
    });
  }

  return factsList;
}

export function buildSystemAIMemoryPrompt(facts: AIFact[]): string {
  if (facts.length === 0) {
    return "FACTS_MEMORY: No structured facts found for active targets.";
  }

  const formatFact = (f: AIFact) => {
    const formattedContent = Object.entries(f.content)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    
    let subjectLabel = f.subject_type.toUpperCase();
    
    return `- [${subjectLabel} FACT] (${f.fact_type}): ${formattedContent} (Confidence: ${f.confidence.toFixed(2)})`;
  };

  const globalLines = facts
    .filter((fact) => fact.memory_scope === "user_global")
    .map(formatFact);
  const workspaceLines = facts
    .filter((fact) => fact.memory_scope === "workspace")
    .map(formatFact);

  return [
    "USER_GLOBAL_MEMORY: Use only for stable communication and general coaching preferences. Never treat it as operational evidence about a workspace, class or student.",
    ...(globalLines.length ? globalLines : ["- No user-global preferences found."]),
    "WORKSPACE_MEMORY: These facts belong exclusively to the active workspace and may support decisions only inside it.",
    ...(workspaceLines.length ? workspaceLines : ["- No workspace facts found for active targets."]),
  ].join("\n");
}
