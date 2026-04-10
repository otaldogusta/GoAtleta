/**
 * WhatsApp Message Templates
 * Contextual pre-filled messages for common scenarios
 */

export type WhatsAppTemplateId =
  | "absent_today"
  | "class_reminder"
  | "group_invite"
  | "positive_feedback"
  | "quick_notice"
  | "student_invite";

export interface WhatsAppTemplate {
  id: WhatsAppTemplateId;
  title: string;
  body: string;
  requires?: string[];
}

export const WHATSAPP_TEMPLATES: Record<WhatsAppTemplateId, WhatsAppTemplate> = {
  absent_today: {
    id: "absent_today",
    title: "Faltou hoje",
    body: "Olá! Aqui é o prof. {coachName}.\nHoje ({dateLabel}) tivemos aula da turma {className} ({unitLabel}) e sentimos falta do(a) {studentName}.\nPodemos contar com a presença na próxima aula 🙂",
  },
  class_reminder: {
    id: "class_reminder",
    title: "Lembrete de aula",
    body: "Olá! Aqui é o prof. {coachName}.\nLembrando que a turma {className} ({unitLabel}) tem aula em {nextClassDate} às {nextClassTime}.\nAté lá! ✅",
    requires: ["nextClassDate", "nextClassTime"],
  },
  group_invite: {
    id: "group_invite",
    title: "Convite para grupo",
    body: "Olá! Aqui é o prof. {coachName}.\nCriamos o grupo da turma {className} ({unitLabel}).\nEntre pelo link: {groupInviteLink}",
    requires: ["groupInviteLink"],
  },
  positive_feedback: {
    id: "positive_feedback",
    title: "Parabéns / Feedback",
    body: "Olá! Aqui é o prof. {coachName}.\nParabéns ao {studentName}! Hoje ({dateLabel}) ele(a) foi muito bem na turma {className}.\nDestaque: {highlightNote}. 👏",
    requires: ["highlightNote"],
  },
  quick_notice: {
    id: "quick_notice",
    title: "Aviso rápido",
    body: "Olá! Aqui é o prof. {coachName}.\nAviso da turma {className} ({unitLabel}): {customText}",
    requires: ["customText"],
  },
  student_invite: {
    id: "student_invite",
    title: "Convite do aluno",
    body:
      "*Convite GoAtleta*\nSeu treinador te convidou para acessar seus treinos.\n\nAluno: *{studentName}*\n\nLink de acesso:\n{inviteLink}\n\n_Se você já tem conta, é só entrar com este link._",
    requires: ["inviteLink"],
  },
};

export interface TemplatePlaceholders {
  coachName?: string;
  className?: string;
  unitLabel?: string;
  dateLabel?: string;
  studentName?: string;
  nextClassDate?: string;
  nextClassTime?: string;
  groupInviteLink?: string;
  inviteLink?: string;
  highlightNote?: string;
  customText?: string;
}

/**
 * Renders a template with placeholders replaced
 * Uses safe fallbacks to avoid empty placeholders
 */
export function renderTemplate(
  templateId: WhatsAppTemplateId,
  placeholders: TemplatePlaceholders
): string {
  const template = WHATSAPP_TEMPLATES[templateId];
  let result = template.body;

  // Safe fallbacks for required fields
  const safeValues = {
    coachName: placeholders.coachName || "Professor",
    className: placeholders.className || "Turma",
    unitLabel: placeholders.unitLabel || "",
    dateLabel: placeholders.dateLabel || "hoje",
    studentName: placeholders.studentName || "aluno(a)",
    nextClassDate: placeholders.nextClassDate || "",
    nextClassTime: placeholders.nextClassTime || "",
    groupInviteLink: placeholders.groupInviteLink || "",
    inviteLink: placeholders.inviteLink || "",
    highlightNote: placeholders.highlightNote || "esforço e evolução",
    customText: placeholders.customText || "",
  };

  // Replace all placeholders with safe values
  Object.entries(safeValues).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  });

  // Clean up any remaining unreplaced placeholders (shouldn't happen)
  result = result.replace(/\{[^}]+\}/g, "");

  return result;
}

/**
 * Get suggested template based on context
 */
export type WhatsAppContext =
  | { screen: "attendance"; attendanceStatus: "present" | "absent" }
  | { screen: "class" }
  | { screen: "session_report" };

const normalizeDateStart = (value: Date) => {
  const normalized = new Date(value);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const getSortedClassDays = (daysOfWeek: number[]) =>
  [...new Set(daysOfWeek.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort(
    (a, b) => a - b
  );

export function getSuggestedTemplate(context: WhatsAppContext): WhatsAppTemplateId {
  switch (context.screen) {
    case "attendance":
      return context.attendanceStatus === "absent" ? "absent_today" : "positive_feedback";
    case "class":
      return "class_reminder";
    case "session_report":
      return "positive_feedback";
    default:
      return "quick_notice";
  }
}

/**
 * Calculate previous/next class date from a reference day.
 */
export function calculateAdjacentClassDate(
  daysOfWeek: number[],
  referenceDate: Date,
  direction: -1 | 1
): Date | null {
  const sortedDays = getSortedClassDays(daysOfWeek);
  if (!sortedDays.length) return null;

  const base = normalizeDateStart(referenceDate);

  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = new Date(base);
    candidate.setDate(base.getDate() + offset * direction);
    if (sortedDays.includes(candidate.getDay())) {
      return candidate;
    }
  }

  return null;
}

/**
 * Calculate next class date based on days of week
 */
export function calculateNextClassDate(daysOfWeek: number[]): Date | null {
  return calculateAdjacentClassDate(daysOfWeek, new Date(), 1);
}

/**
 * Format date for display (e.g., "segunda, 20/01")
 */
export function formatNextClassDate(date: Date): string {
  const days = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const dayName = days[date.getDay()];
  const dayNum = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${dayName}, ${dayNum}/${month}`;
}
