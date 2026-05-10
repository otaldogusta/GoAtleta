import type {
  MediaGenerationHandoffJob,
  MediaGenerationHandoffJobUpdater,
  MediaGenerationHandoffStore,
} from "../media-generation-handoff.types";

function cloneRequest<T extends object | undefined>(value: T): T {
  if (!value) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneJob(job: MediaGenerationHandoffJob): MediaGenerationHandoffJob {
  return {
    ...job,
    request: cloneRequest(job.request),
    resultPayload: cloneRequest(job.resultPayload ?? undefined) ?? null,
  };
}

export class InMemoryMediaGenerationHandoffStore
  implements MediaGenerationHandoffStore
{
  readonly kind = "memory" as const;

  constructor(private jobs: MediaGenerationHandoffJob[] = []) {}

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
    this.jobs = [];
  }
}
