import { processDeletionJobs, type DeletionWorkerDependencies } from '../lgpd-deletion-worker';

const job = { id: 'request-1', processing_token: 'lease-1' };
const dependencies = (): jest.Mocked<DeletionWorkerDependencies> => ({
  prepare: jest.fn().mockResolvedValue({ data: [{ photo_object_path: 'org/student/avatar' }], error: null }),
  removePhoto: jest.fn().mockResolvedValue({ error: null }),
  finish: jest.fn().mockResolvedValue({ data: true, error: null }),
});

describe('recoverable deletion worker', () => {
  it('finishes only after transactional anonymization and storage cleanup', async () => {
    const deps = dependencies();
    await expect(processDeletionJobs([job], deps)).resolves.toEqual({ processed: 1, failed: 0 });
    expect(deps.finish).toHaveBeenCalledWith(job, null);
    expect(deps.prepare.mock.invocationCallOrder[0]).toBeLessThan(deps.removePhoto.mock.invocationCallOrder[0]);
    expect(deps.removePhoto.mock.invocationCallOrder[0]).toBeLessThan(deps.finish.mock.invocationCallOrder[0]);
  });
  it('does not delete storage or leak database details when anonymization fails', async () => {
    const deps = dependencies();
    deps.prepare.mockResolvedValue({ data: null, error: { message: 'private student details' } });
    await expect(processDeletionJobs([job], deps)).resolves.toEqual({ processed: 0, failed: 1 });
    expect(deps.removePhoto).not.toHaveBeenCalled();
    expect(deps.finish).toHaveBeenCalledWith(job, 'ANONYMIZATION_FAILED');
  });
  it('retries a persisted photo target after a storage outage', async () => {
    const deps = dependencies();
    deps.removePhoto.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(processDeletionJobs([job], deps)).resolves.toEqual({ processed: 0, failed: 1 });
    expect(deps.finish).toHaveBeenLastCalledWith(job, 'PHOTO_CLEANUP_FAILED');
    const reclaimed = { ...job, processing_token: 'lease-2' };
    await expect(processDeletionJobs([reclaimed], deps)).resolves.toEqual({ processed: 1, failed: 0 });
    expect(deps.removePhoto).toHaveBeenLastCalledWith('org/student/avatar');
    expect(deps.finish).toHaveBeenLastCalledWith(reclaimed, null);
  });
  it.each([false, null])('does not count an uncommitted or stale completion (%s)', async (data) => {
    const deps = dependencies();
    deps.finish.mockResolvedValue({ data, error: null });
    await expect(processDeletionJobs([job], deps)).resolves.toEqual({ processed: 0, failed: 1 });
  });
  it('continues other jobs if status persistence fails', async () => {
    const deps = dependencies();
    deps.finish.mockRejectedValueOnce(new Error('network'));
    await expect(processDeletionJobs([job, { ...job, id: 'request-2' }], deps))
      .resolves.toEqual({ processed: 1, failed: 1 });
  });
});
