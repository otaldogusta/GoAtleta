export const LESSON_DOCUMENT_TEXT_KEYS = [
  "documentTitle", "professor", "class", "week", "date", "time", "periodization", "context",
  "labelProfessor", "labelClass", "labelWeek", "labelDate", "labelTime", "labelPeriodization", "labelContext",
  "labelGeneralObjective", "labelSpecificObjective", "labelSituationProblem", "labelObservations",
  "columnPeriod", "columnActivities", "columnTime", "columnDescription",
  "periodWarmup", "periodMain", "periodCooldown",
] as const;

export function lessonDocumentText(values: Record<string, string> | undefined, key: string, fallback: string) {
  return typeof values?.[key] === "string" ? values[key] : fallback;
}

export function isLessonDocumentTextKey(key: string) {
  return (LESSON_DOCUMENT_TEXT_KEYS as readonly string[]).includes(key);
}
