import type { ClassGroup } from "../../../core/models";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

type ClassExportDetails = {
  studentCount?: number;
  teacherName?: string;
};

export type ClassExportDetailsById = Record<string, ClassExportDetails | undefined>;

const escapeIcsText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatIcsLocalDateTime = (date: Date) =>
  `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}T${pad2(
    date.getHours()
  )}${pad2(date.getMinutes())}00`;

const formatIcsUtcDateTime = (date: Date) =>
  `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(
    date.getUTCDate()
  )}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(
    date.getUTCSeconds()
  )}Z`;

const parseTime = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return { hours: 0, minutes: 0 };
  return {
    hours: Math.min(23, Math.max(0, Number(match[1]))),
    minutes: Math.min(59, Math.max(0, Number(match[2]))),
  };
};

const addMinutes = (date: Date, minutes: number) => {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
};

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const resolveScheduleStart = (classGroup: ClassGroup, now: Date) => {
  const parsedCycleStart = /^\d{4}-\d{2}-\d{2}$/.test(classGroup.cycleStartDate)
    ? new Date(`${classGroup.cycleStartDate}T00:00:00`)
    : null;
  const today = startOfLocalDay(now);
  if (!parsedCycleStart || Number.isNaN(parsedCycleStart.getTime())) return today;
  return parsedCycleStart > today ? parsedCycleStart : today;
};

const nextWeekday = (from: Date, targetWeekday: number) => {
  const result = startOfLocalDay(from);
  const delta = (targetWeekday - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + delta);
  return result;
};

const classDaysLabel = (classGroup: ClassGroup) =>
  classGroup.daysOfWeek
    .filter((day) => day >= 0 && day <= 6)
    .map((day) => DAY_LABELS[day])
    .join(", ");

export function buildClassesWorkbookRows(
  classes: ClassGroup[],
  detailsById: ClassExportDetailsById = {}
) {
  return [
    [
      "Turma",
      "Unidade",
      "Modalidade",
      "Gênero",
      "Idade / nível",
      "Dias",
      "Horário",
      "Duração (min)",
      "Alunos",
      "Professor",
    ],
    ...classes.map((classGroup) => {
      const details = detailsById[classGroup.id];
      return [
        classGroup.name,
        classGroup.unit || "Sem unidade",
        classGroup.modality,
        classGroup.gender,
        classGroup.ageBand,
        classDaysLabel(classGroup),
        `${classGroup.startTime} - ${classGroup.endTime}`,
        classGroup.durationMinutes,
        details?.studentCount ?? 0,
        details?.teacherName ?? "Professor não definido",
      ];
    }),
  ];
}

export function buildClassesIcs(classes: ClassGroup[], now = new Date()) {
  const generatedAt = formatIcsUtcDateTime(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//GoAtleta//Agenda de Turmas//PT-BR",
    "X-WR-CALNAME:GoAtleta - Turmas",
  ];

  classes.forEach((classGroup) => {
    const scheduleStart = resolveScheduleStart(classGroup, now);
    const cycleWeeks = Math.max(1, classGroup.cycleLengthWeeks || 52);
    const scheduleEnd = new Date(scheduleStart);
    scheduleEnd.setDate(scheduleEnd.getDate() + cycleWeeks * 7);

    classGroup.daysOfWeek
      .filter((day) => day >= 0 && day <= 6)
      .forEach((day) => {
        const firstDate = nextWeekday(scheduleStart, day);
        const startTime = parseTime(classGroup.startTime);
        firstDate.setHours(startTime.hours, startTime.minutes, 0, 0);
        const endDate = classGroup.endTime
          ? (() => {
              const parsed = parseTime(classGroup.endTime);
              const value = new Date(firstDate);
              value.setHours(parsed.hours, parsed.minutes, 0, 0);
              return value > firstDate
                ? value
                : addMinutes(firstDate, classGroup.durationMinutes || 60);
            })()
          : addMinutes(firstDate, classGroup.durationMinutes || 60);

        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${escapeIcsText(`${classGroup.id}-${day}@goatleta`)}`);
        lines.push(`DTSTAMP:${generatedAt}`);
        lines.push(`DTSTART:${formatIcsLocalDateTime(firstDate)}`);
        lines.push(`DTEND:${formatIcsLocalDateTime(endDate)}`);
        lines.push(`RRULE:FREQ=WEEKLY;UNTIL=${formatIcsUtcDateTime(scheduleEnd)}`);
        lines.push(`SUMMARY:${escapeIcsText(`Aula - ${classGroup.name}`)}`);
        lines.push(`LOCATION:${escapeIcsText(classGroup.unit || "Sem unidade")}`);
        lines.push(
          `DESCRIPTION:${escapeIcsText(
            `${classGroup.modality} · ${classGroup.ageBand} · ${classGroup.gender}`
          )}`
        );
        lines.push("END:VEVENT");
      });
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
