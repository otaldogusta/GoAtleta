export function familyCandidateSchedule(candidate: { class_name: string; class_days?: number[] | null; class_start_time?: string | null }) {
  const labels = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const days = [...new Set(candidate.class_days ?? [])].filter(day => Number.isInteger(day) && day >= 0 && day <= 6).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(day => labels[day]);
  const dayText = days.length > 1 ? `${days.slice(0, -1).join(", ")} e ${days[days.length - 1]}` : days[0];
  const match = candidate.class_start_time?.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  const time = match ? `${Number(match[1])}h${match[2] === "00" ? "" : match[2]}` : null;
  return [candidate.class_name, [dayText, time].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
}
