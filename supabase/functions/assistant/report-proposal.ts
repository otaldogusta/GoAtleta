export type ReportClass = { id: string; name: string };

export type AssistantReportProposal = {
  proposalId: string;
  classId: string;
  className: string;
  sessionDate: string;
  activity: string;
  conclusion: string;
  participantsCount: number | null;
  pse: number | null;
  technique: "boa" | "ok" | "ruim" | "nenhum" | null;
  attendance: number | null;
  painScore: number | null;
  confidence: "high" | "medium" | "low";
  reason: string;
  warnings: string[];
};

const normalizeClassName = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLocaleLowerCase("pt-BR");

const integerOrNull = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value)))
    : null;

export function resolveReportProposal(input: {
  draft: Record<string, unknown> | null | undefined;
  classes: ReportClass[];
  fallbackDate: string;
  proposalId: string;
}): { proposal: AssistantReportProposal | null; missing: string | null } {
  const { draft } = input;
  if (!draft || typeof draft !== "object") return { proposal: null, missing: null };

  const requestedName = normalizeClassName(draft.className);
  const matches = input.classes.filter((item) => normalizeClassName(item.name) === requestedName);
  const matchedClass = matches.length === 1 ? matches[0] : null;
  const activity = String(draft.activity ?? "").trim().slice(0, 4000);
  const conclusion = String(draft.conclusion ?? "").trim().slice(0, 4000);
  if (!matchedClass) {
    return { proposal: null, missing: "Confirme o nome exato da turma para preparar o relatório." };
  }
  if (!activity && !conclusion) {
    return { proposal: null, missing: "Informe o que foi realizado na aula." };
  }

  const requestedDate = String(draft.sessionDate ?? "");
  const technique = String(draft.technique ?? "");
  const confidence = String(draft.confidence ?? "");
  return {
    proposal: {
      proposalId: input.proposalId,
      classId: matchedClass.id,
      className: matchedClass.name,
      sessionDate: /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : input.fallbackDate,
      activity,
      conclusion,
      participantsCount: integerOrNull(draft.participantsCount, 0),
      pse: integerOrNull(draft.pse, 0, 10),
      technique: ["boa", "ok", "ruim", "nenhum"].includes(technique)
        ? technique as AssistantReportProposal["technique"]
        : null,
      attendance: integerOrNull(draft.attendance, 0),
      painScore: integerOrNull(draft.painScore, 0, 10),
      confidence: ["high", "medium", "low"].includes(confidence)
        ? confidence as AssistantReportProposal["confidence"]
        : "low",
      reason: String(draft.reason ?? "Relato da aula enviado ao Assistente.").trim().slice(0, 500),
      warnings: Array.isArray(draft.warnings)
        ? draft.warnings.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
        : [],
    },
    missing: null,
  };
}
