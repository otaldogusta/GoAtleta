/* eslint-disable import/first */
const mockGet = jest.fn();
const mockAssertIdentity = jest.fn();
jest.mock("../../auth/session", () => ({
  getSessionIdentity: () => ({ userId: "owner", generation: 1 }),
  assertSessionIdentity: (...args: unknown[]) => mockAssertIdentity(...args),
}));
jest.mock("../rest", () => ({
  supabaseRestGet: async (path: string, guard?: () => void) => {
    guard?.();
    const value = await mockGet(path);
    guard?.();
    return value;
  },
  supabaseRestPost: jest.fn(),
}));
import { loadActivityReview } from "../activity-review";

const missingRpc = new Error('PGRST202: get_activity_review_context_v1 is absent');
beforeEach(() => { mockGet.mockReset(); mockAssertIdentity.mockReset(); });

it("reads only aggregated class/day evidence in one request", async () => {
  mockGet.mockResolvedValue({ attendance: [{ classid: "c", date: "2026-10-23" }], reviews: [], enrolledClassIds: ["c"] });
  const data = await loadActivityReview("org-A", "2026-10-24");
  expect(data.enrolledClassIds).toEqual(new Set(["c"]));
  expect(data.attendance).toEqual([{ classid: "c", date: "2026-10-23" }]);
  expect(mockGet).toHaveBeenCalledTimes(1);
  expect(mockGet.mock.calls[0][0]).toBe('/rpc/get_activity_review_context_v1?p_organization_id=org-A&p_today=2026-10-24');
});

it("accepts a complete empty result without starting expensive fallback reads", async () => {
  mockGet.mockResolvedValue({ attendance: [], reviews: [], enrolledClassIds: [] });
  expect((await loadActivityReview("org-A", "2026-10-24")).enrolledClassIds.size).toBe(0);
  expect(mockGet).toHaveBeenCalledTimes(1);
});

it.each([
  new Error("network failed"),
  new Error('42501 permission denied get_activity_review_context_v1'),
])("does not replace unavailable/denied evidence with a legacy or empty result: %s", async error => {
  mockGet.mockRejectedValue(error);
  await expect(loadActivityReview("org-A", "2026-10-24")).rejects.toThrow(error);
  expect(mockGet).toHaveBeenCalledTimes(1);
});

it("rejects malformed context instead of producing missing-call suggestions", async () => {
  mockGet.mockResolvedValue({ attendance: [{ classid: "c" }], reviews: [], enrolledClassIds: ["c"] });
  await expect(loadActivityReview("org-A", "2026-10-24")).rejects.toThrow('Invalid activity review context');
  expect(mockGet).toHaveBeenCalledTimes(1);
});

it("uses capped pages until empty on older backends, without offsets or duplicate class/day evidence", async () => {
  mockGet.mockRejectedValueOnce(missingRpc)
    .mockResolvedValueOnce([{ id: "s1", classid: "c" }])
    .mockResolvedValueOnce([{ id: "s2", classid: "c" }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "a1", classid: "c", date: "2026-10-22" }])
    .mockResolvedValueOnce([{ id: "a2", classid: "c", date: "2026-10-22" }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  const result = await loadActivityReview("org-A", "2026-10-24");
  expect(result.enrolledClassIds).toEqual(new Set(["c"]));
  expect(result.attendance).toEqual([{ classid: "c", date: "2026-10-22" }]);
  const paths = mockGet.mock.calls.map(call => call[0] as string);
  expect(paths.every(path => !path.includes('offset='))).toBe(true);
  expect(paths[2]).toContain('&id=gt.s1');
  expect(decodeURIComponent(paths[5])).toContain('date=gte.2026-10-22&date=lt.2026-10-24');
  expect(decodeURIComponent(paths[5])).toContain('or=(date.gt."2026-10-22",and(date.eq."2026-10-22",id.gt."a1"))');
});

it("rejects repeated fallback pages before reading attendance or publishing partial evidence", async () => {
  mockGet.mockRejectedValueOnce(missingRpc)
    .mockResolvedValueOnce([{ id: 's1', classid: 'c' }])
    .mockResolvedValueOnce([{ id: 's1', classid: 'c' }]);
  await expect(loadActivityReview("org-A", "2026-10-24")).rejects.toThrow('Incomplete activity enrollment read');
  expect(mockGet).toHaveBeenCalledTimes(3);
});

it("also reads every page of legacy reviews before allowing a missing-call suggestion", async () => {
  const review = { class_ids: ['c'], start_date: '2026-10-20', end_date: '2026-10-23' };
  mockGet.mockRejectedValueOnce(missingRpc).mockResolvedValueOnce([]).mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: 'r1', ...review }])
    .mockResolvedValueOnce([{ id: 'r2', ...review }]).mockResolvedValueOnce([]);
  expect((await loadActivityReview('org-A', '2026-10-24')).reviews).toEqual([review, review]);
  expect(mockGet.mock.calls[4][0]).toContain('&id=gt.r1');
  expect(mockGet.mock.calls[5][0]).toContain('&id=gt.r2');
});

it("does not retry or paginate after cancellation while the first response is pending", async () => {
  const controller = new AbortController();
  mockGet.mockImplementationOnce(async () => { controller.abort(); throw missingRpc; });
  await expect(loadActivityReview("org-A", "2026-10-24", controller.signal)).rejects.toThrow('cancelled');
  expect(mockGet).toHaveBeenCalledTimes(1);
});

it("discards a response when the signed-in identity changes", async () => {
  mockGet.mockImplementationOnce(async () => {
    mockAssertIdentity.mockImplementation(() => { throw new Error('Identity changed'); });
    return { attendance: [], reviews: [], enrolledClassIds: [] };
  });
  await expect(loadActivityReview("org-A", "2026-10-24")).rejects.toThrow('Identity changed');
  expect(mockGet).toHaveBeenCalledTimes(1);
});
