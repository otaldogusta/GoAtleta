import { supabaseGet, supabasePost } from "../../../db/client";
import type {
  HydratableMediaGenerationHandoffStore,
  MediaGenerationHandoffJob,
  MediaGenerationHandoffJobUpdater,
} from "../media-generation-handoff.types";

type MediaGenerationHandoffJobRow = {
  id: string;
  organization_id: string | null;
  provider_id: string;
  status: MediaGenerationHandoffJob["status"];
  request: MediaGenerationHandoffJob["request"];
  prompt: string;
  error_message: string | null;
  result_asset_uri: string | null;
  result_thumbnail_uri: string | null;
  result_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

function cloneJob(job: MediaGenerationHandoffJob): MediaGenerationHandoffJob {
  return JSON.parse(JSON.stringify(job)) as MediaGenerationHandoffJob;
}

function fromRow(row: MediaGenerationHandoffJobRow): MediaGenerationHandoffJob {
  return {
    id: row.id,
    organizationId: row.organization_id,
    providerId: row.provider_id,
    status: row.status,
    request: row.request,
    prompt: row.prompt,
    errorMessage: row.error_message ?? undefined,
    resultAssetUri: row.result_asset_uri ?? undefined,
    resultThumbnailUri: row.result_thumbnail_uri ?? undefined,
    resultPayload: row.result_payload ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  };
}

function toRow(job: MediaGenerationHandoffJob): MediaGenerationHandoffJobRow {
  return {
    id: job.id,
    organization_id: job.organizationId ?? null,
    provider_id: job.providerId,
    status: job.status,
    request: job.request,
    prompt: job.prompt,
    error_message: job.errorMessage ?? null,
    result_asset_uri: job.resultAssetUri ?? null,
    result_thumbnail_uri: job.resultThumbnailUri ?? null,
    result_payload: job.resultPayload ?? null,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    completed_at: job.completedAt ?? null,
  };
}

export class SupabaseMediaGenerationHandoffStore
  implements HydratableMediaGenerationHandoffStore
{
  readonly kind = "supabase" as const;

  private jobs: MediaGenerationHandoffJob[] = [];

  list(): MediaGenerationHandoffJob[] {
    return this.jobs.map(cloneJob);
  }

  getById(id: string): MediaGenerationHandoffJob | null {
    const job = this.jobs.find((entry) => entry.id === id);
    return job ? cloneJob(job) : null;
  }

  upsert(job: MediaGenerationHandoffJob): MediaGenerationHandoffJob {
    const index = this.jobs.findIndex((entry) => entry.id === job.id);
    if (index < 0) {
      this.jobs = [cloneJob(job), ...this.jobs];
      return cloneJob(job);
    }

    this.jobs[index] = cloneJob(job);
    return cloneJob(this.jobs[index]);
  }

  update(
    id: string,
    updater: MediaGenerationHandoffJobUpdater,
  ): MediaGenerationHandoffJob | null {
    const index = this.jobs.findIndex((entry) => entry.id === id);
    if (index < 0) {
      return null;
    }

    const next = updater(cloneJob(this.jobs[index]));
    this.jobs[index] = cloneJob(next);
    return cloneJob(this.jobs[index]);
  }

  reset(): void {
    // Real store: no destructive reset.
  }

  async hydrate(): Promise<void> {
    const rows = await supabaseGet<MediaGenerationHandoffJobRow[]>(
      "/media_generation_handoff_jobs?select=*&order=created_at.desc",
    );
    this.jobs = rows.map(fromRow);
  }

  async persistUpsert(job: MediaGenerationHandoffJob): Promise<MediaGenerationHandoffJob> {
    const rows = await supabasePost<MediaGenerationHandoffJobRow[]>(
      "/media_generation_handoff_jobs",
      [toRow(job)],
      {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    );

    const persisted = fromRow(rows[0] ?? toRow(job));
    return this.upsert(persisted);
  }

  async persistUpdate(
    id: string,
    updater: MediaGenerationHandoffJobUpdater,
  ): Promise<MediaGenerationHandoffJob | null> {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    return this.persistUpsert(updater(existing));
  }
}
