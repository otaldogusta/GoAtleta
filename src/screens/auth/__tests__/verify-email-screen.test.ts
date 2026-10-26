import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import VerifyEmailScreen from "../../../../app/verify-email";

const mockReplace = jest.fn();
const mockVerify = jest.fn();
const mockResend = jest.fn();
const mockRefresh = jest.fn();
const mockClaimRelationship = jest.fn();
let mockSession: any = null;
let mockPendingTrainer = "";
let mockPendingFamily = "";
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, canGoBack: () => false }),
  useLocalSearchParams: () => ({ email: "new@example.test" }),
}));
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: mockSession,
  verifySignupCode: mockVerify, resendSignupCode: mockResend, refreshUser: mockRefresh }) }));
jest.mock("../../../auth/role", () => ({ useRole: () => ({ refresh: mockRefresh }) }));
jest.mock("../../../auth/pending-invite", () => ({
  ...jest.requireActual("../../../auth/pending-invite"),
  getPendingInvite: jest.fn().mockResolvedValue(""),
  getPendingTrainerInvite: async () => mockPendingTrainer,
  getPendingRelationshipInvite: async () => mockPendingFamily,
  clearPendingRelationshipInvite: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../../api/student-relationship-invite", () => ({ claimStudentRelationshipInvite: (...args: unknown[]) => mockClaimRelationship(...args) }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: jest.requireActual("react-native").View }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../components/ui/ScreenBackdrop", () => ({ ScreenBackdrop: () => null }));
jest.mock("../../../ui/ScreenHeader", () => ({ ScreenHeader: ({ title }: any) =>
  jest.requireActual("react").createElement(jest.requireActual("react-native").Text, {}, title) }));
jest.mock("../../../ui/Button", () => ({ Button: ({ label, disabled, onPress }: any) =>
  jest.requireActual("react").createElement(jest.requireActual("react-native").Pressable, { accessibilityRole: "button", accessibilityLabel: label, disabled, onPress }) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = null;
  mockPendingTrainer = "";
  mockPendingFamily = "";
  mockVerify.mockResolvedValue({ user: { id: "new-user" } });
  mockResend.mockResolvedValue(undefined);
  mockRefresh.mockResolvedValue(undefined);
});

const mount = async () => {
  const view = render(React.createElement(VerifyEmailScreen));
  await act(async () => { await Promise.resolve(); });
  return view;
};

it("keeps Continue disabled until six digits and clears failure on typing", async () => {
  const view = await mount();
  expect(view.getByRole("button", { name: "Continuar" }).props.accessibilityState.disabled).toBe(true);
  fireEvent.changeText(view.getByLabelText("Código de confirmação"), "12345");
  expect(view.getByRole("button", { name: "Continuar" }).props.accessibilityState.disabled).toBe(true);
  fireEvent.changeText(view.getByLabelText("Código de confirmação"), "123456");
  mockVerify.mockRejectedValueOnce(new Error("Invalid code"));
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Continuar" })));
  expect(view.getByText("Código inválido. Confira o código do e-mail e tente novamente.")).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
  fireEvent.changeText(view.getByLabelText("Código de confirmação"), "654321");
  expect(view.queryByText("Código inválido. Confira o código do e-mail e tente novamente.")).toBeNull();
});

it.each(["", "ABCD-EFGH"])("continues after OTP with pending trainer code %s", async (code) => {
  mockPendingTrainer = code;
  const view = await mount();
  fireEvent.changeText(view.getByLabelText("Código de confirmação"), "123456");
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Continuar" })));
  expect(mockVerify).toHaveBeenCalledWith("new@example.test", "123456");
  expect(mockReplace).toHaveBeenCalledWith(code ? "/pending" : "/");
});

it("confirms the authenticated email instead of a conflicting query suggestion", async () => {
  mockSession = { user: { email: "invited@example.test" } };
  const view = await mount();
  fireEvent.changeText(view.getByLabelText("Código de confirmação"), "123456");
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Continuar" })));
  expect(mockVerify).toHaveBeenCalledWith("invited@example.test", "123456");
});

it("keeps the family receipt destination and recovers a failed claim through its invite", async () => {
  mockPendingFamily = "family-token";
  mockClaimRelationship.mockRejectedValueOnce(new Error("offline"));
  const view = await mount();
  fireEvent.changeText(view.getByLabelText("Código de confirmação"), "123456");
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Continuar" })));
  expect(mockReplace).toHaveBeenCalledWith("/family-invite/family-token");
});

it("prevents repeated resends during the countdown", async () => {
  jest.useFakeTimers();
  try {
    const view = await mount();
    await act(async () => fireEvent.press(view.getByText("Reenviar e-mail")));
    expect(view.getByText("Reenviar em 1:00")).toBeTruthy();
    await act(async () => fireEvent.press(view.getByText("Reenviar em 1:00")));
    expect(mockResend).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(1000));
    expect(view.getByText("Reenviar em 0:59")).toBeTruthy();
    view.unmount();
  } finally { jest.useRealTimers(); }
});
