import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AIContext } from "./ai-context.ts";

export interface AIFact {
  id: string;
  subject_type: "student" | "class" | "coach" | "organization";
  subject_id: string;
  fact_type: "motor_skill" | "class_pattern" | "coach_preference" | "general";
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

  if (error || !data) {
    console.error("[AIMemory Error]: Failed to fetch facts:", error);
    return [];
  }

  const factsList = data as AIFact[];

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

  const lines = facts.map(f => {
    const formattedContent = Object.entries(f.content)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    
    let subjectLabel = f.subject_type.toUpperCase();
    
    return `- [${subjectLabel} FACT] (${f.fact_type}): ${formattedContent} (Confidence: ${f.confidence.toFixed(2)})`;
  });

  return [
    "FACTS_MEMORY: Prioritize these structured facts during decision making and recommendations.",
    ...lines
  ].join("\n");
}
