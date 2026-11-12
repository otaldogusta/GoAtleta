import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import VerifyEmailScreen from "../../../../app/verify-email";

const mockReplace = jest.fn();
const mockSetParams = jest.fn();
const mockVerify = jest.fn();
const mockResend = jest.fn();
const mockCorrectEmail = jest.fn();
const mockCanReuseSignupPassword = jest.fn();
const mockRefresh = jest.fn();
const mockRefreshRole = jest.fn();
const mockClaimRelationship = jest.fn();
let mockSession: any = null;
let mockRouteParams: { email: string; delivery?: string };
let mockPendingTrainer = "";
let mockPendingFamily = "";
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, setParams: mockSetParams, canGoBack: () => false }),
  useLocalSearchParams: () => mockRouteParams,
}));
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: mockSession,
  verifySignupCode: mockVerify, resendSignupCode: mockResend,
  correctPendingSignupEmail: mockCorrectEmail, canReuseSignupPassword: mockCanReuseSignupPassword,
  refreshUser: mockRefresh }) }));
jest.mock("../../../auth/role", () => ({ useRole: () => ({ refresh: mockRefreshRole }) }));
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
  mockRouteParams = { email: "new@example.test" };
  mockSetParams.mockImplementation((params) => { mockRouteParams = { ...mockRouteParams, ...params }; });
  mockPendingTrainer = "";
  mockPendingFamily = "";
  mockVerify.mockResolvedValue({ user: { id: "new-user" } });
  mockResend.mockResolvedValue(undefined);
  mockCorrectEmail.mockResolvedValue({ deliveryFailed: false });
  mockCanReuseSignupPassword.mockReturnValue(true);
  mockRefresh.mockResolvedValue(undefined);
  mockRefreshRole.mockResolvedValue(undefined);
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

it("edits a pending authenticated email inline, clears the old code and verifies the corrected address", async () => {
  mockSession = { user: { email: "typo@example.test", app_metadata: { provider: "email" } } };
  mockCorrectEmail.mockImplementationOnce(async (_oldEmail, newEmail) => {
    mockSession = { user: { ...mockSession.user, email: newEmail } };
    return { deliveryFailed: false };
  });
  const view = await mount();
  fireEvent.changeText(view.getByLabelText("Código de confirmação"), "123456");
  fireEvent.press(view.getByRole("button", { name: "Editar e-mail" }));
  const input = view.getByLabelText("E-mail");
  expect(input.props.value).toBe("typo@example.test");
  fireEvent.changeText(input, "corrigido@");
  fireEvent(input, "submitEditing", { nativeEvent: { text: "corrigido@" } });
  expect(view.getByText("Digite um e-mail válido")).toBeTruthy();
  expect(mockCorrectEmail).not.toHaveBeenCalled();

  fireEvent.changeText(input, "corrigido@example.test");
  expect(view.queryByText("Digite um e-mail válido")).toBeNull();
  await act(async () => fireEvent.press(view.getByText("Enviar código")));
  expect(mockCorrectEmail).toHaveBeenCalledWith("typo@example.test", "corrigido@example.test", undefined);
  expect(view.getByText("corrigido@example.test")).toBeTruthy();
  expect(view.getByLabelText("Código de confirmação").props.value).toBe("");

  fireEvent.changeText(view.getByLabelText("Código de confirmação"), "654321");
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Continuar" })));
  expect(mockVerify).toHaveBeenCalledWith("corrigido@example.test", "654321");
  expect(mockReplace).toHaveBeenCalledWith("/");
});

it("preserves the current recipient if the corrected email is already registered", async () => {
  mockSession = { user: { email: "typo@example.test", app_metadata: { provider: "email" } } };
  mockCorrectEmail.mockRejectedValueOnce(new Error("Email already registered"));
  const view = await mount();
  fireEvent.press(view.getByRole("button", { name: "Editar e-mail" }));
  fireEvent.changeText(view.getByLabelText("E-mail"), "occupied@example.test");
  await act(async () => fireEvent.press(view.getByText("Enviar código")));
  expect(view.getByText("Este e-mail já está em uso.")).toBeTruthy();
  fireEvent.press(view.getByText("Cancelar"));
  expect(view.getByText("typo@example.test")).toBeTruthy();
  expect(mockResend).not.toHaveBeenCalled();
});

it("asks for the signup password after resuming and retries a failed delivery at the corrected address", async () => {
  mockCanReuseSignupPassword.mockReturnValue(false);
  mockCorrectEmail.mockResolvedValueOnce({ deliveryFailed: true });
  const view = await mount();
  fireEvent.press(view.getByRole("button", { name: "Editar e-mail" }));
  fireEvent.changeText(view.getByLabelText("E-mail"), "corrigido@example.test");
  fireEvent.changeText(view.getByLabelText("Senha do cadastro"), "Synthetic123!");
  await act(async () => fireEvent.press(view.getByText("Enviar código")));
  expect(mockCorrectEmail).toHaveBeenCalledWith("new@example.test", "corrigido@example.test", "Synthetic123!");
  expect(view.getByText("corrigido@example.test")).toBeTruthy();
  expect(view.getByText("Não foi possível enviar o código. Toque em Reenviar.")).toBeTruthy();
  await act(async () => fireEvent.press(view.getByText("Reenviar e-mail")));
  expect(mockResend).toHaveBeenCalledWith("corrigido@example.test", "verify-email");
});

it("does not offer signup correction to an account with trusted verification", async () => {
  mockSession = { user: { email: "confirmed@example.test", app_metadata: { email_verified_hybrid_at: "2026-11-12" } } };
  const view = await mount();
  expect(view.getByText("confirmed@example.test")).toBeTruthy();
  expect(view.queryByRole("button", { name: "Editar e-mail" })).toBeNull();
});

it("keeps the family receipt destination and recovers a failed claim through its invite", async () => {
  mockPendingFamily = "family-token";
  mockClaimRelationship.mockRejectedValueOnce(new Error("offline"));
  const view = await mount();
  fireEvent.changeText(view.getByLabelText("Código de confirmação"), "123456");
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Continuar" })));
  expect(mockReplace).toHaveBeenCalledWith("/family-invite/family-token");
});

it("claims the relationship after OTP and refreshes the role without reloading the pending user", async () => {
  mockPendingFamily = "family-token";
  mockClaimRelationship.mockResolvedValueOnce({ relationshipKind: "guardian" });
  const view = await mount();

  fireEvent.changeText(view.getByLabelText("Código de confirmação"), "123456");
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Continuar" })));

  expect(mockClaimRelationship).toHaveBeenCalledWith("family-token");
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockRefreshRole.mock.invocationCallOrder[0]).toBeGreaterThan(mockClaimRelationship.mock.invocationCallOrder[0]);
  expect(mockReplace).toHaveBeenCalledWith("/family/home");
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
