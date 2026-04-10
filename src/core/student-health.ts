import type { Student } from "./models";

export type StudentHealthRiskLevel = "apto" | "atencao" | "revisar";

export type StudentHealthSignal =
  | "health_issue"
  | "medication_use"
  | "health_notes"
  | "cardiovascular_alert"
  | "respiratory_alert"
  | "orthopedic_alert";

export type StudentHealthAssessment = {
  level: StudentHealthRiskLevel;
  label: string;
  signals: StudentHealthSignal[];
  summary: string;
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const severePatterns = [
  /dor no peito/,
  /chest pain/,
  /desmaio/,
  /sincope/,
  /convuls/,
  /arritm/,
  /cardiaco/,
  /falta de ar/,
  /shortness of breath/,
  /hipertens/,
  /pressao alta/,
];

const cautionPatterns = [/dor/, /lesao/, /cirurgia/, /fisioter/, /asma/, /alerg/, /medic/];

const cardiovascularPattern = /dor no peito|chest pain|cardiaco|arritm|pressao alta|hipertens/;
const respiratoryPattern = /falta de ar|shortness of breath|asma|respir/;
const orthopedicPattern = /dor|lesao|cirurgia|fisioter/;

const getPrimaryAlert = (normalizedNotes: string): StudentHealthSignal | null => {
  if (cardiovascularPattern.test(normalizedNotes)) return "cardiovascular_alert";
  if (respiratoryPattern.test(normalizedNotes)) return "respiratory_alert";
  if (orthopedicPattern.test(normalizedNotes)) return "orthopedic_alert";
  return null;
};

export const deriveStudentHealthAssessment = (
  student: Pick<
    Student,
    "healthIssue" | "healthIssueNotes" | "medicationUse" | "medicationNotes" | "healthObservations"
  >
): StudentHealthAssessment => {
  const signals: StudentHealthSignal[] = [];
  const notes = [student.healthIssueNotes, student.medicationNotes, student.healthObservations]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const normalizedNotes = normalizeText(notes.join(" "));

  if (student.healthIssue) signals.push("health_issue");
  if (student.medicationUse) signals.push("medication_use");
  if (notes.length > 0) signals.push("health_notes");

  const hasSevereSignal = severePatterns.some((pattern) => pattern.test(normalizedNotes));
  const hasCautionSignal = cautionPatterns.some((pattern) => pattern.test(normalizedNotes));

  if (hasSevereSignal) {
    const primaryAlert = getPrimaryAlert(normalizedNotes);
    if (primaryAlert) {
      signals.push(primaryAlert);
    }
    return {
      level: "revisar",
      label: "Revisar",
      signals,
      summary: "Sinais de alerta imediato registrados na saude do aluno.",
    };
  }

  if (student.healthIssue || student.medicationUse || hasCautionSignal) {
    const primaryAlert = getPrimaryAlert(normalizedNotes);
    if (primaryAlert) {
      signals.push(primaryAlert);
    }
    return {
      level: "atencao",
      label: "Atencao",
      signals,
      summary: "Ha informacoes de saude registradas para acompanhamento.",
    };
  }

  return {
    level: "apto",
    label: "Apto",
    signals,
    summary: "Sem restricoes de saude informadas.",
  };
};
