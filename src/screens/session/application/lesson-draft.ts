import type { TrainingPlan } from "../../../core/models";

export type LessonDraft = Pick<TrainingPlan, "title" | "tags" | "warmup" | "main" | "cooldown" | "warmupTime" | "mainTime" | "cooldownTime">;

export function parseLessonDraft(value: unknown): LessonDraft | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.title !== "string" || !row.title.trim() || row.title.length > 180) return null;
  for (const key of ["warmup", "main", "cooldown"] as const) {
    const items = row[key];
    if (!Array.isArray(items) || !items.length || items.length > 12 ||
      items.some(item => typeof item !== "string" || !item.trim() || item.length > 1600)) return null;
  }
  let total = 0;
  for (const key of ["warmupTime", "mainTime", "cooldownTime"] as const) {
    if (typeof row[key] !== "string" || !/^\d{1,3}\s*(min(?:utos?)?)?$/.test(row[key].trim())) return null;
    const minutes = parseInt(row[key], 10);
    if (minutes < 1 || minutes > 180) return null;
    total += minutes;
  }
  if (total > 240) return null;
  return {
    title: row.title.trim(), tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 10) : [],
    warmup: [...row.warmup as string[]], main: [...row.main as string[]], cooldown: [...row.cooldown as string[]],
    warmupTime: `${parseInt(row.warmupTime as string, 10)} min`,
    mainTime: `${parseInt(row.mainTime as string, 10)} min`,
    cooldownTime: `${parseInt(row.cooldownTime as string, 10)} min`,
  };
}
