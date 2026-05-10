import { bootstrapExerciseMediaStore } from "../exercise-media/bootstrap-exercise-media-store";
import { resolveExerciseMedia } from "../exercise-media/resolve-exercise-media";
import { generateQrDataUri } from "./qr-code";
import type {
  SessionBlock,
  SessionPlanActivity,
  SessionPlanPdfData,
} from "./templates/session-plan";

async function enrichActivity(
  activity: SessionPlanActivity
): Promise<SessionPlanActivity> {
  const name = String(activity?.name ?? "").trim();
  if (!name) {
    return activity;
  }

  const result = resolveExerciseMedia({
    exerciseName: name,
    preferredKind: "video",
  });

  const uri = String(result.asset?.uri ?? "").trim();
  if (!uri) {
    return activity;
  }

  const demoQrDataUri = await generateQrDataUri(uri);
  if (!demoQrDataUri) {
    return activity;
  }

  return {
    ...activity,
    demoUrl: uri,
    demoQrDataUri,
    demoLabel: "Demonstração",
  };
}

async function enrichBlock(block: SessionBlock): Promise<SessionBlock> {
  const activities = Array.isArray(block.activities) ? block.activities : null;
  const items = Array.isArray(block.items) ? block.items : null;

  if (!activities && !items) {
    return block;
  }

  const source = activities ?? items ?? [];
  const enriched = await Promise.all(source.map((item) => enrichActivity(item)));

  if (activities) {
    return {
      ...block,
      activities: enriched,
    };
  }

  return {
    ...block,
    items: enriched,
  };
}

export async function enrichSessionPlanWithMedia(
  data: SessionPlanPdfData
): Promise<SessionPlanPdfData> {
  await bootstrapExerciseMediaStore();

  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  if (!blocks.length) {
    return data;
  }

  const enrichedBlocks = await Promise.all(blocks.map((block) => enrichBlock(block)));

  return {
    ...data,
    blocks: enrichedBlocks,
  };
}
