import type { DailyLessonPlan, LessonActivity, LessonBlock } from "../../../core/models";
import { summarizeLessonActivity, type LessonBlockType } from "../../../pdf/summarize-lesson-activity";
import { getLessonBlockTimes } from "../../../utils/lesson-block-times";

const BLOCK_META: Array<{ key: LessonBlock["key"]; label: string; fallbackDuration: number }> = [
  { key: "warmup", label: "Aquecimento", fallbackDuration: 10 },
  { key: "main", label: "Parte principal", fallbackDuration: 45 },
  { key: "cooldown", label: "Volta à calma", fallbackDuration: 5 },
];

const safeText = (value: unknown) => String(value ?? "").trim();

const makeActivity = (description: string, blockType: LessonBlockType): LessonActivity => ({
  id: `legacy_${blockType}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  name: summarizeLessonActivity(description, blockType),
  description,
});

const parseBlocksJson = (value: string | undefined): LessonBlock[] | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;

    const blocks: LessonBlock[] = parsed
      .map((raw): LessonBlock | null => {
        const key = raw?.key;
        if (key !== "warmup" && key !== "main" && key !== "cooldown") return null;
        const activities = Array.isArray(raw?.activities)
          ? raw.activities
              .map((item: unknown) => {
                const maybe = item as { id?: string; name?: string; description?: string };
                const name = safeText(maybe?.name);
                const description = safeText(maybe?.description);
                if (!name && !description) return null;
                return {
                  id: safeText(maybe?.id) || undefined,
                  name: name || summarizeLessonActivity(description, key),
                  description,
                } as LessonActivity;
              })
              .filter((item: LessonActivity | null): item is LessonActivity => Boolean(item))
          : [];

        const fallbackMeta = BLOCK_META.find((item) => item.key === key);
        return {
          key,
          label: safeText(raw?.label) || fallbackMeta?.label || key,
          durationMinutes:
            Number.isFinite(raw?.durationMinutes) && Number(raw.durationMinutes) > 0
              ? Math.round(Number(raw.durationMinutes))
              : fallbackMeta?.fallbackDuration || 0,
          activities,
        };
      })
      .filter((item: LessonBlock | null): item is LessonBlock => Boolean(item));

    return blocks.length ? blocks : null;
  } catch {
    return null;
  }
};

export const buildFallbackLessonBlocks = (params: {
  warmup: string;
  mainPart: string;
  cooldown: string;
  durationMinutes?: number;
}): LessonBlock[] => {
  const warmup = safeText(params.warmup);
  const mainPart = safeText(params.mainPart);
  const cooldown = safeText(params.cooldown);
  const blockTimes = getLessonBlockTimes(params.durationMinutes ?? 60);

  return [
    {
      key: "warmup",
      label: "Aquecimento",
      durationMinutes: blockTimes.warmupMinutes,
      activities: warmup ? [makeActivity(warmup, "warmup")] : [],
    },
    {
      key: "main",
      label: "Parte principal",
      durationMinutes: blockTimes.mainMinutes,
      activities: mainPart ? [makeActivity(mainPart, "main")] : [],
    },
    {
      key: "cooldown",
      label: "Volta à calma",
      durationMinutes: blockTimes.cooldownMinutes,
      activities: cooldown ? [makeActivity(cooldown, "cooldown")] : [],
    },
  ];
};

export const resolveLessonBlocksFromDailyPlan = (
  plan: Pick<DailyLessonPlan, "warmup" | "mainPart" | "cooldown" | "blocksJson">,
  durationMinutes?: number
): LessonBlock[] => {
  const parsed = parseBlocksJson(plan.blocksJson);
  const blockTimes = getLessonBlockTimes(durationMinutes ?? 60);
  if (parsed) {
    const byKey = new Map(parsed.map((block) => [block.key, block]));
    return BLOCK_META.map((meta) => byKey.get(meta.key) ?? {
      key: meta.key,
      label: meta.label,
      durationMinutes:
        meta.key === "warmup"
          ? blockTimes.warmupMinutes
          : meta.key === "main"
            ? blockTimes.mainMinutes
            : blockTimes.cooldownMinutes,
      activities: [],
    });
  }

  return buildFallbackLessonBlocks({
    warmup: plan.warmup,
    mainPart: plan.mainPart,
    cooldown: plan.cooldown,
    durationMinutes,
  });
};

export const serializeLessonBlocks = (blocks: LessonBlock[]): string =>
  JSON.stringify(
    blocks.map((block) => ({
      key: block.key,
      label: safeText(block.label),
      durationMinutes:
        Number.isFinite(block.durationMinutes) && block.durationMinutes > 0
          ? Math.round(block.durationMinutes)
          : 0,
      activities: (block.activities ?? [])
        .map((activity) => ({
          id: safeText(activity.id) || undefined,
          name: safeText(activity.name),
          description: safeText(activity.description),
        }))
        .filter((activity) => activity.name || activity.description),
    }))
  );

export const deriveLegacyDailySections = (blocks: LessonBlock[]) => {
  const find = (key: LessonBlock["key"]) => blocks.find((block) => block.key === key);

  const toSection = (key: LessonBlock["key"]) => {
    const block = find(key);
    if (!block) return "";
    const descriptions = (block.activities ?? [])
      .map((item) => safeText(item.description))
      .filter(Boolean);
    if (descriptions.length) return descriptions.join("\n");

    return (block.activities ?? [])
      .map((item) => safeText(item.name))
      .filter(Boolean)
      .join("\n");
  };

  return {
    warmup: toSection("warmup"),
    mainPart: toSection("main"),
    cooldown: toSection("cooldown"),
  };
};
