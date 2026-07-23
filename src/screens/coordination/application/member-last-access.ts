const MONTH_LABELS = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "mai.",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
] as const;

const isSameCalendarDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const formatTime = (value: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);

export const formatMemberLastAccess = (
  value: string | null | undefined,
  now = new Date()
) => {
  if (!value) return "Nunca acessou";

  const accessDate = new Date(value);
  if (Number.isNaN(accessDate.getTime())) return "Nunca acessou";

  const time = formatTime(accessDate);
  if (isSameCalendarDay(accessDate, now)) return `Hoje, ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameCalendarDay(accessDate, yesterday)) return `Ontem, ${time}`;

  const dateLabel = `${String(accessDate.getDate()).padStart(2, "0")} ${
    MONTH_LABELS[accessDate.getMonth()]
  }`;
  return accessDate.getFullYear() === now.getFullYear()
    ? `${dateLabel}, ${time}`
    : `${dateLabel} ${accessDate.getFullYear()}`;
};
