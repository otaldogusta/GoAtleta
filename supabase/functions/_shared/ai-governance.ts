import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AIContext } from "./ai-context.ts";

export interface ScientificConstraint {
  id: string;
  name: string;
  description: string;
  condition_schema: Record<string, any>;
  message: string;
}

/**
 * Evaluates active physical and pedagogical constraints based on DB constraints rules
 * and the user context (e.g. class age group, simulated workload).
 */
export async function resolveAIGovernance(
  supabase: SupabaseClient,
  context: AIContext,
  body: any
): Promise<string[]> {
  const { data: constraints, error } = await supabase
    .from("scientific_constraints")
    .select("id, name, description, condition_schema, message");

  if (error || !constraints) {
    console.error("[AIGovernance Error]: Failed to fetch constraints:", error);
    return [];
  }

  const activeWarnings: string[] = [];

  // 1. Resolve Class Age Group
  let classAge = 99; // Default adult/safe age
  const classId = context.navigation.screen === "class_detail" ? context.navigation.entityId : (body.classId || "");

  if (classId) {
    const { data: classData } = await supabase
      .from("classes")
      .select("category, name")
      .eq("id", classId)
      .maybeSingle();
    
    if (classData) {
      const match = (classData.category || classData.name || "").match(/sub-?(\d+)/i);
      if (match?.[1]) {
        classAge = Number.parseInt(match[1], 10);
      }
    }
  }

  // 2. Resolve Workload Increases
  const simulatedLoadIncrease = Number(body.simulatedLoadIncrease || body.load_increase_pct || 0);

  // 3. Match logical schemas
  for (const c of constraints as ScientificConstraint[]) {
    const schema = c.condition_schema;
    let isTriggered = true;

    // If max_age is defined, condition requires classAge < max_age
    if (schema.max_age !== undefined && classAge >= schema.max_age) {
      isTriggered = false;
    }

    // If max_load_increase_pct is defined, condition requires simulatedLoadIncrease > max_load_increase_pct
    if (schema.max_load_increase_pct !== undefined && simulatedLoadIncrease <= schema.max_load_increase_pct) {
      isTriggered = false;
    }

    if (isTriggered) {
      activeWarnings.push(`- CONSTRAINT ALERT (${c.name}): ${c.message} [Ref: ${c.description}]`);
    }
  }

  return activeWarnings;
}

export function buildSystemAIGovernancePrompt(warnings: string[]): string {
  if (warnings.length === 0) {
    return "SCIENTIFIC_CONSTRAINTS: No active pedagogical or safety constraints triggered.";
  }

  return [
    "SCIENTIFIC_CONSTRAINTS: DANGER/WARNING ATIVADO! O plano do usuário violou limites de segurança biológica ou regras científicas:",
    ...warnings,
    "Regra Obrigatória: Você DEVE incluir estes avisos/restrições científicas na resposta do JSON como um Warning explícito no campo 'reply' ou 'assumptions', explicando pedagogicamente o motivo pelo qual esta alteração de treino deve ser evitada."
  ].join("\n");
}
