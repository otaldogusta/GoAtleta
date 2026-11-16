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
let mockRouteParams: { email: string; delivery?: string; correctionSource?: string };
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
jest.mock("../../../ui/ScreenHeader", () => ({ ScreenHeader: ({ title, subtitle }: { title: string; subtitle: string }) => {
  const { createElement } = jest.requireActual("react");
  const { View, Text } = jest.requireActual("react-native");
  return createElement(View, {}, createElement(Text, {}, title), subtitle ? createElement(Text, {}, subtitle) : null);
} }));
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
  mockVerify.mockRejectedValueOnce(new Error("Código inválido ou expirado."));
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
  mockSession = { user: { id: "source-id", email: "invited@example.test" } };
  const view = await mount();
  fireEvent.changeText(view.getByLabelText("Código de confirmação"), "123456");
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Continuar" })));
  expect(mockVerify).toHaveBeenCalledWith("invited@example.test", "123456");
});

it("edits a pending authenticated email inline, clears the old code and verifies the corrected address", async () => {
  mockSession = { user: { id: "source-id", email: "typo@example.test", app_metadata: { provider: "email" } } };
  const view = await mount();
  fireEvent.changeText(view.getByLabelText("Código de confirmação"), "123456");
  fireEvent.press(view.getByRole("button", { name: "Editar e-mail" }));
  const input = view.getByLabelText("E-mail");
  expect(input.props.value).toBe("typo@example.test");
  expect(view.queryByLabelText("Senha do cadastro")).toBeNull();
  expect(view.getByText("Digite o código de 6 dígitos recebido no seu e-mail.")).toBeTruthy();
  const otpInput = view.getByLabelText("Código de confirmação");
  expect(otpInput.props.editable).toBe(false);
  expect(otpInput.props.value).toBe("123456");
  expect(view.queryByRole("button", { name: "Continuar" })).toBeNull();
  fireEvent.changeText(input, "corrigido@");
  fireEvent(input, "submitEditing", { nativeEvent: { text: "corrigido@" } });
  expect(view.getByText("Digite um e-mail válido")).toBeTruthy();
  expect(mockCorrectEmail).not.toHaveBeenCalled();

  fireEvent.changeText(input, "corrigido@example.test");
  expect(view.queryByText("Digite um e-mail válido")).toBeNull();
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Enviar código" })));
  expect(mockCorrectEmail).toHaveBeenCalledWith("typo@example.test", "corrigido@example.test");
  expect(view.getByText("corrigido@example.test")).toBeTruthy();
  expect(view.getByLabelText("Código de confirmação").props.value).toBe("");

  fireEvent.changeText(view.getByLabelText("Código de confirmação"), "654321");
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Continuar" })));
  expect(mockVerify).toHaveBeenCalledWith("corrigido@example.test", "654321", true);
  expect(mockReplace).toHaveBeenCalledWith("/");
});

it("preserves the current recipient if the corrected email is already registered", async () => {
  mockSession = { user: { id: "source-id", email: "typo@example.test", app_metadata: { provider: "email" } } };
  mockCorrectEmail.mockRejectedValueOnce(new Error("Email already registered"));
  const view = await mount();
  fireEvent.changeText(view.getByLabelText("Código de confirmação"), "123456");
  fireEvent.press(view.getByRole("button", { name: "Editar e-mail" }));
  fireEvent.changeText(view.getByLabelText("E-mail"), "occupied@example.test");
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Enviar código" })));
  expect(view.getByText("Este e-mail já está em uso.")).toBeTruthy();
  fireEvent.press(view.getByRole("button", { name: "Limpar e-mail" }));
  expect(view.getByLabelText("E-mail").props.value).toBe("");
  expect(view.queryByText("Este e-mail já está em uso.")).toBeNull();
  expect(view.getByLabelText("Código de confirmação").props.editable).toBe(false);
  fireEvent.press(view.getByRole("button", { name: "Cancelar edição do e-mail" }));
  expect(view.getByText("typo@example.test")).toBeTruthy();
  expect(view.getByLabelText("Código de confirmação").props.value).toBe("123456");
  expect(view.getByLabelText("Código de confirmação").props.editable).toBe(true);
  expect(mockResend).not.toHaveBeenCalled();
});

it("sends directly after a resumed signup and retries failed delivery at the corrected address", async () => {
  mockCanReuseSignupPassword.mockReturnValue(false);
  mockSession = { user: { id: "source-id", email: "new@example.test", app_metadata: { provider: "email" } } };
  mockCorrectEmail.mockResolvedValueOnce({ deliveryFailed: true });
  const view = await mount();
  fireEvent.press(view.getByRole("button", { name: "Editar e-mail" }));
  fireEvent.changeText(view.getByLabelText("E-mail"), "corrigido@example.test");
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Enviar código" })));
  expect(mockCorrectEmail).toHaveBeenCalledWith("new@example.test", "corrigido@example.test");
  expect(view.queryByLabelText("Senha do cadastro")).toBeNull();
  expect(view.getByText("corrigido@example.test")).toBeTruthy();
  expect(view.getByText("Não foi possível enviar o código. Toque em Reenviar.")).toBeTruthy();
  await act(async () => fireEvent.press(view.getByText("Reenviar e-mail")));
  expect(mockCorrectEmail).toHaveBeenCalledTimes(2);
  expect(mockCorrectEmail).toHaveBeenLastCalledWith("new@example.test", "corrigido@example.test");
  expect(mockResend).not.toHaveBeenCalled();
});

it("keeps the email editor available for retry after a send error", async () => {
  mockCorrectEmail.mockRejectedValueOnce(new Error("offline"));
  const view = await mount();
  fireEvent.press(view.getByRole("button", { name: "Editar e-mail" }));
  fireEvent.changeText(view.getByLabelText("E-mail"), "corrigido@example.test");
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Enviar código" })));

  expect(view.getByLabelText("E-mail").props.value).toBe("corrigido@example.test");
  expect(view.getByText("Não foi possível enviar o código para esse e-mail.")).toBeTruthy();
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Enviar código" })));
  expect(mockCorrectEmail).toHaveBeenCalledTimes(2);
  expect(view.getByLabelText("Código de confirmação")).toBeTruthy();
});

it("still accepts the original code after a reload without a pending session", async () => {
  mockCanReuseSignupPassword.mockReturnValue(false);
  const view = await mount();
  expect(view.queryByRole("button", { name: "Editar e-mail" })).toBeNull();
  fireEvent.changeText(view.getByLabelText("Código de confirmação"), "123456");
  await act(async () => fireEvent.press(view.getByRole("button", { name: "Continuar" })));
  expect(mockVerify).toHaveBeenCalledWith("new@example.test", "123456");
});

it("rejects email drafts longer than the signup limit for both button and keyboard submit", async () => {
  const view = await mount();
  fireEvent.press(view.getByRole("button", { name: "Editar e-mail" }));
  const input = view.getByLabelText("E-mail");
  const emailAtLimit = `${"a".repeat(307)}@example.test`;
  fireEvent.changeText(input, emailAtLimit);
  expect(view.getByRole("button", { name: "Enviar código" })).toBeEnabled();

  const tooLong = `a${emailAtLimit}`;
  fireEvent.changeText(input, tooLong);
  expect(view.getByRole("button", { name: "Enviar código" })).toBeDisabled();
  fireEvent(input, "submitEditing", { nativeEvent: { text: tooLong } });
  expect(view.getByText("Digite um e-mail válido")).toBeTruthy();
  expect(mockCorrectEmail).not.toHaveBeenCalled();
});

it("restarts the validation delay on every input change, including trailing spaces", async () => {
  jest.useFakeTimers();
  try {
    const view = await mount();
    fireEvent.press(view.getByRole("button", { name: "Editar e-mail" }));
    const input = view.getByLabelText("E-mail");
    fireEvent.changeText(input, "corrigido@");
    await act(async () => jest.advanceTimersByTime(700));
    fireEvent.changeText(input, "corrigido@ ");
    await act(async () => jest.advanceTimersByTime(100));
    expect(view.queryByText("Digite um e-mail válido")).toBeNull();
    await act(async () => jest.advanceTimersByTime(700));
    expect(view.getByText("Digite um e-mail válido")).toBeTruthy();
    view.unmount();
  } finally { jest.useRealTimers(); }
});

it("does not offer signup correction to an account with trusted verification", async () => {
  mockSession = { user: { id: "source-id", email: "confirmed@example.test", app_metadata: { email_verified_hybrid_at: "2026-11-12" } } };
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
