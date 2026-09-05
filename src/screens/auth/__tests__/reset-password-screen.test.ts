import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import ResetPasswordScreen from "../../../../app/reset-password";

const mockInitialUrl = jest.fn();
const mockUpdatePassword = jest.fn();
const mockRemoveListener = jest.fn();
let mockReceiveUrl: (event: { url: string }) => void;
let mockSessionToken = "synthetic-session-token";
jest.mock("expo-linking", () => ({
  getInitialURL: () => mockInitialUrl(),
  addEventListener: (_name: string, receive: typeof mockReceiveUrl) => {
    mockReceiveUrl = receive;
    return { remove: mockRemoveListener };
  },
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }), useLocalSearchParams: () => ({}) }));
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: { access_token: mockSessionToken } }) }));
jest.mock("../../../api/auth-password", () => ({ updatePasswordWithAccessToken: (...args: unknown[]) => mockUpdatePassword(...args) }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ mode: "dark", colors: {} }) }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: jest.requireActual("react-native").View }));
jest.mock("../../../ui/ScreenHeader", () => ({ ScreenHeader: () => null }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/Button", () => ({
  Button: ({ label, disabled, onPress }: any) => jest.requireActual("react").createElement(jest.requireActual("react-native").Pressable, {
    accessibilityRole: "button", accessibilityLabel: label, accessibilityState: { disabled }, disabled, onPress,
  }),
}));

describe("password recovery route", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSessionToken = "synthetic-session-token";
    mockUpdatePassword.mockResolvedValue(undefined);
  });
  afterEach(() => { cleanup(); jest.clearAllTimers(); jest.useRealTimers(); });

  it("shows one expired-link action even when another session exists", async () => {
    mockInitialUrl.mockResolvedValue("goatleta://reset-password#error_code=otp_expired&error=access_denied");
    const screen = render(React.createElement(ResetPasswordScreen));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getAllByRole("button", { name: "Solicitar novo link" })).toHaveLength(1);
    expect(screen.queryByPlaceholderText("Nova senha")).toBeNull();
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it("uses a newly received recovery link and ignores an older initial-URL response", async () => {
    let resolveInitial!: (value: string) => void;
    mockInitialUrl.mockReturnValue(new Promise<string>((resolve) => { resolveInitial = resolve; }));
    const screen = render(React.createElement(ResetPasswordScreen));
    act(() => { mockReceiveUrl({ url: "goatleta://reset-password#access_token=synthetic-recovery-token&type=recovery" }); });
    await act(async () => {
      resolveInitial("goatleta://reset-password#error_code=otp_expired");
      await Promise.resolve();
    });
    expect(screen.queryByRole("button", { name: "Solicitar novo link" })).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText("Nova senha"), "Synthetic123!");
    fireEvent.changeText(screen.getByPlaceholderText("Confirmar nova senha"), "Synthetic123!");
    await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Atualizar senha" })); });
    expect(mockUpdatePassword).toHaveBeenCalledWith("synthetic-recovery-token", "Synthetic123!");
    screen.unmount();
    expect(mockRemoveListener).toHaveBeenCalledTimes(1);
  });
});
