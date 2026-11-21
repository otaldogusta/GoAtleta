import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getActiveOrganizationId } from "../../db/client";
import { OrganizationProvider } from "../OrganizationProvider";
import { useOrganization } from "../organization-context";

let mockUserId = "";
jest.mock("../../auth/auth", () => ({
  useAuth: () => ({
    session: mockUserId ? mockSessions[mockUserId] : null,
  }),
}));
const mockSessions = Object.fromEntries(["a", "b"].map(id => [
  id, { user: { id }, access_token: `token-${id}` },
]));
jest.mock("../../auth/session", () => ({
  getSessionIdentity: () => ({ userId: mockUserId }),
  isSessionIdentityCurrent: ({ userId }: { userId: string }) => userId === mockUserId,
  assertSessionIdentity: ({ userId }: { userId: string }) => {
    if (userId !== mockUserId) throw new Error("Session changed");
  },
}));
jest.mock("../../auth/email-verification-state", () => ({
  hasVerifiedEmailAccess: (user: unknown) => Boolean(user),
}));
jest.mock("../../hooks/use-member-presence", () => ({ useMemberPresenceHeartbeat: jest.fn() }));
jest.mock("../../api/ai", () => ({ clearAiCache: jest.fn() }));
jest.mock("../../api/members", () => ({ getMyMemberPermissions: async () => [] }));
jest.mock("../../db/client", () => ({
  ACTIVE_ORG_STORAGE_KEY: jest.requireActual("../../db/client").ACTIVE_ORG_STORAGE_KEY,
  getActiveOrganizationId: jest.requireActual("../../db/client").getActiveOrganizationId,
  clearLocalReadCaches: async () => undefined,
}));
jest.mock("../../core/smart-sync", () => ({
  smartSync: { handleOrganizationSwitch: jest.fn(), resumeSync: jest.fn() },
}));

it("restores the selected workspace after sign-out for the same account only while it is available", async () => {
  await AsyncStorage.clear();
  mockUserId = "a";
  let organizations = [{ id: "default" }, { id: "selected" }];
  const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async () =>
    ({ ok: true, json: async () => organizations }) as Response,
  );
  try {
    const view = renderHook(() => useOrganization(), { wrapper: OrganizationProvider });
    const expectWorkspace = async (id: string | null) => {
      await waitFor(async () => {
        expect(view.result.current.activeOrganizationId).toBe(id);
        expect(await getActiveOrganizationId()).toBe(id);
      });
    };
    const switchAccount = (id: string) => {
      mockUserId = id;
      view.rerender(undefined);
    };
    await expectWorkspace("default");
    await act(async () => view.result.current.setActiveOrganizationId("selected"));
    await expectWorkspace("selected");

    switchAccount("");
    await expectWorkspace(null);
    switchAccount("b");
    // Even with both memberships, this account starts with its own default.
    await expectWorkspace("default");
    switchAccount("a");
    await expectWorkspace("selected");

    switchAccount("");
    await expectWorkspace(null);
    organizations = [{ id: "default" }];
    switchAccount("a");
    await expectWorkspace("default");
    view.unmount();
  } finally {
    fetchMock.mockRestore();
    mockUserId = "";
  }
});
