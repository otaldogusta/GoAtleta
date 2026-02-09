/**
 * Formata tempo de duração (MM:SS) para exibição legível
 * @param time - Formato MM:SS (ex: "10:00", "05:30")
 * @returns String formatada (ex: "10min", "5min30s")
 */
export function formatDuration(time: string): string {
  if (!time || !time.includes(":")) return time;
  
  const [minutes, seconds] = time.split(":").map((n) => parseInt(n, 10));
  
  if (isNaN(minutes) || isNaN(seconds)) return time;
  
  if (minutes === 0 && seconds === 0) return "0min";
  if (seconds === 0) return `${minutes}min`;
  if (minutes === 0) return `${seconds}s`;
  
  return `${minutes}min${seconds}s`;
}

/**
 * Formata tempo de horário/clock (HH:MM) para exibição legível
 * @param time - Formato HH:MM (ex: "01:30", "00:45")
 * @returns String formatada (ex: "1h30min", "45min")
 */
export function formatClock(time: string): string {
  if (!time || !time.includes(":")) return time;
  
  const [hours, minutes] = time.split(":").map((n) => parseInt(n, 10));
  
  if (isNaN(hours) || isNaN(minutes)) return time;
  
  if (hours === 0 && minutes === 0) return "0min";
  if (minutes === 0) return `${hours}h`;
  if (hours === 0) return `${minutes}min`;
  
  return `${hours}h${minutes}min`;
}
