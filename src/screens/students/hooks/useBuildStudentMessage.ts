import { useCallback } from "react";
import type { ClassGroup, Student } from "../../../core/models";
import {
  calculateNextClassDate,
  formatNextClassDate,
  renderTemplate,
  type WhatsAppTemplateId,
} from "../../../utils/whatsapp-templates";

// Pure helpers (replicated from app/students/index.tsx — no external deps)
const formatStartTimeLabel = (value: string) => {
  const raw = value.trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return raw;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return raw;
  if (minute === 0) return `${hour}h`;
  return `${hour}h${String(minute).padStart(2, "0")}`;
};

const formatTodayLabel = () =>
  new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

export type UseBuildStudentMessageParams = {
  coachName: string;
  groupInviteLinks: Record<string, string>;
  unitLabel: (value: string) => string;
};

export function useBuildStudentMessage({
  coachName,
  groupInviteLinks,
  unitLabel,
}: UseBuildStudentMessageParams) {
  const buildStudentMessage = useCallback(
    (
      student: Student,
      cls: ClassGroup | null,
      templateId: WhatsAppTemplateId,
      fields: Record<string, string>
    ) => {
      const nextClassDate = cls?.daysOfWeek?.length
        ? calculateNextClassDate(cls.daysOfWeek)
        : null;
      return renderTemplate(templateId, {
        coachName,
        studentName: student.name,
        className: cls?.name ?? "Turma",
        unitLabel: unitLabel(cls?.unit ?? ""),
        dateLabel: formatTodayLabel(),
        nextClassDate: nextClassDate ? formatNextClassDate(nextClassDate) : "",
        nextClassTime: cls?.startTime ? formatStartTimeLabel(cls.startTime) : "",
        groupInviteLink: cls ? groupInviteLinks?.[cls.id] ?? "" : "",
        inviteLink: fields.inviteLink ?? "",
        highlightNote: fields.highlightNote ?? "",
        customText: fields.customText ?? "",
      });
    },
    [coachName, groupInviteLinks, unitLabel]
  );

  return { buildStudentMessage };
}
