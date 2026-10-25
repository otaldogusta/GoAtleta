import { act, renderHook } from "@testing-library/react-native";

import { getStudentPhotoAccessUrl } from "../../api/student-photo-storage";
import { useStudentPhotoAccess } from "../use-student-photo-access";

let mockIdentity = { userId: "user-a", generation: 1 };
let mockGeneration = 1;
jest.mock("../../auth/session", () => ({ getSessionIdentity: () => ({ ...mockIdentity }) }));
jest.mock("../../db/client", () => ({ getReadCacheGeneration: () => mockGeneration }));
jest.mock("../../api/student-photo-storage", () => ({
  getStudentPhotoAccessUrl: jest.fn(),
  getStudentPhotoObjectPath: (url: string) => url.startsWith("private:") ? url : null,
}));

const student = (id: number, version = 1) => ({ id: String(id), organizationId: "org-a", photoUrl: `private:${id}?v=${version}` });
const flush = () => act(async () => { for (let step = 0; step < 15; step += 1) await Promise.resolve(); });

beforeEach(() => {
  jest.clearAllMocks();
  mockIdentity = { userId: "user-a", generation: 1 };
  mockGeneration = 1;
  jest.mocked(getStudentPhotoAccessUrl).mockImplementation(async url => `${url}:signed`);
});

test("loads only supplied page photos, with at most six workers, and resolves incrementally", async () => {
  const releases: (() => void)[] = [];
  jest.mocked(getStudentPhotoAccessUrl).mockImplementation(url => new Promise(resolve => {
    releases.push(() => resolve(`${url}:signed`));
  }));
  const directory = Array.from({ length: 5000 }, (_, id) => student(id));
  const page = directory.slice(0, 8);
  const { result } = renderHook(() => useStudentPhotoAccess(page, "org-a"));
  expect(getStudentPhotoAccessUrl).toHaveBeenCalledTimes(6);
  expect(result.current.resolvePhotoUrl(page[0])).toBeNull();
  await act(async () => releases.shift()!());
  expect(result.current.resolvePhotoUrl(page[0])).toContain(":signed");
  expect(getStudentPhotoAccessUrl).toHaveBeenCalledTimes(7);
  await act(async () => releases.splice(0).forEach(release => release()));
  await act(async () => releases.splice(0).forEach(release => release()));
  expect(getStudentPhotoAccessUrl).toHaveBeenCalledTimes(8);
  expect(result.current.resolvePhotoUrl(directory[100])).toBeNull();
});

test("page changes cancel old workers and ignore their late photos", async () => {
  const releases: (() => void)[] = [];
  jest.mocked(getStudentPhotoAccessUrl).mockImplementation(url => new Promise(resolve => {
    releases.push(() => resolve(`${url}:signed`));
  }));
  const first = Array.from({ length: 20 }, (_, id) => student(id));
  const second = [student(100), student(101)];
  const { result, rerender } = renderHook(({ page }) => useStudentPhotoAccess(page, "org-a"), { initialProps: { page: first } });
  const firstSignal = jest.mocked(getStudentPhotoAccessUrl).mock.calls[0][1]!.signal!;
  rerender({ page: second });
  expect(firstSignal.aborted).toBe(true);
  await act(async () => releases.splice(0).forEach(release => release()));
  expect(getStudentPhotoAccessUrl).toHaveBeenCalledTimes(8);
  expect(result.current.resolvePhotoUrl(first[0])).toBeNull();
  expect(result.current.resolvePhotoUrl(second[0])).toContain(":signed");
});

test.each(["organization", "user", "round trip"])("hides previous grants immediately when %s changes", async (change) => {
  const page = [student(1)];
  const { result, rerender } = renderHook(({ organizationId }) => useStudentPhotoAccess(page, organizationId), { initialProps: { organizationId: "org-a" } });
  await flush();
  expect(result.current.resolvePhotoUrl(page[0])).toContain(":signed");
  jest.mocked(getStudentPhotoAccessUrl).mockImplementation(() => new Promise(() => undefined));
  if (change === "user") mockIdentity = { userId: "user-b", generation: 2 };
  else mockGeneration += change === "round trip" ? 2 : 1;
  rerender({ organizationId: change === "organization" ? "org-b" : "org-a" });
  expect(result.current.resolvePhotoUrl(page[0])).toBeNull();
});

test("a changed photo version is authorized again and a failure only affects that photo", async () => {
  const first = [student(1), student(2)];
  const { result, rerender, unmount } = renderHook(({ page }) => useStudentPhotoAccess(page, "org-a"), { initialProps: { page: first } });
  await flush();
  const external = { id: "external", organizationId: "org-a", photoUrl: "https://example.com/external.jpg" };
  const updated = [student(1, 2), student(2), external];
  jest.mocked(getStudentPhotoAccessUrl).mockImplementation(async url => {
    if (url === updated[0].photoUrl) throw new Error("denied");
    return `${url}:signed`;
  });
  rerender({ page: updated });
  await flush();
  expect(result.current.resolvePhotoUrl(updated[0])).toBeNull();
  expect(result.current.isPhotoResolving(updated[0])).toBe(false);
  expect(result.current.resolvePhotoUrl(updated[1])).toContain(":signed");
  expect(result.current.resolvePhotoUrl(external)).toBe("https://example.com/external.jpg");
  const latestSignal = jest.mocked(getStudentPhotoAccessUrl).mock.calls.at(-1)![1]!.signal!;
  unmount();
  expect(latestSignal.aborted).toBe(true);
});

test("does not authorize or display stale directory rows from another organization", async () => {
  const page = [student(1), { id: "external", organizationId: "org-a", photoUrl: "https://example.com/external.jpg" }];
  const { result } = renderHook(() => useStudentPhotoAccess(page, "org-b"));
  await flush();
  expect(getStudentPhotoAccessUrl).not.toHaveBeenCalled();
  expect(result.current.resolvePhotoUrl(page[0])).toBeNull();
  expect(result.current.resolvePhotoUrl(page[1])).toBeNull();
});
