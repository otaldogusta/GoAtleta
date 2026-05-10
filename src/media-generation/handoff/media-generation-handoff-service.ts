import { getActiveOrganizationId } from "../../db/client";
import { buildMediaGenerationRequestId } from "../media-generation-request";
import type { MediaGenerationRequest } from "../media-generation.types";
import {
  buildCoachAvatarPrompt,
  buildExerciseImagePrompt,
  buildExerciseVideoPrompt,
  buildMarketingCardPrompt,
} from "../providers/higgsfield/higgsfield-prompts";
import {
  getMediaGenerationHandoffStore,
  isHydratableMediaGenerationHandoffStore,
} from "./media-generation-handoff-store";
import type {
  MediaGenerationHandoffJob,
  MediaGenerationHandoffJobStatus,
} from "./media-generation-handoff.types";

type CreateMediaGenerationHandoffJobInput = {
  request: MediaGenerationRequest;
  providerId?: string;
};

function now(): string {
  return new Date().toISOString();
}

function buildPrompt(request: MediaGenerationRequest): string {
  switch (request.kind) {
    case "exercise_video":
      return buildExerciseVideoPrompt(request);
    case "exercise_image":
      return buildExerciseImagePrompt(request);
    case "coach_avatar":
      return buildCoachAvatarPrompt(request);
    case "marketing_card":
      return buildMarketingCardPrompt(request);
    default:
      return request.prompt?.trim() || "Gerar mídia aprovada pelo fluxo do GoAtleta.";
  }
}

function buildHandoffJobId(request: MediaGenerationRequest): string {
  return `${buildMediaGenerationRequestId(request)}-handoff-${Date.now()}`;
}

export function listMediaGenerationHandoffJobs(): MediaGenerationHandoffJob[] {
  return getMediaGenerationHandoffStore()
    .list()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getMediaGenerationHandoffJob(id: string): MediaGenerationHandoffJob | null {
  return getMediaGenerationHandoffStore().getById(id);
}

export async function createMediaGenerationHandoffJob(
  input: CreateMediaGenerationHandoffJobInput,
): Promise<MediaGenerationHandoffJob> {
  const timestamp = now();
  const organizationId = await getActiveOrganizationId();
  const job: MediaGenerationHandoffJob = {
    id: buildHandoffJobId(input.request),
    organizationId,
    providerId: input.providerId ?? "higgsfield-mcp",
    status: "pending_agent",
    request: {
      ...input.request,
      requestId: input.request.requestId ?? buildMediaGenerationRequestId(input.request),
    },
    prompt: buildPrompt(input.request),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const store = getMediaGenerationHandoffStore();
  if (isHydratableMediaGenerationHandoffStore(store)) {
    return store.persistUpsert(job);
  }
  return store.upsert(job);
}

export async function updateMediaGenerationHandoffJobStatus(
  id: string,
  status: MediaGenerationHandoffJobStatus,
  extras: Partial<MediaGenerationHandoffJob> = {},
): Promise<MediaGenerationHandoffJob | null> {
  const store = getMediaGenerationHandoffStore();
  const updater = (job: MediaGenerationHandoffJob): MediaGenerationHandoffJob => ({
    ...job,
    ...extras,
    status,
    updatedAt: now(),
    completedAt:
      status === "completed" || status === "failed" || status === "cancelled"
        ? extras.completedAt ?? now()
        : job.completedAt,
  });

  if (isHydratableMediaGenerationHandoffStore(store)) {
    return store.persistUpdate(id, updater);
  }
  return store.update(id, updater);
}

export async function cancelMediaGenerationHandoffJob(
  id: string,
): Promise<MediaGenerationHandoffJob | null> {
  const existing = getMediaGenerationHandoffStore().getById(id);
  if (!existing || existing.status !== "pending_agent") {
    return existing;
  }

  return updateMediaGenerationHandoffJobStatus(id, "cancelled");
}

export function buildMediaGenerationHandoffPayload(job: MediaGenerationHandoffJob): string {
  return JSON.stringify(
    {
      id: job.id,
      providerId: job.providerId,
      status: job.status,
      prompt: job.prompt,
      request: job.request,
      createdAt: job.createdAt,
    },
    null,
    2,
  );
}
