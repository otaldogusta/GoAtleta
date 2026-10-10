import React from "react";
import { StyleSheet } from "react-native";
import { semanticColors } from "../../../theme/tokens";
import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import SignupScreen, { type SignupCompletion } from "../SignupScreen";
import SignupRoute from "../../../../app/signup";
import { StaffInviteUnavailableError } from "../../../api/staff-invite";

const mockSignUp = jest.fn();
const mockAcceptStaff = jest.fn();
const mockCompleteStaff = jest.fn();
const mockSetOrganization = jest.fn();
let mockCurrentSession: any = null;
const mockResumeStaff = jest.fn();
jest.mock("../../../api/staff-invite", () => ({ ...jest.requireActual("../../../api/staff-invite"), resumeStaffSignup: (...args: unknown[]) => mockResumeStaff(...args) }));
jest.mock("../../../providers/organization-context", () => ({ useOrganization: () => ({ setActiveOrganizationId: mockSetOrganization }) }));
const mockReplace = jest.fn();
const mockResend = jest.fn();
const mockValidateInvite = jest.fn();
jest.mock("../../../api/trainer-invite", () => ({ validateTrainerInvite: (...args: unknown[]) => mockValidateInvite(...args) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace, canGoBack: () => false }), useLocalSearchParams: () => ({}) }));
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: mockCurrentSession, signUp: mockSignUp, resendSignupCode: mockResend, signInWithOAuth: jest.fn(), acceptStaffInvite: mockAcceptStaff, completeStaffInvite: mockCompleteStaff }) }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ mode: "dark", colors: {} }) }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: jest.requireActual("react-native").View }));
jest.mock("../../../components/ui/ScreenBackdrop", () => ({ ScreenBackdrop: () => null }));
jest.mock("../../../ui/ScreenHeader", () => ({ ScreenHeader: ({ title }: any) => jest.requireActual("react").createElement(jest.requireActual("react-native").Text, {}, title) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/Button", () => ({ Button: ({ label, loading, loadingLabel, disabled, onPress }: any) => jest.requireActual("react").createElement(jest.requireActual("react-native").Pressable, { accessibilityRole: "button", accessibilityLabel: loading ? loadingLabel : label, accessibilityState: { disabled }, disabled, onPress }) }));

const completion = (overrides: Partial<SignupCompletion> = {}): SignupCompletion => ({
  email: "recipient@example.com", busy: false, error: "", onSubmit: jest.fn().mockResolvedValue(undefined),
  onChange: jest.fn(), onCancel: jest.fn(), ...overrides,
});

describe("canonical signup screen", () => {
  beforeEach(() => { jest.clearAllMocks(); mockCurrentSession = null; jest.useFakeTimers(); });
  afterEach(() => { cleanup(); jest.clearAllTimers(); jest.useRealTimers(); });

  it.each(["INVITE_INVALID", "AUTH_LINK_EXPIRED"] as const)("shows the field balloon and offers resend only for an expired access code: %s", async (reason) => {
    mockValidateInvite.mockResolvedValue(undefined);
    mockAcceptStaff.mockRejectedValueOnce(new StaffInviteUnavailableError(reason));
    const screen = render(React.createElement(SignupScreen));
    fireEvent.press(screen.getByText("Possui um código de convite?"));
    fireEvent.changeText(screen.getByLabelText("Código de convite"), `https://goatleta.com/staff-invite#code=ABCD-EFGH&email=recipient%40example.com&token_hash=${"a".repeat(64)}&type=magiclink`);
    await act(async () => jest.advanceTimersByTime(700));
    fireEvent.changeText(screen.getByLabelText("Senha"), "Secret123!");
    fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "Secret123!");
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Criar conta" })));
    expect(screen.queryByLabelText("Código verificado")).toBeNull();
    expect(screen.getAllByText(new StaffInviteUnavailableError(reason).message)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Criar conta" }).props.accessibilityState.disabled).toBe(true);
    await act(async () => jest.advanceTimersByTime(1400));
    expect(mockValidateInvite).toHaveBeenCalledTimes(1);
    if (reason === "AUTH_LINK_EXPIRED") {
      mockResend.mockResolvedValue(undefined);
      await act(async () => fireEvent.press(screen.getByRole("button", { name: "Solicitar novo código" })));
      expect(mockResend).toHaveBeenCalledWith("recipient@example.com", "verify-email");
      expect(mockReplace).toHaveBeenCalledWith({ pathname: "/verify-email", params: { email: "recipient@example.com" } });
    } else expect(screen.queryByRole("button", { name: "Solicitar novo código" })).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Código de convite"), "NEXT-CODE");
    expect(screen.queryByText(new StaffInviteUnavailableError(reason).message)).toBeNull();
  });

  it("resumes an email-confirmed pending account without reusing the magic link", async () => {
    mockCurrentSession = { user: { email: "recipient@example.com", app_metadata: { staff_invite_setup_required: true } }, expires_at: 4_000_000_000 };
    const setup = { setup_required: true, organization_id: "org-test", session: mockCurrentSession };
    mockResumeStaff.mockResolvedValue(setup);
    mockCompleteStaff.mockResolvedValue({ ...setup, setup_required: false });
    mockValidateInvite.mockResolvedValue(undefined);
    const screen = render(React.createElement(SignupScreen));
    fireEvent.press(screen.getByText("Possui um código de convite?"));
    fireEvent.changeText(screen.getByLabelText("Código de convite"), `https://goatleta.com/staff-invite#code=ABCD-EFGH&email=recipient%40example.com&token_hash=${"a".repeat(64)}&type=magiclink`);
    await act(async () => jest.advanceTimersByTime(700));
    fireEvent.changeText(screen.getByLabelText("Senha"), "Secret123!");
    fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "Secret123!");
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Criar conta" })));
    expect(mockResumeStaff).toHaveBeenCalledWith("ABCD-EFGH", mockCurrentSession);
    expect(mockAcceptStaff).not.toHaveBeenCalled();
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/");
    expect(screen.queryByText("Confirmar com codigo")).toBeNull();
  });

  it("completes an invited account without creating it again and reuses proof after a retry", async () => {
    mockValidateInvite.mockResolvedValue(undefined);
    const setup = { setup_required: true, organization_id: "org-test", session: { user: { id: "recipient", email: "recipient@example.com" }, expires_at: 4_000_000_000 } };
    mockAcceptStaff.mockResolvedValue(setup);
    mockCompleteStaff.mockRejectedValueOnce(new Error("Tente novamente.")).mockResolvedValue({ ...setup, setup_required: false });
    const screen = render(React.createElement(SignupScreen));
    fireEvent.press(screen.getByText("Possui um código de convite?"));
    fireEvent.changeText(screen.getByLabelText("Código de convite"), `https://goatleta.com/staff-invite#code=ABCD-EFGH&email=recipient%40example.com&token_hash=${"a".repeat(64)}&type=magiclink`);
    await act(async () => jest.advanceTimersByTime(700));
    fireEvent.changeText(screen.getByLabelText("Senha"), "Secret123!");
    fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "Secret123!");
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Criar conta" })));
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByText("Tente novamente.")).toBeTruthy();
    expect(screen.queryByText("Confirmar com codigo")).toBeNull();
    await act(async () => jest.advanceTimersByTime(700));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Criar conta" })));
    expect(mockAcceptStaff).toHaveBeenCalledTimes(1);
    expect(mockCompleteStaff).toHaveBeenCalledWith("ABCD-EFGH", setup, { password: "Secret123!" });
    expect(mockSetOrganization).toHaveBeenCalledWith("org-test");
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it.each([true, false])("preserves existing accounts and rejects a different recipient (mismatch=%s)", async (mismatch) => {
    mockValidateInvite.mockResolvedValue(undefined);
    mockAcceptStaff.mockResolvedValue({ setup_required: false, organization_id: "org-test" });
    const screen = render(React.createElement(SignupScreen));
    fireEvent.press(screen.getByText("Possui um código de convite?"));
    fireEvent.changeText(screen.getByLabelText("Código de convite"), `https://goatleta.com/staff-invite#code=ABCD-EFGH&email=recipient%40example.com&token_hash=${"a".repeat(64)}&type=magiclink`);
    await act(async () => jest.advanceTimersByTime(700));
    if (mismatch) fireEvent.changeText(screen.getByLabelText("E-mail"), "other@example.com");
    fireEvent.changeText(screen.getByLabelText("Senha"), "Secret123!");
    fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "Secret123!");
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Criar conta" })));
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockCompleteStaff).not.toHaveBeenCalled();
    if (mismatch) {
      expect(mockAcceptStaff).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    } else expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("uses the current level's solid color across every filled segment", () => {
    const screen = render(React.createElement(SignupScreen));
    for (const [password, color] of [
      ["asasas", semanticColors.dark.danger],
      ["rioazulvento", semanticColors.dark.warning],
      ["caminhosdistantespelafloresta", semanticColors.dark.success],
    ]) {
      fireEvent.changeText(screen.getByLabelText("Senha"), password);
      for (let index = 0; index < 3; index += 1) {
        expect(StyleSheet.flatten(screen.getByTestId(`password-strength-fill-${index}`).props.style).backgroundColor).toBe(color);
      }
    }
  });

  it("uses the exact same component for the public signup route", () => {
    expect(SignupRoute).toBe(SignupScreen);
  });

  it("locks the recipient and hides unrelated account creation actions", () => {
    const screen = render(React.createElement(SignupScreen, { completion: completion() }));
    expect(screen.getByLabelText("E-mail").props.value).toBe("recipient@example.com");
    expect(screen.getByLabelText("E-mail").props.editable).toBe(false);
    expect(screen.queryByLabelText("Nome")).toBeNull();
    expect(screen.queryByText("Possui um código de convite?")).toBeNull();
    expect(screen.queryByText("Já tem conta?")).toBeNull();
    expect(screen.queryByRole("button", { name: "Criar conta" })).toBeNull();
    expect(screen.getByRole("button", { name: "Concluir cadastro" }).props.accessibilityState.disabled).toBe(true);
  });

  it("shares password strength, visibility and matching validation without creating another account", async () => {
    const props = completion();
    const screen = render(React.createElement(SignupScreen, { completion: props }));
    fireEvent.changeText(screen.getByLabelText("Senha"), "Secret123!");
    expect(screen.queryByText("Fraca")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Ajuda sobre a senha" }));
    expect(screen.getByText("Use uma senha longa e evite repetições. Símbolos como @, # e ! podem ajudar, mas são opcionais.")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Ajuda sobre a senha" }));
    expect(screen.queryByText("Use uma senha longa e evite repetições. Símbolos como @, # e ! podem ajudar, mas são opcionais.")).toBeNull();
    expect(screen.queryByText("símbolo")).toBeNull();
    expect(screen.queryByText("Exemplo: @Senha1234_")).toBeNull();
    fireEvent.press(screen.getByLabelText("Mostrar senha"));
    expect(screen.getByLabelText("Senha").props.secureTextEntry).toBe(false);
    fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "different");
    expect(screen.getByRole("button", { name: "Concluir cadastro" }).props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "Secret123!");
    const button = screen.getByRole("button", { name: "Concluir cadastro" });
    expect(button.props.accessibilityState.disabled).toBe(false);
    await act(async () => { fireEvent.press(button); fireEvent.press(button); });
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
    expect(props.onSubmit).toHaveBeenCalledWith({ password: "Secret123!" });
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockResend).not.toHaveBeenCalled();
  });

  it("locks fields while completing and shows one error without an OTP detour", () => {
    const props = completion({ busy: true, error: "Falha no cadastro" });
    const screen = render(React.createElement(SignupScreen, { completion: props }));
    expect(screen.getByLabelText("Senha").props.editable).toBe(false);
    expect(screen.getByRole("button", { name: "Concluindo..." }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getAllByText("Falha no cadastro")).toHaveLength(1);
    expect(screen.queryByText("Confirmar com codigo")).toBeNull();
  });

  it("preserves data on a failed completion and allows cancelling without signing up", async () => {
    const props = completion({ onSubmit: jest.fn().mockRejectedValue(new Error("Tente novamente")) });
    const screen = render(React.createElement(SignupScreen, { completion: props }));
    fireEvent.changeText(screen.getByLabelText("Senha"), "Secret123!");
    fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "Secret123!");
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Concluir cadastro" })));
    expect(screen.getByText("Tente novamente")).toBeTruthy();
    expect(screen.getByLabelText("Senha").props.value).toBe("Secret123!");
    fireEvent.changeText(screen.getByLabelText("Senha"), "Secret123!!");
    expect(screen.queryByText("Tente novamente")).toBeNull();
    fireEvent.press(screen.getByLabelText("Voltar"));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("keeps ordinary signup and verification unchanged", async () => {
    mockSignUp.mockResolvedValue({ user: { id: "new-user" } });
    mockResend.mockResolvedValue(undefined);
    const screen = render(React.createElement(SignupScreen));
    expect(screen.getByText("Comece agora")).toBeTruthy();
    expect(screen.getByLabelText("E-mail").props.editable).toBe(true);
    expect(screen.queryByLabelText("Nome")).toBeNull();
    expect(screen.getByText("Possui um código de convite?")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("E-mail"), "new@example.com");
    fireEvent.changeText(screen.getByLabelText("Senha"), "Secret123!");
    fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "Secret123!");
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Criar conta" })));
    expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "Secret123!", "login", "");
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/verify-email", params: { email: "new@example.com", delivery: undefined } });
  });

  it("suggests the invite email only after validation without replacing the user's choice", async () => {
    let resolve!: () => void;
    mockValidateInvite.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    const screen = render(React.createElement(SignupScreen));
    fireEvent.press(screen.getByText("Possui um código de convite?"));
    fireEvent.changeText(screen.getByLabelText("Código de convite"), "https://goatleta.com/staff-invite#code=ABCD-EFGH&email=recipient%40example.com");
    expect(screen.getByLabelText("E-mail").props.value).toBe("");
    await act(async () => jest.advanceTimersByTime(700));
    expect(screen.getByLabelText("E-mail").props.value).toBe("");
    await act(async () => resolve());
    expect(screen.getByLabelText("E-mail").props.value).toBe("recipient@example.com");
    expect(screen.getByLabelText("E-mail").props.editable).not.toBe(false);
    fireEvent.changeText(screen.getByLabelText("E-mail"), "chosen@example.com");
    fireEvent.changeText(screen.getByLabelText("Código de convite"), "https://goatleta.com/staff-invite#code=IJKL-MNOP&email=other%40example.com");
    await act(async () => jest.advanceTimersByTime(700));
    expect(screen.getByLabelText("E-mail").props.value).toBe("chosen@example.com");
  });

  it("does not suggest an email when invite validation fails", async () => {
    mockValidateInvite.mockRejectedValueOnce(new Error("Convite indisponível"));
    const screen = render(React.createElement(SignupScreen));
    fireEvent.press(screen.getByText("Possui um código de convite?"));
    fireEvent.changeText(screen.getByLabelText("Código de convite"), "https://goatleta.com/staff-invite#code=ABCD-EFGH&email=recipient%40example.com");
    await act(async () => jest.advanceTimersByTime(700));
    expect(screen.getByLabelText("E-mail").props.value).toBe("");
  });

  it.each([
    "https://goatleta.com/signup?role=trainer&inviteCode=abcd-efgh",
    "https://goatleta.com/staff-invite#code=abcd-efgh&token_hash=fake-proof&type=magiclink&email=test%40example.com",
  ])("extracts only the code from %s and preserves verification through email confirmation", async (link) => {
    mockValidateInvite.mockResolvedValue(undefined);
    mockSignUp.mockResolvedValue({ user: { id: "new-user" } });
    const screen = render(React.createElement(SignupScreen));
    fireEvent.changeText(screen.getByLabelText("E-mail"), "new@example.com");
    fireEvent.changeText(screen.getByLabelText("Senha"), "Secret123!");
    fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "Secret123!");
    fireEvent.press(screen.getByText("Possui um código de convite?"));
    fireEvent.changeText(screen.getByLabelText("Código de convite"), link);
    expect(screen.getByLabelText("Código de convite").props.value).toBe("ABCD-EFGH");
    expect(screen.getByRole("button", { name: "Criar conta" }).props.accessibilityState.disabled).toBe(true);
    await act(async () => jest.advanceTimersByTime(699));
    expect(mockValidateInvite).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1));
    expect(mockValidateInvite).toHaveBeenCalledWith("ABCD-EFGH");
    expect(screen.getByLabelText("Código verificado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Verificar código" })).toBeNull();
    expect(screen.getByRole("button", { name: "Criar conta" }).props.accessibilityState.disabled).toBe(false);
    expect(screen.getByLabelText("Código de convite").props.editable).toBe(false);
    fireEvent.changeText(screen.getByLabelText("Código de convite"), "");
    expect(screen.getByLabelText("Código de convite").props.value).toBe("ABCD-EFGH");
    fireEvent.press(screen.getByRole("button", { name: "Continuar sem convite" }));
    expect(screen.queryByLabelText("Código de convite")).toBeNull();
    fireEvent.press(screen.getByText("Possui um código de convite?"));
    expect(screen.getByLabelText("Código de convite").props.editable).toBe(true);
    fireEvent.changeText(screen.getByLabelText("Código de convite"), "IJKL-MNOP");
    expect(screen.getByRole("button", { name: "Criar conta" }).props.accessibilityState.disabled).toBe(true);
    await act(async () => jest.advanceTimersByTime(700));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Criar conta" })));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/verify-email", params: {
      email: "new@example.com", delivery: undefined, inviteCode: "IJKL-MNOP",
    } });
  });

  it("discards a late success after editing and permits removing an unavailable invitation", async () => {
    let resolve!: () => void;
    mockValidateInvite.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    const screen = render(React.createElement(SignupScreen));
    fireEvent.press(screen.getByText("Possui um código de convite?"));
    fireEvent.changeText(screen.getByLabelText("Código de convite"), "ABCD-EFGH");
    await act(async () => jest.advanceTimersByTime(700));
    fireEvent.changeText(screen.getByLabelText("Código de convite"), "IJKL-MNOP");
    await act(async () => resolve());
    expect(screen.queryByLabelText("Código verificado")).toBeNull();
    mockValidateInvite.mockRejectedValueOnce(new Error("Convite inválido, expirado ou já utilizado."));
    await act(async () => jest.advanceTimersByTime(700));
    expect(screen.getByText("Convite inválido, expirado ou já utilizado.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Código de convite"), "ABCD-EFGH");
    expect(screen.queryByText("Convite inválido, expirado ou já utilizado.")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Continuar sem convite" }));
    expect(screen.queryByLabelText("Código de convite")).toBeNull();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("debounces typing and cancels validation when the invitation is removed", async () => {
    const screen = render(React.createElement(SignupScreen));
    fireEvent.press(screen.getByText("Possui um código de convite?"));
    fireEvent.changeText(screen.getByLabelText("Código de convite"), "ABCD");
    await act(async () => jest.advanceTimersByTime(500));
    fireEvent.changeText(screen.getByLabelText("Código de convite"), "ABCD-EFGH");
    await act(async () => jest.advanceTimersByTime(500));
    expect(mockValidateInvite).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("button", { name: "Continuar sem convite" }));
    await act(async () => jest.advanceTimersByTime(1000));
    expect(mockValidateInvite).not.toHaveBeenCalled();
  });
});
