/** A failed list refresh must never turn a confirmed write into a failed save. */
export async function createClassAndRefresh({
  save,
  refresh,
}: {
  save: () => Promise<string>;
  refresh: () => Promise<void>;
}): Promise<{ classId: string; refreshFailed: boolean }> {
  const classId = await save();
  try {
    await refresh();
    return { classId, refreshFailed: false };
  } catch {
    return { classId, refreshFailed: true };
  }
}
