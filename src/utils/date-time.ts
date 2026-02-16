const pad2 = (value: number) => String(value).padStart(2, "0");

export const formatDateTimeInputPtBr = (date: Date) => {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}`;
};

export const parseDateTimeInput = (value: string) => {
  const [datePart, timePart] = value.trim().replace("T", " ").split(" ");
  if (!datePart || !timePart) return null;

  let year = 0;
  let month = 0;
  let day = 0;

  if (datePart.includes("/")) {
    const [dayRaw, monthRaw, yearRaw] = datePart.split("/").map(Number);
    day = dayRaw;
    month = monthRaw;
    year = yearRaw;
  } else {
    const [yearRaw, monthRaw, dayRaw] = datePart.split("-").map(Number);
    day = dayRaw;
    month = monthRaw;
    year = yearRaw;
  }

  const [hours, minutes] = timePart.split(":").map(Number);
  if ([year, month, day, hours, minutes].some((item) => !Number.isFinite(item))) {
    return null;
  }

  const next = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(next.getTime()) ? null : next;
};

export const formatIsoDateToPtBr = (value: string) => {
  if (!value) return value;
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  if (year.length !== 4 || month.length < 1 || day.length < 1) return value;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
};
