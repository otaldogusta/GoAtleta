import React from "react";
import { StyleSheet } from "react-native";
import { semanticColors } from "../../../theme/tokens";
import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import SignupScreen, { type SignupCompletion } from "../SignupScreen";
import SignupRoute from "../../../../app/signup";

const mockSignUp = jest.fn();
const mockReplace = jest.fn();
const mockResend = jest.fn();
const mockValidateInvite = jest.fn();
jest.mock("../../../api/trainer-invite", () => ({ validateTrainerInvite: (...args: unknown[]) => mockValidateInvite(...args) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace, canGoBack: () => false }), useLocalSearchParams: () => ({}) }));
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ signUp: mockSignUp, resendSignupCode: mockResend, signInWithOAuth: jest.fn() }) }));
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
  beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); });
  afterEach(() => { cleanup(); jest.clearAllTimers(); jest.useRealTimers(); });

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

  it("requires verification for the current code and preserves it through email confirmation", async () => {
    mockValidateInvite.mockResolvedValue(undefined);
    mockSignUp.mockResolvedValue({ user: { id: "new-user" } });
    const screen = render(React.createElement(SignupScreen));
    fireEvent.changeText(screen.getByLabelText("E-mail"), "new@example.com");
    fireEvent.changeText(screen.getByLabelText("Senha"), "Secret123!");
    fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "Secret123!");
    fireEvent.press(screen.getByText("Possui um código de convite?"));
    fireEvent.changeText(screen.getByLabelText("Código de convite"), "https://goatleta.com/signup?role=trainer&inviteCode=abcd-efgh");
    expect(screen.getByLabelText("Código de convite").props.value).toBe("ABCD-EFGH");
    expect(screen.getByRole("button", { name: "Criar conta" }).props.accessibilityState.disabled).toBe(true);
    await act(async () => jest.advanceTimersByTime(699));
    expect(mockValidateInvite).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1));
    expect(mockValidateInvite).toHaveBeenCalledWith("ABCD-EFGH");
    expect(screen.getByLabelText("Código verificado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Verificar código" })).toBeNull();
    expect(screen.getByRole("button", { name: "Criar conta" }).props.accessibilityState.disabled).toBe(false);
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
