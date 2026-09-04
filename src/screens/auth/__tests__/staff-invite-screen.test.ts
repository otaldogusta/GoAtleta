import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import StaffInviteScreen from "../../../../app/staff-invite";

const mockAccept = jest.fn();
const mockComplete = jest.fn();
const mockReplace = jest.fn();
const mockSetParams = jest.fn();
const mockSetOrganization = jest.fn();
const mockSignOut = jest.fn();
const mockClearPending = jest.fn();
const mockSetup = { setup_required: true, organization_id: "org-1", session: { user: { id: "recipient", email: "recipient@example.com" }, access_token: "recipient-token", refresh_token: "recipient-refresh" } };
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace, setParams: mockSetParams }), useLocalSearchParams: () => ({}) }));
jest.mock("../../../api/staff-invite", () => ({ resumeStaffSignup: jest.fn() }));
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: { user: { email: "owner@example.com" } }, loading: false, acceptStaffInvite: mockAccept, completeStaffInvite: mockComplete, signOut: mockSignOut }) }));
jest.mock("../../../auth/pending-invite", () => ({ savePendingTrainerInvite: jest.fn().mockResolvedValue(undefined), clearPendingTrainerInvite: (...args: unknown[]) => mockClearPending(...args) }));
jest.mock("../../../providers/OrganizationProvider", () => ({ useOrganization: () => ({ setActiveOrganizationId: mockSetOrganization }) }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ mode: "dark", colors: {} }) }));
jest.mock("../../../ui/Button", () => ({ Button: ({ label, disabled, onPress }: any) => require("react").createElement(require("react-native").Pressable, { accessibilityRole: "button", accessibilityLabel: label, disabled, onPress }) }));

describe("employee invitation screen", () => {
  const originalOS = Platform.OS;
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    Object.defineProperty(window, "location", { configurable: true, value: { pathname: "/staff-invite", search: "", hash: `#code=TEST-CODE&token_hash=${"a".repeat(64)}&type=magiclink` } });
    Object.defineProperty(window, "history", { configurable: true, value: { state: {}, replaceState: jest.fn() } });
    mockAccept.mockResolvedValue(mockSetup);
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
    expect(screen.getByText("Complete seu cadastro")).toBeTruthy();
    expect(mockSetOrganization).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText("Nome"), "Ana Silva");
    fireEvent.changeText(screen.getByLabelText("Criar senha"), "secret123");
    fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "secret123");
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Concluir e entrar" })));
    expect(mockComplete).toHaveBeenCalledWith("TEST-CODE", mockSetup, { full_name: "Ana Silva", password: "secret123" });
    expect(mockSetOrganization).toHaveBeenCalledWith("org-1");
    expect(mockClearPending).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/");
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
