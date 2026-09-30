/** Client selection and provisional choices only. Official facts are resolved server-side. */
export type PlanningSelection = {
  month: string;
  weekId?: string;
  weekNumber?: number;
  lessonDate?: string;
  lessonId?: string;
  cycleId?: string;
};
export type PlanningAssistantContext = {
  version: 1;
  classId: string;
  selection: PlanningSelection;
  surface: "workspace" | "editor" | "lesson";
  step?: string;
  draft: Record<string, string | number | number[] | string[]> | null;
};
export type PlanningResponseDetails = {
  selection: PlanningSelection;
  window: { start: string; end: string };
  sample: "insufficient" | "available";
  sources: { table: string; status: "available" | "absent" | "unavailable"; count: number }[];
};
export function planningResponseDetailsText(context: PlanningAssistantContext, details?: PlanningResponseDetails) {
  const selection = context.selection;
  const lines = [`Mês: ${selection.month}`, selection.weekNumber ? `Semana: ${selection.weekNumber}` : "", selection.lessonDate ? `Aula: ${selection.lessonDate.split("-").reverse().join("/")}` : "", context.step ? `Etapa: ${context.step}` : ""];
  if (details) {
    lines.push(`Histórico: ${details.window.start.slice(0, 10).split("-").reverse().join("/")} a ${details.window.end.slice(0, 10).split("-").reverse().join("/")}`);
    if (details.sample === "insufficient") lines.push("Poucas aulas realizadas para avaliar tendências.");
    const labels: Record<string, string> = { classes: "Cadastro da turma", class_pedagogical_profiles: "Perfil confirmado", planning_cycles: "Ciclo", class_calendar_exceptions: "Pausas", session_logs: "Relatórios", scouting_sessions: "Sessões de scouting", scouting_actions: "Scouting agregado", training_session_classes: "Vínculos de aulas", training_sessions: "Aulas realizadas", training_session_attendance: "Presença agregada", class_competitive_profiles: "Competição", class_plans: "Semanas planejadas", training_plans: "Plano da aula" };
    for (const source of details.sources) lines.push(`${source.table === "scouting_logs" ? "Scouting da turma" : labels[source.table] ?? "Fonte de planejamento"}: ${source.status === "available" ? "disponível" : source.status === "absent" ? "sem registros" : "leitura indisponível"}`);
  }
  return lines.filter(Boolean).join("\n");
}
const fields = ["goal", "mvLevel", "daysOfWeek", "startTime", "durationMinutes", "cycleStartDate", "cycleLengthWeeks", "loadModel", "recoveryWeeks", "intensityMin", "intensityMax", "gameLevel", "netHeightMeters", "competitionContext", "title", "warmup", "main", "cooldown"];
export function buildPlanningAssistantContext(input: Omit<PlanningAssistantContext, "version" | "draft"> & { draft?: unknown }): PlanningAssistantContext {
  const source = input.draft && typeof input.draft === "object" ? input.draft as Record<string, unknown> : {};
  const draft: NonNullable<PlanningAssistantContext["draft"]> = {};
  for (const field of fields) {
    const value = source[field];
    if (typeof value === "string") draft[field] = value.slice(0, 2000);
    else if (typeof value === "number" && Number.isFinite(value)) draft[field] = value;
    else if (Array.isArray(value) && value.every(v => typeof v === "number")) draft[field] = value.slice(0, 30);
    else if (Array.isArray(value) && value.every(v => typeof v === "string")) draft[field] = value.slice(0, 30).map(v => v.slice(0, 500));
  }
  return { version: 1, classId: input.classId, selection: { ...input.selection }, surface: input.surface, step: input.step, draft: Object.keys(draft).length ? draft : null };
}
export function planningConversationKey(userId: string, organizationId: string, classId: string) {
  return JSON.stringify(["planning", userId, organizationId, classId]);
}
