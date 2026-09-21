import type { ReportClass } from "./report-proposal.ts";

export type AssistantClassMemoryProposal = {
  proposalId: string;
  classId: string;
  className: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  warnings: string[];
};

const normalize = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLocaleLowerCase("pt-BR");

const RECURRING_CUE = /\b(sempre|toda?s?|todo?s?|cada|regra|rotina|costum(?:a|am)|ultima aula do mes|última aula do mês)\b/i;

export function resolveClassMemoryProposal(input: {
  draft: Record<string, unknown> | null | undefined;
  classes: ReportClass[];
  proposalId: string;
  sourceText: string;
}): AssistantClassMemoryProposal | null {
  if (!input.draft || !RECURRING_CUE.test(input.sourceText)) return null;
  const requestedName = normalize(input.draft.className);
  const matches = input.classes.filter((item) => normalize(item.name) === requestedName);
  if (matches.length !== 1) return null;
  const summary = String(input.draft.summary ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (summary.length < 8) return null;
  const confidence = String(input.draft.confidence ?? "");
  return {
    proposalId: input.proposalId,
    classId: matches[0].id,
    className: matches[0].name,
    summary,
    confidence: ["high", "medium", "low"].includes(confidence)
      ? confidence as AssistantClassMemoryProposal["confidence"]
      : "medium",
    reason: String(input.draft.reason ?? "Regra recorrente informada pelo professor.").trim().slice(0, 300),
    warnings: Array.isArray(input.draft.warnings)
      ? input.draft.warnings.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
      : [],
  };
}
