type Result<T> = { data: T | null; error: { code?: string; message?: string } | null };
export type DeletionJob = { id: string; processing_token: string };
export type DeletionWorkerDependencies = {
  prepare: (job: DeletionJob) => Promise<Result<{ photo_object_path: string | null }[]>>;
  removePhoto: (objectPath: string) => Promise<{ error: unknown }>;
  finish: (job: DeletionJob, errorCode: string | null) => Promise<Result<boolean>>;
};

// Database leases protect transactional anonymization. Storage cleanup is repeatable;
// its target survives a crash in the persisted request.
export async function processDeletionJobs(jobs: DeletionJob[], deps: DeletionWorkerDependencies) {
  let processed = 0;
  let failed = 0;
  for (const job of jobs) {
    let errorCode: string | null = 'ANONYMIZATION_FAILED';
    try {
      const preparation = await deps.prepare(job);
      if (preparation.error || !preparation.data?.length) throw new Error('PREPARATION_FAILED');
      const objectPath = preparation.data[0].photo_object_path;
      if (objectPath) {
        errorCode = 'PHOTO_CLEANUP_FAILED';
        const removal = await deps.removePhoto(objectPath);
        if (removal.error) throw new Error('PHOTO_CLEANUP_FAILED');
      }
      errorCode = null;
    } catch {
      // Persist only allowlisted codes; database messages can contain private data.
    }
    try {
      const completion = await deps.finish(job, errorCode);
      if (completion.error || completion.data !== true || errorCode) failed += 1;
      else processed += 1;
    } catch {
      // A failed status write leaves the lease recoverable after its deadline.
      failed += 1;
    }
  }
  return { processed, failed };
}
