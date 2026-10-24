export function calendarReturnRoute(source: unknown, date: unknown, unit: unknown) {
  if (source !== "prof" && source !== "shared") return null;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(date + "T12:00:00Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return {
    pathname: source === "prof" ? "/prof/calendar" as const : "/calendar" as const,
    params: { targetDate: date, ...(typeof unit === "string" ? { unit } : {}) },
  };
}
