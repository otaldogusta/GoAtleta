import { bootstrapExerciseMediaStore } from "../../exercise-media/bootstrap-exercise-media-store";
import {
  approveExerciseMediaAsset,
  listDraftMediaAssets,
} from "../../exercise-media/exercise-media-approval";
import { resolveExerciseMedia } from "../../exercise-media/resolve-exercise-media";
import type { ExerciseMediaAsset } from "../../exercise-media/exercise-media.types";
import { bootstrapMediaGenerationHandoffStore } from "../../media-generation/handoff/bootstrap-media-generation-handoff-store";
import { createMediaGenerationHandoffJob } from "../../media-generation/handoff/media-generation-handoff-service";
import type { MediaGenerationHandoffJob } from "../../media-generation/handoff/media-generation-handoff.types";
import { HiggsfieldMcpProvider } from "../../media-generation/providers/higgsfield/higgsfield-mcp-provider";
import { createHiggsfieldProvider } from "../../media-generation/providers/higgsfield/higgsfield-provider-factory";
import type { MediaGenerationProvider } from "../../media-generation/media-generation-provider";
import type { MediaGenerationRequest } from "../../media-generation/media-generation.types";
import { enqueueMediaGenerationJob } from "../../media-generation/queue/media-generation-queue";
import type { MediaGenerationJob } from "../../media-generation/queue/media-generation-job.types";
import { processAndRegisterGeneratedMediaJob } from "../../media-generation/register-generated-media-assets";

export type ExerciseMediaGenerateInput = {
  exerciseName: string;
  mediaType: "video" | "image";
  modality?: string;
  sport?: string;
  tags?: string[];
};

export type ExerciseMediaGenerateResult = {
  ok: boolean;
  message: string;
  job: MediaGenerationJob | null;
  registeredAssets: ExerciseMediaAsset[];
  handoffJob: MediaGenerationHandoffJob | null;
};

type GenerateExerciseMediaDraftDeps = {
  createProvider?: () => MediaGenerationProvider;
  bootstrapStore?: () => Promise<void>;
  bootstrapHandoffStore?: () => Promise<void>;
};

function buildRequest(input: ExerciseMediaGenerateInput): MediaGenerationRequest {
  return {
    kind: input.mediaType === "video" ? "exercise_video" : "exercise_image",
    exerciseName: input.exerciseName.trim(),
    title: `Demonstração de ${input.exerciseName.trim()}`,
    modality: input.modality,
    sport: input.sport,
    notes: input.tags?.filter(Boolean),
  };
}

export async function generateExerciseMediaDraft(
  input: ExerciseMediaGenerateInput,
  deps: GenerateExerciseMediaDraftDeps = {},
): Promise<ExerciseMediaGenerateResult> {
  const exerciseName = String(input.exerciseName ?? "").trim();
  if (!exerciseName) {
    return {
      ok: false,
      message: "Informe o nome do exercício.",
      job: null,
      registeredAssets: [],
      handoffJob: null,
    };
  }

  try {
    const bootstrapStore = deps.bootstrapStore ?? bootstrapExerciseMediaStore;
    await bootstrapStore();

    const provider = (deps.createProvider ?? createHiggsfieldProvider)();
    const request = buildRequest({ ...input, exerciseName });

    if (provider instanceof HiggsfieldMcpProvider && !provider.isBridgeAvailable()) {
      const bootstrapHandoffStore =
        deps.bootstrapHandoffStore ?? bootstrapMediaGenerationHandoffStore;
      await bootstrapHandoffStore();

      const handoffJob = await createMediaGenerationHandoffJob({
        request,
        providerId: provider.name,
      });

      return {
        ok: true,
        message: "Pedido aguardando Higgsfield.",
        job: null,
        registeredAssets: [],
        handoffJob,
      };
    }

    const enqueuedJob = enqueueMediaGenerationJob({
      request,
      providerId: provider.name,
    });

    const { job, registeredAssets } = await processAndRegisterGeneratedMediaJob(
      enqueuedJob.id,
      provider,
    );

    if (!job) {
      return {
        ok: false,
        message: "Não foi possível gerar a demonstração.",
        job: null,
        registeredAssets: [],
        handoffJob: null,
      };
    }

    if (job.status !== "completed" || registeredAssets.length === 0) {
      return {
        ok: false,
        message: job.errorMessage ?? job.result?.error ?? "Não foi possível gerar a demonstração.",
        job,
        registeredAssets,
        handoffJob: null,
      };
    }

    return {
      ok: true,
      message: "Demonstração gerada como rascunho.",
      job,
      registeredAssets,
      handoffJob: null,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível gerar a demonstração.",
      job: null,
      registeredAssets: [],
      handoffJob: null,
    };
  }
}

// Helper exports kept local to this layer for lightweight tests around the end-to-end draft flow.
export async function approveGeneratedExerciseMediaAsset(id: string) {
  return approveExerciseMediaAsset(id, { by: "local-dev" });
}

export function resolveGeneratedExerciseMedia(exerciseName: string) {
  return resolveExerciseMedia({
    exerciseName,
    preferredKind: "video",
  });
}

export function listGeneratedDraftMediaAssets() {
  return listDraftMediaAssets();
}
