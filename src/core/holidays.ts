// Fixed national holidays: laws 662/1949, 6802/1980 and 14759/2023.
// Municipal holidays and optional observances require a local calendar.
const holidays: Record<string, string> = {
  "01-01": "Confraternização Universal", "04-21": "Tiradentes",
  "05-01": "Dia do Trabalho", "09-07": "Independência do Brasil",
  "10-12": "Nossa Senhora Aparecida", "11-02": "Finados",
  "11-15": "Proclamação da República", "11-20": "Consciência Negra", "12-25": "Natal",
};
export function brazilDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function nationalHoliday(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return holidays[date.slice(5)] ?? null;
}
export type CalendarPause = { class_id: string; date: string };
export function isPaused(pauses: CalendarPause[], classId: string, date: string) {
  return pauses.some(p => p.class_id === classId && p.date === date);
}
