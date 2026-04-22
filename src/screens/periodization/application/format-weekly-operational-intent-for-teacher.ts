import type { WeeklyOperationalStrategySnapshot } from "../../../core/models";

export type WeeklyOperationalTeacherIntent = {
  title: string;
  summary: string;
  teacherNotes: string[];
};

const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const roleLabel = (value: string) => {
  switch (value) {
    case "introducao_exploracao":
      return "explorar com orientacao";
    case "retomada_consolidacao":
      return "retomar e consolidar";
    case "consolidacao_orientada":
      return "consolidar com progressao";
    case "pressao_decisao":
      return "aumentar decisao sob pressao";
    case "transferencia_jogo":
      return "aplicar no jogo reduzido";
    case "sintese_fechamento":
      return "sintetizar e fechar";
    default:
      return "consolidar com progressao";
  }
};

const quarterMomentLabel = (value: WeeklyOperationalStrategySnapshot["diagnostics"]["quarter"]) => {
  if (value === "Q1") return "início do ciclo";
  if (value === "Q2") return "fase de desenvolvimento";
  if (value === "Q3") return "fase de aplicação";
  if (value === "Q4") return "fechamento do ciclo";
  return "momento em definição";
};

const closingTypeLabel = (
  value: WeeklyOperationalStrategySnapshot["diagnostics"]["closingType"]
) => {
  if (value === "exploracao") return "exploração guiada";
  if (value === "consolidacao") return "consolidação";
  if (value === "aplicacao") return "aplicação";
  if (value === "fechamento") return "síntese e fechamento";
  return "fechamento em definição";
};

const deriveTitle = (snapshot: WeeklyOperationalStrategySnapshot): string => {
  if (snapshot.diagnostics.closingType === "fechamento") {
    return "Semana de fechamento trimestral com síntese aplicada";
  }
  const hasPressure = snapshot.decisions.some(
    (decision) => decision.sessionRole === "pressao_decisao"
  );
  if (hasPressure) {
    return "Semana de consolidacao com aumento de exigencia";
  }
  const hasReviewLock = snapshot.weekRulesApplied.includes("recent_history_review_lock");
  if (hasReviewLock) {
    return "Semana de consolidacao guiada";
  }
  return "Semana de progressao pedagogica controlada";
};

const deriveSummary = (snapshot: WeeklyOperationalStrategySnapshot): string => {
  const roleSummary = snapshot.decisions
    .slice(0, 3)
    .map((decision) => `S${decision.sessionIndexInWeek} ${roleLabel(decision.sessionRole)}`)
    .join(", ");
  if (!roleSummary) {
    return "A semana organiza uma progressao clara entre as sessoes.";
  }
  return `Momento do ciclo: ${quarterMomentLabel(snapshot.diagnostics.quarter)}. Fechamento da semana: ${closingTypeLabel(snapshot.diagnostics.closingType)}. ${snapshot.quarterFocus} Distribuicao da semana: ${roleSummary}.`;
};

const driftRiskNote = (risk: string): string | null => {
  if (risk === "salto_para_formal_6x6") {
    return "Evitar salto para 6x6 formal antes da etapa adequada.";
  }
  if (risk === "complexidade_alta_precoce_08_10") {
    return "Evitar aumento precoce de complexidade na faixa 08-10.";
  }
  if (risk === "linguagem_adulta_precoce_11_12") {
    return "Manter linguagem de quadra adequada para 11-12.";
  }
  if (risk === "perda_da_ponte_funcional_13_14") {
    return "Preservar a ponte funcional do mini 4x4 na faixa 13-14.";
  }
  return null;
};

const deriveTeacherNotes = (snapshot: WeeklyOperationalStrategySnapshot): string[] => {
  const roleNotes = snapshot.decisions.map((decision) =>
    `Sessao ${decision.sessionIndexInWeek}: ${roleLabel(decision.sessionRole)}.`
  );

  const reviewNote = snapshot.weekRulesApplied.includes("recent_history_review_lock")
    ? "Comecar com orientacoes curtas e foco em consolidacao antes de acelerar."
    : null;

  const loadNote = snapshot.weekRulesApplied.includes("load_contrast_preserved")
    ? "Preservar contraste de carga sem perder controle tecnico."
    : "Manter progressao de exigencia sem salto brusco de complexidade.";

  const closingNote = snapshot.weekRulesApplied.includes("quarterly_closing_alignment")
    ? "Fechar a semana com tarefa de sintese ou aplicacao em jogo reduzido."
    : null;

  const quarterNote =
    snapshot.diagnostics.quarter === "Q1"
      ? "No início do ciclo, priorize clareza de regra e execução estável."
      : snapshot.diagnostics.quarter === "Q4"
        ? "No fechamento do ciclo, priorize síntese com critério de êxito explícito."
        : "Conectar cada sessão ao objetivo semanal antes de subir complexidade.";

  const riskNotes = snapshot.diagnostics.driftRisks
    .map(driftRiskNote)
    .filter((note): note is string => Boolean(note));

  return uniqueStrings([...roleNotes, reviewNote, loadNote, closingNote, quarterNote, ...riskNotes]).slice(0, 5);
};

export const parseWeeklyOperationalStrategySnapshot = (
  rawJson: string | undefined
): WeeklyOperationalStrategySnapshot | null => {
  const raw = String(rawJson ?? "").trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      weeklyOperationalStrategy?: WeeklyOperationalStrategySnapshot;
    };
    const snapshot = parsed.weeklyOperationalStrategy;
    if (!snapshot || !Array.isArray(snapshot.decisions)) return null;
    if (!Array.isArray(snapshot.weekRulesApplied)) return null;
    return snapshot;
  } catch {
    return null;
  }
};

export const formatWeeklyOperationalIntentForTeacher = (
  snapshot: WeeklyOperationalStrategySnapshot | null
): WeeklyOperationalTeacherIntent | null => {
  if (!snapshot) return null;

  return {
    title: deriveTitle(snapshot),
    summary: deriveSummary(snapshot),
    teacherNotes: deriveTeacherNotes(snapshot),
  };
};
