export const DEFAULT_ORGANIZATION_TIME_ZONE = "America/Sao_Paulo";

const getDateTimeParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return new Map(parts.map((part) => [part.type, part.value]));
};

export function isValidOrganizationTimeZone(value: string | null | undefined) {
  const candidate = String(value ?? "").trim();
  if (!candidate) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function resolveOrganizationTimeZone(value: string | null | undefined) {
  const candidate = String(value ?? "").trim();
  return isValidOrganizationTimeZone(candidate)
    ? candidate
    : DEFAULT_ORGANIZATION_TIME_ZONE;
}

export function toOrganizationIsoDate(
  date: Date,
  timeZoneInput: string | null | undefined,
) {
  const timeZone = resolveOrganizationTimeZone(timeZoneInput);
  const parts = getDateTimeParts(date, timeZone);
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

export function getOrganizationMonthToDatePeriod(
  date: Date,
  timeZoneInput: string | null | undefined,
) {
  const end = toOrganizationIsoDate(date, timeZoneInput);
  return { start: `${end.slice(0, 8)}01`, end };
}

export function formatOrganizationDateTime(
  date: Date,
  timeZoneInput: string | null | undefined,
) {
  const timeZone = resolveOrganizationTimeZone(timeZoneInput);
  const parts = getDateTimeParts(date, timeZone);
  return `${parts.get("day")}/${parts.get("month")}/${parts.get("year")} ${parts.get("hour")}:${parts.get("minute")}:${parts.get("second")}`;
}
