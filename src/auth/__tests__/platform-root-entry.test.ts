import React from "react";
import { act, cleanup, render } from "@testing-library/react-native";
import { Platform } from "react-native";
import type { AuthSession } from "../session";
import RootLayout from "../../../app/_layout";

let mockSession: AuthSession | null = null;
let mockRole = { role: null as "pending" | "family" | null, loading: false };
let mockPathname = "/login";
let mockParams: Record<string, string> = {};
let mockIdentity = { userId: "", generation: 0 };
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace, push: jest.fn() };
const mockRpc = jest.fn();
const mockRefreshUser = jest.fn();
const mockRootState = { key: "root", routes: [{ name: "login" }] };

function mockProvider({ children }: { children: React.ReactNode }) { return children; }
jest.mock("expo-router", () => {
  const Stack = Object.assign(() => jest.requireActual("react").createElement(jest.requireActual("react-native").View, { testID: "root-stack" }), { Screen: () => null });
  return { Stack, useRouter: () => mockRouter, usePathname: () => mockPathname, useGlobalSearchParams: () => mockParams, useRootNavigationState: () => mockRootState };
});
jest.mock("expo-router/head", () => () => null);
jest.mock("../../ui/web-font-timeout-fallback", () => ({}));
jest.mock("../../navigation/browser-pending-edits", () => ({}));
jest.mock("../../navigation/web-stack-history", () => ({ withWebStackHistory: jest.fn() }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("expo-updates", () => ({}));
jest.mock("@sentry/react-native", () => ({ init: jest.fn(), addBreadcrumb: jest.fn(), captureException: jest.fn(), ErrorBoundary: mockProvider }));
jest.mock("../auth", () => ({ AuthProvider: mockProvider, useAuth: () => ({ session: mockSession, loading: false, refreshUser: mockRefreshUser, signOut: jest.fn() }) }));
jest.mock("../role", () => ({ RoleProvider: mockProvider, useRole: () => mockRole }));
jest.mock("../session", () => {
  class IdentityChangedError extends Error {}
  return {
    getSessionIdentity: () => ({ ...mockIdentity }),
    isSessionIdentityCurrent: (identity: typeof mockIdentity) => identity.userId === mockIdentity.userId && identity.generation === mockIdentity.generation,
    assertSessionIdentity: (identity: typeof mockIdentity) => {
      if (identity.userId !== mockIdentity.userId || identity.generation !== mockIdentity.generation) throw new IdentityChangedError();
    },
    SessionIdentityChangedError: IdentityChangedError,
  };
});
jest.mock("../../api/rest", () => ({ supabaseRestRequest: (...args: unknown[]) => mockRpc(...args) }));
jest.mock("../../bootstrap/BootstrapProvider", () => ({ BootstrapProvider: mockProvider, useBootstrap: () => ({ loading: false, error: null, data: { session: mockSession }, retry: jest.fn() }) }));
jest.mock("../../bootstrap/BootstrapGate", () => ({ BootstrapGate: mockProvider }));
jest.mock("../../bootstrap/pedagogical-config-context", () => ({ PedagogicalConfigProvider: mockProvider }));
jest.mock("../../providers/OrganizationProvider", () => ({ OrganizationProvider: mockProvider }));
jest.mock("../../providers/organization-context", () => ({ useOptionalOrganization: () => null }));
jest.mock("../../security/biometric-lock", () => ({ BiometricLockProvider: mockProvider, useBiometricLock: () => ({ isEnabled: false, isUnlocked: true, hasCredentialLoginBypass: false }) }));
jest.mock("../../ui/app-theme", () => ({ AppThemeProvider: mockProvider, useAppTheme: () => ({ colors: {}, mode: "dark" }) }));
jest.mock("../../ui/RootWebShell", () => ({ RootWebShell: mockProvider }));
jest.mock("../../ui/confirm-dialog", () => ({ ConfirmDialogProvider: mockProvider }));
jest.mock("../../ui/confirm-undo", () => ({ ConfirmUndoProvider: mockProvider }));
jest.mock("../../ui/guidance", () => ({ GuidanceProvider: mockProvider }));
jest.mock("../../ui/save-toast", () => ({ SaveToastProvider: mockProvider }));
jest.mock("../../ui/RefreshFeedbackProvider", () => ({ RefreshFeedbackProvider: mockProvider }));
jest.mock("../../ui/whatsapp-settings-context", () => ({ WhatsAppSettingsProvider: mockProvider }));
jest.mock("../../copilot/CopilotProvider", () => ({ CopilotProvider: mockProvider }));
jest.mock("../staff-invite-entry", () => ({ StaffInviteEntryProvider: mockProvider }));
jest.mock("../FirstAccessProfileGate", () => ({ FirstAccessProfileGate: () => null }));
jest.mock("../../components/ui/ScreenBackdrop", () => ({ ScreenBackdrop: () => null }));
jest.mock("../../hooks/use-birthday-notifications", () => ({ useBirthdayNotifications: jest.fn() }));
jest.mock("../../hooks/use-effective-profile", () => ({ useEffectiveProfile: () => mockRole.role === "family" ? "family" : "student" }));
jest.mock("../../observability/breadcrumbs", () => ({ logNavigation: jest.fn() }));
jest.mock("../../observability/sentry", () => ({ setSentryBaseTags: jest.fn() }));
jest.mock("../../observability/VercelWebAnalytics", () => ({ VercelWebAnalytics: () => null }));
jest.mock("../../push/notificationRuntime", () => ({ ensureAndroidNotificationChannel: jest.fn(), ensureNotificationHandlerConfigured: jest.fn() }));
jest.mock("../../push/pushClient", () => ({ attachPushListeners: () => () => {}, ensurePushTokenRegistered: jest.fn() }));
jest.mock("../../push/native-permission", () => ({ requestInitialNotificationPermission: jest.fn() }));

const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS")!;
const locationDescriptor = Object.getOwnPropertyDescriptor(window, "location");
const historyDescriptor = Object.getOwnPropertyDescriptor(window, "history");
const returnTo = "/platform/accesses?institution=QA%20Direct%20Entry";
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
const sessionFor = (id: string): AuthSession => ({
  access_token: `synthetic-${id}`, refresh_token: "synthetic-refresh", expires_at: 9999999999,
  user: { id, email: `${id}@example.test`, app_metadata: { email_verified_hybrid_at: "verified", platform_only: false }, user_metadata: { full_name: "Fixture Account" } },
});
const showRoute = (href: string) => {
  const url = new URL(href, "https://goatleta.local");
  mockPathname = url.pathname;
  mockParams = Object.fromEntries(url.searchParams);
  Object.defineProperty(window, "location", { configurable: true, value: { pathname: url.pathname, search: url.search, hash: url.hash, href: url.href } });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = null;
  mockRole = { role: null, loading: false };
  mockIdentity = { userId: "", generation: mockIdentity.generation + 1 };
  mockRpc.mockResolvedValue(false);
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  Object.defineProperty(window, "history", { configurable: true, value: { state: {}, replaceState: jest.fn() } });
  showRoute(`/login?next=${encodeURIComponent(returnTo)}`);
});
afterEach(() => {
  cleanup();
  Object.defineProperty(Platform, "OS", platformDescriptor);
  if (locationDescriptor) Object.defineProperty(window, "location", locationDescriptor);
  else Reflect.deleteProperty(window, "location");
  if (historyDescriptor) Object.defineProperty(window, "history", historyDescriptor);
  else Reflect.deleteProperty(window, "history");
});

test("root keeps a pure-admin login return and subsequent reload out of the free home", async () => {
  const granted = deferred<boolean>();
  mockRpc.mockReturnValueOnce(granted.promise);
  const screen = render(React.createElement(RootLayout));
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => {
    mockSession = sessionFor("platform-only-account");
    mockIdentity = { userId: mockSession.user.id, generation: mockIdentity.generation + 1 };
    mockRole = { role: "pending", loading: true };
    screen.rerender(React.createElement(RootLayout));
  });
  await act(async () => {
    mockRole = { role: "pending", loading: false };
    screen.rerender(React.createElement(RootLayout));
  });
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => { granted.resolve(true); });
  expect(mockReplace).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith(returnTo);

  showRoute(returnTo);
  screen.rerender(React.createElement(RootLayout));
  expect(mockReplace).toHaveBeenCalledTimes(1);
  screen.unmount();
  mockReplace.mockClear();

  const reloadedGrant = deferred<boolean>();
  mockRpc.mockReturnValueOnce(reloadedGrant.promise);
  const reloaded = render(React.createElement(RootLayout));
  expect(reloaded.queryByTestId("root-stack")).toBeNull();
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => { reloadedGrant.resolve(true); });
  expect(reloaded.getByTestId("root-stack")).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
});

test("root denies a family account after the same login return without mounting platform content", async () => {
  mockSession = sessionFor("family-account");
  mockIdentity = { userId: mockSession.user.id, generation: mockIdentity.generation + 1 };
  mockRole = { role: "family", loading: false };
  const screen = render(React.createElement(RootLayout));
  await act(async () => {});
  expect(mockReplace).toHaveBeenCalledWith(returnTo);
  showRoute(returnTo);
  screen.rerender(React.createElement(RootLayout));
  expect(screen.queryByTestId("root-stack")).toBeNull();
  expect(mockReplace).toHaveBeenLastCalledWith("/family/home");
});
