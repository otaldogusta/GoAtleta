import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import StaffInviteScreen from "../../../../app/staff-invite";
import SignupScreen from "../SignupScreen";

const mockAccept = jest.fn();
const mockComplete = jest.fn();
const mockReplace = jest.fn();
const mockSetParams = jest.fn();
const mockSetOrganization = jest.fn();
const mockSignOut = jest.fn();
const mockClearPending = jest.fn();
const mockRefresh = jest.fn();
const mockSetup = { setup_required: true, organization_id: "org-1", session: { user: { id: "recipient", email: "recipient@example.com" }, access_token: "recipient-token", refresh_token: "recipient-refresh", expires_at: 1 } };
const mockFreshSetup = { ...mockSetup, session: { ...mockSetup.session, access_token: "fresh-token", refresh_token: "fresh-refresh", expires_at: 4_000_000_000 } };
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace, setParams: mockSetParams }), useLocalSearchParams: () => ({}) }));
jest.mock("../../../api/staff-invite", () => ({ resumeStaffSignup: jest.fn(), refreshStaffSignupSession: (...args: unknown[]) => mockRefresh(...args) }));
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: { user: { email: "owner@example.com" } }, loading: false, acceptStaffInvite: mockAccept, completeStaffInvite: mockComplete, signOut: mockSignOut }) }));
jest.mock("../../../auth/pending-invite", () => ({ savePendingTrainerInvite: jest.fn().mockResolvedValue(undefined), clearPendingTrainerInvite: (...args: unknown[]) => mockClearPending(...args) }));
jest.mock("../../../providers/OrganizationProvider", () => ({ useOrganization: () => ({ setActiveOrganizationId: mockSetOrganization }) }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ mode: "dark", colors: {} }) }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: require("react-native").View }));
jest.mock("../../../components/ui/ScreenBackdrop", () => ({ ScreenBackdrop: () => null }));
jest.mock("../../../ui/ScreenHeader", () => ({ ScreenHeader: ({ title }: any) => require("react").createElement(require("react-native").Text, {}, title) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/Button", () => ({ Button: ({ label, disabled, onPress }: any) => require("react").createElement(require("react-native").Pressable, { accessibilityRole: "button", accessibilityLabel: label, disabled, onPress }) }));

describe("employee invitation screen", () => {
  const originalOS = Platform.OS;
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    Object.defineProperty(window, "location", { configurable: true, value: { pathname: "/staff-invite", search: "", hash: `#code=TEST-CODE&token_hash=${"a".repeat(64)}&type=magiclink` } });
    Object.defineProperty(window, "history", { configurable: true, value: { state: {}, replaceState: jest.fn() } });
    mockAccept.mockResolvedValue(mockSetup);
    mockRefresh.mockResolvedValue(mockFreshSetup);
    mockComplete.mockResolvedValue({ ...mockSetup, setup_required: false });
  });
  afterAll(() => Object.defineProperty(Platform, "OS", { configurable: true, value: originalOS }));
  it("does not consume the email proof or log out until the user confirms", async () => {
    const screen = render(React.createElement(StaffInviteScreen));
    expect(screen.getByRole("button", { name: "Trocar conta e aceitar" })).toBeTruthy();
    expect(mockAccept).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(window.history.replaceState).toHaveBeenCalledWith({}, "", "/staff-invite");
    await waitFor(() => expect(mockSetParams).toHaveBeenCalledWith({ "#": "" }));
  });
  it("holds new employees at the signup form until completion succeeds", async () => {
    const screen = render(React.createElement(StaffInviteScreen));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Trocar conta e aceitar" })));
    expect(screen.UNSAFE_getByType(SignupScreen)).toBeTruthy();
    expect(screen.getByText("Conclua seu cadastro")).toBeTruthy();
    expect(screen.getByLabelText("E-mail").props.value).toBe("recipient@example.com");
    expect(screen.getByLabelText("E-mail").props.editable).toBe(false);
    expect(mockSetOrganization).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Nome")).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Senha"), "secret123");
    fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "secret123");
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Concluir cadastro" })));
    expect(mockRefresh).toHaveBeenCalledWith(mockSetup);
    expect(mockComplete).toHaveBeenCalledWith("TEST-CODE", mockFreshSetup, { password: "secret123" });
    expect(mockSetOrganization).toHaveBeenCalledWith("org-1");
    expect(mockClearPending).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/");
  });
  it("keeps the credential form open when the temporary invite session cannot be renewed", async () => {
    mockRefresh.mockRejectedValue(new Error("Sua sessão expirou. Reabra o convite."));
    const screen = render(React.createElement(StaffInviteScreen));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Trocar conta e aceitar" })));
    fireEvent.changeText(screen.getByLabelText("Senha"), "secret123");
    fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "secret123");
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Concluir cadastro" })));
    expect(screen.getByText("Sua sessão expirou. Reabra o convite.")).toBeTruthy();
    expect(screen.UNSAFE_getByType(SignupScreen)).toBeTruthy();
    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockSetOrganization).not.toHaveBeenCalled();
  });
  it("skips signup for an existing account", async () => {
    mockAccept.mockResolvedValue({ ...mockSetup, setup_required: false });
    const screen = render(React.createElement(StaffInviteScreen));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Trocar conta e aceitar" })));
    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/");
  });
  it("keeps the current account and invite pending on failure", async () => {
    mockAccept.mockRejectedValue(new Error("Convite expirado"));
    const screen = render(React.createElement(StaffInviteScreen));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Trocar conta e aceitar" })));
    expect(screen.getByText("Convite expirado")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockClearPending).not.toHaveBeenCalled();
  });
});
