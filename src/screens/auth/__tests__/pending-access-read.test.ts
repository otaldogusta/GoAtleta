import { act, renderHook, waitFor } from "@testing-library/react-native";
import { usePendingAccessRequest } from "../usePendingAccessRequest";
import { listMyOrganizationAccessRequests, type OrganizationAccessRequest } from "../../../api/organization-access-requests";

jest.mock("../../../api/organization-access-requests", () => ({ listMyOrganizationAccessRequests: jest.fn() }));
const list = jest.mocked(listMyOrganizationAccessRequests);
const pending = { id: "qa-pending", requestKind: "athlete", status: "pending" } as OrganizationAccessRequest;
const deferred = () => {
  let resolve!: (value: OrganizationAccessRequest[]) => void;
  const promise = new Promise<OrganizationAccessRequest[]>(done => { resolve = done; });
  return { promise, resolve };
};
beforeEach(() => jest.resetAllMocks());

test("recovers a read error and preserves the observed pending request until the next result", async () => {
  const identity = "user-a";
  list.mockResolvedValueOnce([pending]).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([{ ...pending, status: "approved" }]);
  const { result } = renderHook(() => usePendingAccessRequest(identity));
  await waitFor(() => expect(result.current.request?.id).toBe(pending.id));
  await act(async () => { await result.current.reload(); });
  expect(result.current.error).toMatch(/Não foi possível consultar/);
  expect(result.current.request?.status).toBe("pending");
  await act(async () => { await result.current.reload(); });
  expect(result.current.error).toBe("");
  expect(result.current.request?.status).toBe("approved");
  expect(result.current.observedPending).toBe(true);
});

test("deduplicates a pending read and releases its lock after completion", async () => {
  const identity = "user-a", first = deferred();
  list.mockReturnValueOnce(first.promise).mockResolvedValue([]);
  const { result } = renderHook(() => usePendingAccessRequest(identity));
  await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
  let one!: Promise<void>, two!: Promise<void>;
  act(() => { one = result.current.reload(); two = result.current.reload(); });
  expect(one).toBe(two);
  expect(result.current.loading).toBe(true);
  await act(async () => { first.resolve([pending]); await one; });
  expect(result.current.loading).toBe(false);
  await act(async () => { await result.current.reload(); });
  expect(list).toHaveBeenCalledTimes(2);
});

test("does not expose the previous identity or accept its delayed result", async () => {
  const firstIdentity = "user-a", secondIdentity = "user-b", first = deferred(), second = deferred();
  list.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const { result, rerender } = renderHook(({ identity }) => usePendingAccessRequest(identity), { initialProps: { identity: firstIdentity as string | null } });
  await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
  rerender({ identity: secondIdentity });
  expect(result.current.request).toBeNull();
  expect(result.current.observedPending).toBe(false);
  await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  await act(async () => { first.resolve([pending]); await first.promise; });
  expect(result.current.request).toBeNull();
  expect(result.current.loading).toBe(true);
  await act(async () => { second.resolve([]); await second.promise; });
  expect(result.current.request).toBeNull();
  expect(result.current.loading).toBe(false);
  rerender({ identity: null });
  await act(async () => { await result.current.reload(); });
  expect(list).toHaveBeenCalledTimes(2);
});

test("retains athlete/guardian priority and rejects a completion after unmount", async () => {
  const identity = "user-a", last = deferred();
  const guardian = { ...pending, id: "guardian", requestKind: "guardian" } as OrganizationAccessRequest;
  const staff = { ...pending, id: "staff", requestKind: "staff" } as OrganizationAccessRequest;
  list.mockResolvedValueOnce([staff, guardian]).mockReturnValueOnce(last.promise);
  const { result, unmount } = renderHook(() => usePendingAccessRequest(identity));
  await waitFor(() => expect(result.current.request).toBe(guardian));
  let read!: Promise<void>;
  act(() => { read = result.current.reload(); });
  unmount();
  await act(async () => { last.resolve([staff]); await read; });
  expect(result.current.request).toBe(guardian);
});

test("keeps pending observation across token refresh for the same account", async () => {
  list.mockResolvedValueOnce([pending]).mockResolvedValueOnce([{ ...pending, status: "approved" }]);
  const { result, rerender } = renderHook(({ session }) => usePendingAccessRequest(session.user.id), {
    initialProps: { session: { user: { id: "user-a" }, access_token: "old-local-token" } },
  });
  await waitFor(() => expect(result.current.observedPending).toBe(true));
  rerender({ session: { user: { id: "user-a" }, access_token: "refreshed-local-token" } });
  expect(result.current.observedPending).toBe(true);
  await act(async () => { await result.current.reload(); });
  expect(result.current.request?.status).toBe("approved");
  expect(result.current.observedPending).toBe(true);
});
