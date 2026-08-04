export type StudentContextCategory =
  | "absence"
  | "withdrawal_risk"
  | "health"
  | "logistics"
  | "wellbeing"
  | "return_expected";

export type StudentContextSeverity = "info" | "attention" | "urgent";

export type StudentContextSuggestion = {
  category: StudentContextCategory;
  severity: StudentContextSeverity;
  confidence: "medium" | "high";
  sourceType: "attendance_note" | "pain_score" | "absence_notice";
  title: string;
  summary: string;
  evidence: string;
};

type InterpretAttendanceContextInput = {
  note: string;
  attendanceStatus?: "presente" | "faltou";
  painScore?: number;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const containsAny = (value: string, expressions: RegExp[]) =>
  expressions.some((expression) => expression.test(value));

const WITHDRAWAL_PATTERNS = [
  /\bnao (?:vai |ira )?vir mais\b/,
  /\bnao vem mais\b/,
  /\bnao (?:vai |ira )?voltar\b/,
  /\bparou de (?:vir|frequentar)\b/,
  /\bsaiu da turma\b/,
  /\bdesistiu\b/,
  /\bnao retorna\b/,
];

const HEALTH_PATTERNS = [
  /\bmachuc/,
  /\bles(?:ao|ionad)/,
  /\btorce/,
  /\bdor(?:es)?\b/,
  /\bacidente\b/,
  /\bdoent/,
  /\bfebre\b/,
  /\bmedic/,
];

const WELLBEING_PATTERNS = [
  /\bansios/,
  /\btrist/,
  /\bchor/,
  /\bdesanim/,
  /\bbullying\b/,
  /\bisolad/,
];

const LOGISTICS_PATTERNS = [
  /\bviagem\b/,
  /\btransport/,
  /\bconsulta\b/,
  /\btrabalho\b/,
  /\bescola\b/,
  /\bfamil/,
  /\bcompromisso\b/,
];

const RETURN_PATTERNS = [
  /\bretorna?\b/,
  /\bvolta (?:em|na|no|dia|proxima)\b/,
  /\bprevisao de retorno\b/,
];

export function interpretAttendanceContext(
  input: InterpretAttendanceContextInput
): StudentContextSuggestion | null {
  const note = normalize(input.note ?? "");
  const painScore = Math.max(0, Math.min(3, Number(input.painScore ?? 0)));

  if (note && containsAny(note, WITHDRAWAL_PATTERNS)) {
    return {
      category: "withdrawal_risk",
      severity: "attention",
      confidence: "high",
      sourceType: "attendance_note",
      title: "Possível saída da turma",
      summary: "Confirme se a equipe deve acompanhar a continuidade do aluno.",
      evidence: "Sinal identificado na observação da chamada.",
    };
  }

  if (painScore >= 2 || (note && containsAny(note, HEALTH_PATTERNS))) {
    const urgent = painScore >= 3 || /\b(?:urgente|hospital|emergencia)\b/.test(note);
    return {
      category: "health",
      severity: urgent ? "urgent" : "attention",
      confidence: painScore >= 2 ? "high" : "medium",
      sourceType: painScore >= 2 ? "pain_score" : "attendance_note",
      title: urgent ? "Atenção de saúde prioritária" : "Acompanhamento de saúde",
      summary: "Confirme se este contexto deve ficar visível para a equipe da turma.",
      evidence: painScore >= 2 ? `Dor ${painScore}/3 informada.` : "Sinal identificado na observação da chamada.",
    };
  }

  if (note && containsAny(note, WELLBEING_PATTERNS)) {
    return {
      category: "wellbeing",
      severity: "attention",
      confidence: "medium",
      sourceType: "attendance_note",
      title: "Acompanhamento de bem-estar",
      summary: "Confirme se a equipe deve observar este contexto nas próximas aulas.",
      evidence: "Sinal identificado na observação da chamada.",
    };
  }

  if (note && containsAny(note, RETURN_PATTERNS)) {
    return {
      category: "return_expected",
      severity: "info",
      confidence: "medium",
      sourceType: "attendance_note",
      title: "Retorno informado",
      summary: "Confirme para manter a previsão de retorno visível à equipe.",
      evidence: "Previsão identificada na observação da chamada.",
    };
  }

  if (input.attendanceStatus === "faltou" && note) {
    if (containsAny(note, LOGISTICS_PATTERNS)) {
      return {
        category: "logistics",
        severity: "info",
        confidence: "medium",
        sourceType: "attendance_note",
        title: "Motivo da ausência informado",
        summary: "Confirme para registrar o contexto sem alterar a falta.",
        evidence: "Motivo identificado na observação da chamada.",
      };
    }

    return {
      category: "absence",
      severity: "info",
      confidence: "medium",
      sourceType: "attendance_note",
      title: "Contexto da ausência",
      summary: "Confirme se esta informação deve ficar disponível para a equipe.",
      evidence: "Observação registrada junto à falta.",
    };
  }

  return null;
}
