import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import SignupScreen, { type SignupCompletion } from "../SignupScreen";
import SignupRoute from "../../../../app/signup";

const mockSignUp = jest.fn();
const mockReplace = jest.fn();
const mockResend = jest.fn();
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
    expect(screen.getByText("Forte")).toBeTruthy();
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
});
